const algorithms = ['bubble', 'insertion', 'selection'];
export function createValues({ size = 20, seed = 42, order = 'random' } = {}) {
  if (!Number.isInteger(size) || size < 3 || size > 60 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !['random', 'sorted', 'reversed'].includes(order)) throw new Error('size must be 3–60, seed unsigned 32-bit, and order random|sorted|reversed');
  const values = Array.from({ length: size }, (_, i) => i + 1); let state = seed;
  if (order === 'reversed') values.reverse();
  if (order === 'random') for (let i = size - 1; i > 0; i--) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; const j = Math.floor(state / 4294967296 * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  return values;
}
export function createSort(values, algorithm) {
  if (!algorithms.includes(algorithm) || !Array.isArray(values) || values.length < 1 || values.length > 1000 || Array.from(values).some(n => !Number.isFinite(n))) throw new Error('provide 1–1000 finite numbers and bubble|insertion|selection');
  return { algorithm, values: [...values], comparisons: 0, swaps: 0, ticks: 0, done: values.length < 2, active: [], i: algorithm === 'insertion' ? 1 : 0, j: algorithm === 'selection' ? 1 : 0, min: 0, changed: false };
}
export function step(sort, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 100000) throw new Error('count must be an integer from 0 to 100000');
  const a = sort.values, swap = (i, j) => { [a[i], a[j]] = [a[j], a[i]]; sort.swaps++; };
  for (let tick = 0; tick < count && !sort.done; tick++) {
    sort.ticks++;
    if (sort.algorithm === 'bubble') {
      const j = sort.j; sort.active = [j, j + 1]; sort.comparisons++;
      if (a[j] > a[j + 1]) { swap(j, j + 1); sort.changed = true; }
      sort.j++;
      if (sort.j >= a.length - sort.i - 1) { sort.i++; sort.j = 0; if (!sort.changed || sort.i >= a.length - 1) sort.done = true; sort.changed = false; }
    } else if (sort.algorithm === 'insertion') {
      if (sort.j === 0) sort.j = sort.i;
      sort.active = [sort.j - 1, sort.j]; sort.comparisons++;
      if (a[sort.j - 1] > a[sort.j]) { swap(sort.j - 1, sort.j); sort.j--; if (sort.j > 0) continue; }
      sort.i++; sort.j = 0; if (sort.i >= a.length) sort.done = true;
    } else {
      sort.active = [sort.min, sort.j]; sort.comparisons++;
      if (a[sort.j] < a[sort.min]) sort.min = sort.j;
      sort.j++;
      if (sort.j >= a.length) { if (sort.min !== sort.i) swap(sort.i, sort.min); sort.i++; sort.min = sort.i; sort.j = sort.i + 1; if (sort.i >= a.length - 1) sort.done = true; }
    }
  }
  if (sort.done) sort.active = []; return sort;
}
export function createRace(options = {}) { const values = createValues(options); return { seed: options.seed ?? 42, order: options.order ?? 'random', initial: values, sorts: algorithms.map(a => createSort(values, a)) }; }
export function analyze(race) {
  return { seed: race.seed, order: race.order, size: race.initial.length, initial: [...race.initial], results: race.sorts.map(s => ({ algorithm: s.algorithm, done: s.done, comparisons: s.comparisons, swaps: s.swaps, ticks: s.ticks, values: [...s.values] })) };
}
export function render(race, { height = 12, color = false } = {}) {
  if (!Number.isInteger(height) || height < 3 || height > 40) throw new Error('render height must be 3–40');
  const n = race.initial.length, panel = Math.max(n, 22);
  const titles = race.sorts.map(s => `${s.algorithm.toUpperCase()}${s.done ? ' DONE' : ''}`.padEnd(panel)).join('   ');
  const rows = Array.from({ length: height }, (_, y) => race.sorts.map(s => s.values.map((value, i) => { const char = Math.ceil(value / n * height) >= height - y ? '#' : ' '; return color && char !== ' ' ? `\x1b[${s.done ? 32 : s.active.includes(i) ? 33 : 36}m${char}\x1b[0m` : char; }).join('') + ' '.repeat(panel - n)).join('   '));
  const counts = race.sorts.map(s => `cmp ${s.comparisons} / swap ${s.swaps}`.padEnd(panel)).join('   ');
  return [titles, ...rows, counts].join('\n');
}
export function renderSVG(race) {
  const panel = 220, w = 760, h = 380, colors = ['#5de4c7', '#70a5ff', '#f48fb1'];
  const plots = race.sorts.map((s, index) => {
    const left = 32 + index * (panel + 18), bar = panel / s.values.length;
    const bars = s.values.map((value, i) => { const height = value / race.initial.length * 220; return `<rect x="${left + i * bar}" y="${304 - height}" width="${Math.max(1, bar - 2)}" height="${height}" fill="${s.active.includes(i) ? '#ffd166' : colors[index]}"/>`; }).join('');
    return `<text x="${left}" y="76" fill="#e8edf8">${s.algorithm.toUpperCase()}${s.done ? ' DONE' : ''}</text>${bars}<text x="${left}" y="328" fill="#93a4bc" font-size="12">${s.comparisons} comparisons / ${s.swaps} swaps</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">TERMINAL SORT RACE / SEED ${race.seed}</text>${plots}<text x="32" y="${h - 18}" fill="#93a4bc" font-size="12">One comparison per tick / p pause . step n new seed r reset +/- speed q quit</text></g></svg>\n`;
}
