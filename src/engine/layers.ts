/**
 * Note layers: one note list drives both the picture and the sound. Ported from legacy/js/layers.js.
 * Changes: Shepard layers (reel shell 7), and the boss plays riff #1 so the last shell has music.
 */
import { G, Note, POST, PRE, SD } from './core';
import { V } from './audio';

export interface Layer {
  mode: 'step' | 'dash' | 'spike' | 'reese' | 'flat' | 'shep' | 'none';
  voice: string | null; col?: string; notes: Note[]; thin?: boolean; wide?: boolean; deg?: number; gn?: number;
}

export function layers(i: number, phase: 'pre' | 'post', res: number | null, who: 'you' | 'dlr' = 'you'): Layer[] {
  const sh = G.shells[i], a = phase === 'pre' ? 0 : PRE, L: Layer[] = [], dl = who === 'dlr', n = G.mag.length;
  if (sh.style === 'boss') {
    // riff #1 plays again (the magazine bits are in the formula below)
    const riff1 = (G.shells[0].style === 'shep' ? G.shells[0].n.filter(q => q.k === 0) : G.shells[0].n).map(q => ({ ...q, s: q.s + a, lab: null, k: undefined, g: undefined }));
    if (phase === 'pre') L.push({ mode: 'step', voice: dl ? 'dlead' : 'lead', col: dl ? 'v' : 'y', notes: riff1 });
    else if (res) L.push({ mode: 'spike', voice: 'k808', col: 'r', notes: riff1.map(q => ({ ...q, p: q.p - 24 })) },
      { mode: 'flat', voice: 'sawwall', col: 'y', deg: sh.pr[0], notes: [{ s: a, d: POST, p: -12 }] },
      { mode: 'step', voice: 'bell', col: 'y', notes: riff1.map(q => ({ ...q, p: q.p + 12 })) });
    else L.push({ mode: 'step', voice: 'bell', col: 'c', notes: riff1.map(q => ({ ...q, p: q.p + 12 })) },
      { mode: 'none', voice: 'pad', notes: [{ s: a, d: 16, deg: sh.pr[0], p: 0 }, { s: a + 16, d: 16, deg: sh.pr[1], p: 0 }] });
    return L;
  }
  const notes = sh.n.map(q => ({ ...q, s: q.s + a }));
  if (sh.style === 'shep') {
    if (phase === 'pre') L.push({ mode: 'shep', voice: 'shep', col: dl ? 'v' : 'y', notes });
    else if (res) L.push({ mode: 'shep', voice: 'k808', col: 'r', notes: notes.filter(q => (q.g ?? 1) > 0.3).map(q => ({ ...q, p: q.p - 24 })) });
    else L.push({ mode: 'shep', voice: 'bell', col: 'c', notes: notes.filter(q => (q.g ?? 1) > 0.05).map(q => ({ ...q, p: q.p + 12, g: (q.g ?? 1) * 0.8 })) },
      { mode: 'none', voice: 'pad', notes: [{ s: a, d: 16, deg: sh.pr[0], p: 0 }, { s: a + 16, d: 16, deg: sh.pr[1], p: 0 }] });
    return L;
  }
  const mode = sh.reese ? 'reese' : sh.dash ? 'dash' : 'step';
  if (phase === 'pre') {
    L.push({ mode, voice: sh.reese ? 'reese' : dl ? 'dlead' : 'lead', col: dl ? 'v' : 'y', notes });
  }
  else if (res) {
    if (sh.reese) L.push({ mode: 'reese', voice: 'reese', col: 'r', notes: notes.map(q => ({ ...q, p: q.p - 24 })), wide: true },
      { mode: 'none', voice: 'k808', notes: notes.map(q => ({ ...q, d: Math.min(q.d, 4), p: q.p - 24 })) });
    else L.push({ mode: 'spike', voice: 'k808', col: 'r', notes: notes.map(q => ({ ...q, p: q.p - 24 })) });
  } else {
    L.push({ mode, voice: 'bell', col: 'c', notes: notes.map(q => ({ ...q, p: q.p + 12 })) },
      { mode: 'none', voice: 'pad', notes: [{ s: a, d: 16, deg: sh.pr[0], p: 0 }, { s: a + 16, d: 16, deg: sh.pr[1], p: 0 }] });
  }
  return L;
}

export function schedule(Ls: Layer[], t0: number) {
  for (const l of Ls) {
    if (!l.voice) continue;
    const gn = l.gn || 1;
    for (const q of l.notes) {
      const t = t0 + q.s * SD, d = q.d * SD, g = (q.g ?? 1) * gn;
      if (l.voice === 'reese') V.reese(t, q.p, d, gn, 1 + (5 * (q.s % 32)) / 32 + (l.wide ? 4 : 0));
      else if (l.voice === 'sawwall') V.sawwall(t, d, l.deg || 0);
      else if (l.voice === 'pad') V.pad(t, q.deg, d, gn);
      else V[l.voice](t, q.p, d, g);
    }
  }
}

export function drums(t0: number, phase: 'pre' | 'post', res?: number) {
  if (phase === 'pre') {
    for (let s = 0; s < PRE; s += 4) V.kick(t0 + s * SD, s === 0 || s === 16 ? 0.9 : 0.75);
    for (let s = 24; s < PRE; s++) V.hat(t0 + s * SD, 0.35 + (s - 24) * 0.06);
    V.riser(t0 + 20 * SD, 12 * SD);
  } else if (res) {
    for (let s = PRE; s < PRE + POST; s++) { const t = t0 + s * SD; if (s % 4 === 0) V.kick(t, 0.85); if (s % 8 === 4) V.clap(t, 0.7); V.hat(t, s % 2 ? 0.25 : s % 4 === 2 ? 0.55 : 0.35); }
  } else {
    for (let s = PRE; s < PRE + POST; s += 8) V.kick(t0 + s * SD, 0.65);
    for (let s = PRE; s < PRE + POST; s += 2) if (s % 8 === 6) V.hat(t0 + s * SD, 0.35);
  }
}
