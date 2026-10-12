#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createRace, step, analyze, render, renderSVG } from './index.js';
import { parse, integer, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: terminal-sort-race [--seed N] [--size N] [--order random|sorted|reversed] [--ticks N] [--frames N] [--solve] [--json] [--svg FILE] [--no-color]\nControls: p pause, . step, n next seed, r reset, +/- speed, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--size', '--order', '--ticks', '--frames', '--svg'], ['--solve']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const size = integer(options, '--size', live ? Math.max(3, Math.min(20, Math.floor(((process.stdout.columns || 80) - 6) / 3))) : 20, 60);
  let seed = integer(options, '--seed', 42, 0xffffffff), paused = false, delay = 70;
  const order = options['--order'] || 'random', make = () => createRace({ size, seed, order }); let race = make();
  const frames = integer(options, '--frames', live ? Infinity : 1, 100000);
  for (const s of race.sorts) step(s, integer(options, '--ticks', 0, 100000));
  if (options['--solve']) for (const s of race.sorts) while (!s.done) step(s);
  if (options['--json'] || options['--svg']) {
    if (options['--frames'] !== undefined) throw new Error('--frames is only for terminal output');
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(race));
    if (options['--json']) console.log(JSON.stringify(analyze(race), null, 2));
  } else await terminal({ live, frames, interval: () => race.sorts.every(s => s.done) ? 100 : delay,
    onKey: key => {
      if (key === 'p' || key === ' ') paused = !paused;
      else if (key === '.') { paused = true; race.sorts.forEach(s => step(s)); }
      else if (key === 'n') { seed = (seed + 1) >>> 0; race = make(); }
      else if (key === 'r') race = make();
      else if (key === '+' || key === '=') delay = Math.max(10, Math.floor(delay / 2));
      else if (key === '-') delay = Math.min(1000, delay * 2);
    }, onTick: () => { if (paused || race.sorts.every(s => s.done)) return false; race.sorts.forEach(s => step(s)); return true; },
    draw: () => `SORT RACE | seed ${seed} | ${size} bars | ${order}${paused ? ' PAUSED' : ''}\n${render(race, { height: Math.max(3, Math.min(18, (process.stdout.rows || 28) - 6)), color: live && !options['--no-color'] && !process.env.NO_COLOR })}\np pause . step n new r reset +/- speed q quit`
  });
} catch (error) { console.error(`terminal-sort-race: ${error.message}`); process.exitCode = 2; }
