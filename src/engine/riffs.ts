/**
 * The reel's 8 shells, each with small random variations every game.
 * Values d_n are played as scale[d_n] on F phrygian (F G♭ A♭ B♭ C D♭ E♭ F), exactly like the reel:
 *   1  d_n = n² mod 8                 -> F G♭ C G♭
 *   2  x_{n+1} = (5x_n + 3) mod 8      -> every note once
 *   3  T_n = n(n+1)/2 mod 7            -> palindrome
 *   4  saw(ft) + saw((f+Δf)t)          -> Reese bass, long notes
 *   5  y_bar2 = -y_bar1                -> minor arpeggio flipped = major
 *   6  hit if k mod 3 = 0              -> 3 against 4
 *   7  Shepard: 4 octave copies        -> falls forever
 *   8  the magazine itself             -> riff #1 + magazine bits (boss)
 * A shell is 64 sixteenths: s = 0..31 before the trigger; the same riff continues after it.
 */
import { G, NAMES, Note, pick, rnd, SCALES, setG, ShellDef, shuffle } from './core';

const SC = [0, 1, 3, 5, 7, 8, 10, 12];            // F phrygian, octave as index 7
const nameOf = (semi: number) => NAMES[((semi + G.key) % 12 + 12) % 12];
/** "note = scale[d_n] : F, G♭, C, G♭" — the riff's cycle, as printed in the reel */
const notesTex = (vals: number[]) => `\\text{note} = \\text{scale}[d_n] : ${vals.slice(0, 6).map(v => nameOf(SC[((v % 8) + 8) % 8])).join(',\\ ')}`;
/** one note per eighth from a value sequence */
const eighths = (vals: number[], d = 2): Note[] => vals.map((v, n) => ({ s: 2 * n, d, deg: v, p: SC[((v % 8) + 8) % 8] + 12 * Math.floor(v / 8), lab: v }));

type Riff = Omit<ShellDef, 'pr' | 'tell'>;

