import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createValues, createSort, createRace, step, analyze, render, renderSVG } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
const finish = s => { while (!s.done) step(s); return s; };
test('generated values are seeded permutations with sorted and reversed modes', () => {
  assert.deepEqual(createValues(), createValues()); assert.notDeepEqual(createValues({ seed: 1 }), createValues({ seed: 2 }));
  assert.deepEqual([...createValues()].sort((a, b) => a - b), createValues({ order: 'sorted' })); assert.deepEqual(createValues({ order: 'reversed' }), createValues({ order: 'sorted' }).reverse());
});
test('all algorithms sort across seeds, preserve multisets, and never alter caller input', () => {
  for (let seed = 0; seed < 30; seed++) for (const algorithm of ['bubble', 'insertion', 'selection']) {
    const values = createValues({ size: 15, seed }), copy = [...values], s = createSort(values, algorithm), expected = [...values].sort((a, b) => a - b);
    while (!s.done) { step(s); assert.deepEqual([...s.values].sort((a, b) => a - b), expected); }
    assert.deepEqual(s.values, expected); assert.deepEqual(values, copy); assert.equal(s.comparisons, s.ticks);
  }
});
test('duplicates, negative values, one-element arrays, and already sorted inputs work', () => {
  for (const algorithm of ['bubble', 'insertion', 'selection']) for (const values of [[1], [3, -2, 3, 0, -2], [1, 2, 3], [3, 2, 1]]) assert.deepEqual(finish(createSort(values, algorithm)).values, [...values].sort((a, b) => a - b));
  assert.equal(finish(createSort([1, 2, 3, 4], 'bubble')).comparisons, 3);
  assert.equal(finish(createSort([1, 2, 3, 4], 'selection')).comparisons, 6);
});
test('swap counts match inversion counts for adjacent-swap algorithms', () => {
  const values = [5, 1, 4, 2, 3]; let inversions = 0; for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) if (values[i] > values[j]) inversions++;
  for (const algorithm of ['bubble', 'insertion']) assert.equal(finish(createSort(values, algorithm)).swaps, inversions);
});
test('batch and single ticks agree and completed sorts remain unchanged', () => {
  for (const algorithm of ['bubble', 'insertion', 'selection']) {
    const a = createSort(createValues(), algorithm), b = createSort(createValues(), algorithm); step(a, 30); for (let i = 0; i < 30; i++) step(b); assert.deepEqual(a, b);
    finish(a); const before = structuredClone(a); step(a, 100); assert.deepEqual(a, before);
  }
});
test('validates arguments and renders portable charts and SVG', () => {
  for (const options of [{ size: 2 }, { seed: -1 }, { order: 'bad' }]) assert.throws(() => createValues(options));
  assert.throws(() => createSort([], 'bubble')); assert.throws(() => createSort([NaN], 'bubble')); assert.throws(() => createSort(Array(3), 'bubble')); assert.throws(() => createSort([1], 'bad')); assert.throws(() => step(createSort([2, 1], 'bubble'), 1.5));
  const race = createRace(); assert.equal(render(race).includes('\x1b'), false); assert.match(render(race), /BUBBLE/); assert.match(renderSVG(race), /^<svg/); assert.equal(analyze(race).results.length, 3);
});
test('CLI supports solved JSON, finite frames, errors, and SVG exports', () => {
  const r = cli(['--solve', '--json']); assert.equal(r.status, 0); assert.ok(JSON.parse(r.stdout).results.every(s => s.done)); assert.equal(cli([]).stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--size', '2'], ['--ticks', '-1'], ['--frames', '1', '--json'], ['--wat']]) assert.equal(cli(args).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'sort-')); try { const file = join(dir, 'x.svg'); assert.equal(cli(['--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /SORT RACE/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});
