/**
 * Shared constants and state: device flags, persistence, timing, graph geometry,
 * seeded randomness and music theory. Ported from legacy/js/core.js.
 */

// ---------- device / options ----------
export const RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
export const IS_MOBILE = (() => {
  try {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse) and (max-width: 1024px)').matches);
  } catch { return false; }
})();

// ---------- persistence (localStorage may throw: private mode, file://) ----------
export const store = (() => {
  const P = 'btd.v1.', mem = new Map<string, any>();
  let ok = true;
  try { localStorage.setItem(P + '__t', '1'); localStorage.removeItem(P + '__t'); } catch { ok = false; }
  return {
    ok,
    get(k: string, d: any) {
      if (ok) try { const v = localStorage.getItem(P + k); if (v != null) return JSON.parse(v); } catch { /* blocked */ }
      return mem.has(k) ? mem.get(k) : structuredClone(d);
    },
    set(k: string, v: any) { mem.set(k, v); if (ok) try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* blocked */ } },
  };
})();
export const opt = Object.assign({ vol: 3, shake: RM ? 0 : 1, flash: RM ? 0 : 1, hints: 0, off: 0 }, store.get('opt', {}));
export const VOLS = [0, 0.45, 0.7, 0.9];

// ---------- timing (measured on the reel: 120 BPM, 2 bars before the trigger, 2 after) ----------
export const BPM = 120, SD = 60 / BPM / 4;   // one sixteenth
export const F3 = 174.614;                    // the riff sits on F3, like the reel
export const PRE = 32, POST = 32;             // sixteenths before / after the trigger
export const INTRO = 6;                       // 3 bars

// ---------- graph geometry (720 x 1280 stage, like the reel) ----------
export const CX = 360, GX0 = 75, GXT = 355, GX1 = 635, GY0 = 488, GY1 = 806;
export const X = (s: number) => (s <= PRE ? GX0 + ((GXT - GX0) * s) / PRE : GXT + ((GX1 - GXT) * (s - PRE)) / POST);
export const Y = (p: number) => Math.max(GY0, Math.min(GY1, 639 - (71 * (p + G.key)) / 12));
export const COL: Record<string, string> = { y: '#ffd84a', r: '#ff3d6e', c: '#7ef2ff', g: '#9aa79f', v: '#b06cff' };

// ---------- seeded randomness (R = Math.random except while a seeded game is generated) ----------
export let R: () => number = Math.random;
export const setR = (f: () => number) => { R = f; };
export const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rnd = (n: number) => Math.floor(R() * n);
export const pick = <T,>(a: readonly T[]): T => a[rnd(a.length)];
export function shuffle<T>(a: T[], f: () => number = R): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- music theory ----------
export const SCALES = [
  { tex: '\\text{phrygian}', s: [0, 1, 3, 5, 7, 8, 10] },   // the reel's colour: Fm -> G♭
  { tex: '\\text{phrygian}', s: [0, 1, 3, 5, 7, 8, 10] },
  { tex: '\\text{minor}', s: [0, 2, 3, 5, 7, 8, 10] },
  { tex: '\\text{harmonic minor}', s: [0, 2, 3, 5, 7, 8, 11] },
  { tex: '\\text{dorian}', s: [0, 2, 3, 5, 7, 9, 10] },
];
export const NAMES = ['F', 'G\\flat', 'G', 'A\\flat', 'A', 'B\\flat', 'B', 'C', 'D\\flat', 'D', 'E\\flat', 'E'];

export interface Note { s: number; d: number; deg?: number; p: number; lab?: number | string | null; g?: number; k?: number }
export interface ShellDef {
  style: string; pr: number[]; n: Note[]; dash?: boolean; reese?: boolean;
  formula: string; notesTex: string; m1: string; m2: string; tell?: boolean;
}
export interface Game { scale: number[]; scaleTex: string; key: number; shells: ShellDef[]; mag: number[] }

/** the current magazine (the title theme swaps in its own with withG) */
export let G: Game = { scale: SCALES[0].s, scaleTex: 'F\\ ' + SCALES[0].tex, key: 0, shells: [], mag: [] };
export const setG = (g: Game) => { G = g; };
export function withG<T>(gm: Game, fn: () => T): T { const old = G; G = gm; try { return fn(); } finally { G = old; } }

export const fq = (p: number) => F3 * Math.pow(2, (p + G.key) / 12);   // G.key: transposition (Survival key change)
export const semis = (deg: number) => G.scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
export function quality(deg: number) {
  const t = semis(deg + 2) - semis(deg), f = semis(deg + 4) - semis(deg);
  return f === 6 ? 'dim' : f === 8 ? 'aug' : t === 3 ? 'm' : '';
}
export const chordTex = (deg: number) => NAMES[((semis(deg) + G.key) % 12 + 12) % 12] + (quality(deg) === 'm' ? '{}m' : '');
export const fitOct = (d: number, lo: number, hi: number) => { while (d > hi) d -= 7; while (d < lo) d += 7; return d; };
export function progression() {
  const cands = [[0, 1], [0, 5], [0, 6], [0, 3], [0, 4], [0, 2], [5, 6], [3, 4], [0, 1], [0, 5]]
    .filter(([a, b]) => !['dim', 'aug'].includes(quality(a)) && !['dim', 'aug'].includes(quality(b)));
  return pick(cands);
}

// ---------- intro loading (the reel's first second: one shell per sixteenth) ----------
export const LOAD0 = 0.5, LOADG = SD, LOADD = SD;
export const loadAt = (j: number) => LOAD0 + j * LOADG;