const FAMILIES: Record<string, () => Riff> = {
  sq() {
    const c = pick([0, 0, 1, 2, 3]), m = 8, vals = Array.from({ length: 16 }, (_, n) => ((n + c) ** 2) % m);
    const f = `d_n = ${c ? `(n + ${c})` : 'n'}^2 \\bmod ${m} \\;\\in\\; \\{0,\\ 1,\\ 4\\}`;
    return { style: 'sq', n: eighths(vals), formula: f, notesTex: notesTex(vals.slice(0, 4)), m1: f, m2: notesTex(vals.slice(0, 4)) };
  },
  lcg() {
    const c = pick([3, 3, 1, 5, 7]), x0 = rnd(8), vals: number[] = [];
    let x = x0; for (let n = 0; n < 16; n++) { vals.push(x); x = (5 * x + c) % 8; }
    const f = `x_{n+1} = (5x_n + ${c}) \\bmod 8`;
    const m2 = `${vals.slice(0, 8).join(',')}:\\;\\;\\text{every note exactly once}`;
    return { style: 'lcg', n: eighths(vals), formula: f, notesTex: m2, m1: f, m2 };
  },
  tri() {
    const c = pick([0, 0, 1, 2]), vals = Array.from({ length: 16 }, (_, n) => (((n + c) * (n + c + 1)) / 2) % 7);
    const f = `T_n = \\tfrac{n(n+1)}{2} \\bmod 7`;
    const m2 = `= ${vals.slice(0, 7).join(',')},\\dots\\;\\;\\text{(a palindrome)}`;
    return { style: 'tri', n: eighths(vals), formula: f, notesTex: m2, m1: f, m2 };
  },
  reese() {
    const [b, c] = pick([[5, 6], [5, 6], [3, 4], [2, 3]] as const), df0 = pick([1, 1, 2]);
    const n: Note[] = [{ s: 0, d: 16, deg: 0, p: SC[0], lab: 0 }, { s: 16, d: 8, deg: b, p: SC[b], lab: b }, { s: 24, d: 8, deg: c, p: SC[c], lab: c }];
    const f = `y = \\text{saw}(ft) + \\text{saw}\\big((f + \\Delta f)\\,t\\big)`;
    const m2 = `\\Delta f = ${df0} \\to ${df0 + 5}\\text{ Hz: two saws drift in and out of phase}`;
    return { style: 'reese', reese: true, n, formula: f, notesTex: m2, m1: f, m2 };
  },
  mirror() {
    const up = [0, 3, 7, 10, 12, 12], lift = pick([0, 0, 5]), n: Note[] = [];
    [...up, null, null, ...up.map(v => -v), null, null].forEach((v, j) => { if (v !== null) n.push({ s: 2 * j, d: 2, p: v + lift, lab: v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' }); });
    const f = `y_{\\text{bar }2}(t) = -\\,y_{\\text{bar }1}(t)`;
    const m2 = `\\text{minor }(+3,+7,+10) \\to (-3,-7,-10) = \\text{major}`;
    return { style: 'mirror', n, formula: f, notesTex: m2, m1: f, m2 };
  },
  poly() {
    const q = pick([[0, 0, 12, 1], [0, 0, 12, 1], [0, 7, 0, 12], [0, 0, 7, 1]]), n: Note[] = [];
    for (let k = 0, j = 0; k < 32; k++) if (k % 3 === 0) { const v = q[j++ % 4]; n.push({ s: k, d: Math.min(3, 32 - k), p: v, lab: v }); }
    const f = `\\text{hit if } k \\bmod 3 = 0,\\quad \\text{note} = (${q.join(',')})_{\\,j \\bmod 4}`;
    const m2 = `4\\text{ notes}\\times 3\\text{ sixteenths} = \\text{a 3 beat loop in a 4 beat bar}`;
    return { style: 'poly', n, formula: f, notesTex: m2, m1: f, m2 };
  },
  shep() {
    const n: Note[] = [];
    for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) {
      const step = ((k * 7 - i) % 28 + 28) % 28 - 14, p = SC[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7), z = p / 14;
      n.push({ s: 2 * i, d: 2, p, k, g: Math.exp(-z * z), lab: null });
    }
    const f = `y_k = y_0 - \\tfrac{n}{2} + k \\pmod 4,\\quad \\text{loudness} = e^{-y_k^2}`;
    const m2 = `4\\text{ copies, one octave apart: fade in on top, out at the bottom}`;
    return { style: 'shep', n, formula: f, notesTex: m2, m1: f, m2 };
  },
};
const ORDER = ['sq', 'lcg', 'tri', 'reese', 'mirror', 'poly', 'shep'];

/**
 * A magazine of n shells (L live): the reel's riffs in the reel's order (a magazine of 8 plays
 * all of them, the last being the boss), each with fresh parameters.
 */
export function newGame(n = 8, L = 4, opts: { key?: number } = {}) {
  const key = opts.key || 0, sc = SCALES[0];
  setG({ scale: sc.s, scaleTex: NAMES[key] + '\\ ' + sc.tex, key, shells: [], mag: [] });
  // shorter magazines (Survival, VS) take a random selection, kept in reel order
  const ids = n - 1 >= ORDER.length ? [...ORDER] : shuffle([...ORDER]).slice(0, n - 1).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  while (ids.length < n - 1) ids.push(pick(ORDER));
  // bed chord under each riff alternates G♭ / F like the reel (bar 2 always goes to C)
  ids.forEach((id, j) => G.shells.push({ pr: [j % 2 ? 0 : 1, 1], ...FAMILIES[id]() }));
  G.mag = shuffle(Array.from({ length: n }, (_, j) => (j < L ? 1 : 0)));
  const bits = G.mag.join('\\,');
  G.shells.push({
    style: 'boss', pr: [0, 1], n: [], formula: `${bits} = \\text{this round's shells}`,
    notesTex: `1 = 808\\text{ hit}\\quad +\\text{ hand saw wall} + \\#1\\text{ as bells}`,
    m1: `${bits} = \\text{this round's shells}`, m2: `1 = 808\\text{ hit}\\quad +\\text{ hand saw wall} + \\#1\\text{ as bells}`,
  });
}
