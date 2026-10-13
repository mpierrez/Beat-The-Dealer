/**
 * Web Audio master chain, routing and synthesizer voices. Ported from legacy/js/audio.js
 * (including the phone / anti-crackle settings). Two changes measured on the reel:
 *  - k808: every LIVE note starts two octaves up and glides down to its pitch (~160 ms)
 *  - lead: notes are held flat ~80 % of the note, then cut (no decay)
 */
import { fitOct, fq, IS_MOBILE, opt, SD, semis, VOLS } from './core';

export interface Route { d: GainNode; r: GainNode; e: GainNode; dead?: boolean }

export let ctx: AudioContext | null = null;
let bus: GainNode, revSend: GainNode, dlySend: GainNode, noiseBuf: AudioBuffer, curveHard: Float32Array, curveSoft: Float32Array;
export let MASTER: GainNode | null = null;
export let menuLP: BiquadFilterNode | null = null;
let UI: Route, ROUTE: Route;

/** the audio clock (frozen while suspended, so a paused game stays still); page clock before audio exists */
export const now = () => (ctx ? ctx.currentTime : performance.now() / 1000);

const C = () => ctx as AudioContext;
function mkCurve(k: number) { const c = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; }

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  curveHard = mkCurve(IS_MOBILE ? 2.0 : 5); curveSoft = mkCurve(IS_MOBILE ? 0.9 : 1.3);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = IS_MOBILE ? -20 : -14; comp.knee.value = 16; comp.ratio.value = IS_MOBILE ? 3.5 : 5; comp.attack.value = 0.005; comp.release.value = 0.2;
  const clip = ctx.createWaveShaper(); clip.curve = curveSoft;
  const out = ctx.createGain(); out.gain.value = VOLS[opt.vol] ?? 0.9; MASTER = out;
  bus = ctx.createGain(); bus.gain.value = IS_MOBILE ? 0.32 : 0.65;
  if (IS_MOBILE) { const hp = filt('highpass', 70, 0.7); bus.connect(hp); hp.connect(comp); comp.connect(out); }
  else { bus.connect(clip); clip.connect(comp); comp.connect(out); }
  out.connect(ctx.destination);
  // hall reverb
  const rev = ctx.createConvolver();
  const revLen = Math.round(ctx.sampleRate * (IS_MOBILE ? 0.35 : 2.4)), irCh = IS_MOBILE ? 1 : 2;
  const ir = ctx.createBuffer(irCh, revLen, ctx.sampleRate);
  for (let c = 0; c < irCh; c++) { const d = ir.getChannelData(c); for (let i = 0; i < revLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 2.6) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1); }
  rev.buffer = ir; revSend = ctx.createGain(); revSend.gain.value = IS_MOBILE ? 0.25 : 0.5;
  const rlp = filt('lowpass', IS_MOBILE ? 4500 : 6000);
  revSend.connect(rlp); rlp.connect(rev); rev.connect(bus);
  // dotted-eighth echo
  const dly = ctx.createDelay(1); dly.delayTime.value = SD * 3; const fb = ctx.createGain(); fb.gain.value = 0.32; const dlp = filt('lowpass', 2800);
  dlySend = ctx.createGain(); dlySend.gain.value = 1; dlySend.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(bus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  menuLP = filt('lowpass', 18000, 0.7); menuLP.connect(bus);
  UI = mkRoute(bus); ROUTE = UI;
}
export const getBus = () => bus;

// routes: {d,r,e} gains feeding dest / reverb / echo, so a whole run (incl. pre-scheduled notes) can be silenced at once
export function mkRoute(dest: AudioNode = bus, gv = 1): Route {
  const r = { d: C().createGain(), r: C().createGain(), e: C().createGain() };
  r.d.gain.value = gv; r.d.connect(dest); r.r.connect(revSend); r.e.connect(dlySend); return r;
}
export function routeTo<T>(rt: Route | null, fn: () => T): T { const old = ROUTE; ROUTE = rt || UI; try { return fn(); } finally { ROUTE = old; } }
export function killRoute(rt: Route | null, t = now()) {
  if (!rt || rt.dead || !ctx) return; rt.dead = true;
  for (const k of ['d', 'r', 'e'] as const) {
    const p = rt[k].gain;
    if (ctx.state !== 'running') { p.cancelScheduledValues(0); p.value = 0; }
    else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + 0.06); }
  }
  setTimeout(() => { for (const k of ['d', 'r', 'e'] as const) try { rt[k].disconnect(); } catch { /* gone */ } }, 300);
}
export function env(node: GainNode, t: number, a: number, peak: number, dec: number) { const p = node.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(1e-4, t + a + dec); }
export function osc(type: OscillatorType, f: number, t: number, dur: number) { const o = C().createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
export function noise(t: number, dur: number, off = 0) { const n = C().createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(t, off || Math.random()); n.stop(t + dur); return n; }
export function out(node: AudioNode, wet = 0, echo = 0) {
  node.connect(ROUTE.d);
  if (wet) { const s = C().createGain(); s.gain.value = wet; node.connect(s); s.connect(ROUTE.r); }
  if (echo) { const s = C().createGain(); s.gain.value = echo; node.connect(s); s.connect(ROUTE.e); }
}
export function filt(type: BiquadFilterType, f: number, q = 0.7) { const b = C().createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
const gain = (v?: number) => { const g = C().createGain(); if (v !== undefined) g.gain.value = v; return g; };

export const V: Record<string, (...a: any[]) => void> = {
  // bright detuned saw lead + octave-down sub; held flat ~80 % of the note then cut, like the reel
  lead(t, p, d, gn = 1) {
    const f = fq(p), len = Math.min(d * 0.8, 0.2), gg = gain(), lp = filt('lowpass', 7000, 0.8);
    lp.frequency.setValueAtTime(14000, t); lp.frequency.exponentialRampToValueAtTime(6500, t + len + 0.08);
    if (IS_MOBILE) { osc('sawtooth', f, t, len + 0.12).connect(lp); const sub = osc('square', f / 2, t, len + 0.12), sg = gain(0.25); sub.connect(sg); sg.connect(lp); }
    else {
      for (const det of [-9, 0, 9]) { const o = osc('sawtooth', f, t, len + 0.15); o.detune.value = det; o.connect(lp); }
      const hi = osc('sawtooth', f * 2, t, len + 0.15), hg = gain(0.22); hi.connect(hg); hg.connect(lp);
      const sub = osc('square', f / 2, t, len + 0.15), sg = gain(0.3); sub.connect(sg); sg.connect(lp);
    }
    lp.connect(gg); const v = gg.gain; v.setValueAtTime(0, t); v.linearRampToValueAtTime(0.075 * gn, t + 0.003);
    v.setValueAtTime(0.075 * gn, t + len); v.linearRampToValueAtTime(0, t + len + 0.03);
    out(gg, IS_MOBILE ? 0.08 : 0.12, IS_MOBILE ? 0.08 : 0.16);
  },
  // LIVE: distorted 808; starts two octaves up and glides down to its note (the reel's falling growl)
  k808(t, p, d, gn = 1) {
    const f = fq(p), len = Math.max(0.18, d), o = C().createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 4, t); o.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.12); o.frequency.exponentialRampToValueAtTime(f, t + 0.17);
    o.start(t); o.stop(t + len + 0.1);
    const drive = gain(IS_MOBILE ? 1.4 : 3.0), ws = C().createWaveShaper(); ws.curve = IS_MOBILE ? curveSoft : curveHard; ws.oversample = 'none';
    const lp = filt('lowpass', IS_MOBILE ? 4500 : 6500, 0.7), gg = gain(); o.connect(drive); drive.connect(ws); ws.connect(lp); lp.connect(gg);
    const fz = filt('highpass', 1400, 0.7), fzg = gain(0.4); ws.connect(fz); fz.connect(fzg); fzg.connect(gg);
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.15 * gn, t + 0.004); gg.gain.setTargetAtTime(0.11 * gn, t + 0.02, 0.15);
    gg.gain.setValueAtTime(0.11 * gn, t + len - 0.03); gg.gain.linearRampToValueAtTime(0, t + len + 0.02); out(gg, 0.04);
    const clean = C().createOscillator(); clean.type = 'sine';
    clean.frequency.setValueAtTime(f * 4, t); clean.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.12); clean.frequency.exponentialRampToValueAtTime(f, t + 0.17);
    clean.start(t); clean.stop(t + len + 0.05);
    const cg = gain(); clean.connect(cg); cg.gain.setValueAtTime(0.12 * gn, t); cg.gain.setValueAtTime(0.12 * gn, t + len - 0.03); cg.gain.linearRampToValueAtTime(0, t + len + 0.02); out(cg);
  },
  // glass bell: FM with a slightly inharmonic partial, long ring, reverb + echo
  bell(t, p, _d, gn = 1) {
    const f = fq(p), ring = 1.6, c = osc('sine', f, t, ring), m = osc('sine', f * 3.01, t, ring), mg = gain();
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.9); m.connect(mg); mg.connect(c.frequency);
    const gg = gain(); c.connect(gg);
    const p2 = osc('sine', f * 4.2, t, 0.6), g2 = gain(); p2.connect(g2); env(g2, t, 0.001, 0.06 * gn, 0.5); g2.connect(gg);
    const p3 = osc('sine', f * 2, t, ring), g3 = gain(); p3.connect(g3); env(g3, t, 0.002, 0.07 * gn, 1.2); g3.connect(gg);
    env(gg, t, 0.002, 0.24 * gn, ring); out(gg, 0.55, 0.22);
  },
  reese(t, p, d, gn = 1, df = 2) {
    const f = fq(p), lp = filt('lowpass', 1600, 2.5);
    lp.frequency.setValueAtTime(2200, t); lp.frequency.linearRampToValueAtTime(700, t + d);
    const oscs = IS_MOBILE ? [[f, 0], [f / 2, 0]] : [[f, 0], [f + df, 0], [f / 2, 5]];
    for (const [ff, det] of oscs) { const o = osc('sawtooth', ff, t, d); o.detune.value = det; o.connect(lp); }
    const gg = gain(); lp.connect(gg); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.075 * gn, t + 0.02);
    gg.gain.setValueAtTime(0.075 * gn, t + d - 0.04); gg.gain.linearRampToValueAtTime(0, t + d); out(gg, IS_MOBILE ? 0.08 : 0.12, IS_MOBILE ? 0.06 : 0.1);
  },
  // warm supersaw pad chord + sub bass on the root (the reel's blank section: Fm -> G♭)
  pad(t, deg, d, gn = 1) {
    const lp = filt('lowpass', 1500, 0.6), gg = gain(); lp.connect(gg);
    lp.frequency.setValueAtTime(1800, t); lp.frequency.linearRampToValueAtTime(3200, t + d * 0.6);
    const root = semis(fitOct(deg, 0, 6));
    if (IS_MOBILE) { for (const iv of [0, semis(deg + 2) - semis(deg), semis(deg + 4) - semis(deg)]) osc('sawtooth', fq(root + iv), t, d + 0.35).connect(lp); }
    else for (const iv of [0, semis(deg + 2) - semis(deg), semis(deg + 4) - semis(deg)]) for (const det of [-14, 0, 14]) { const o = osc('sawtooth', fq(root + iv), t, d + 0.4); o.detune.value = det; o.connect(lp); }
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.06 * gn, t + 0.06); gg.gain.setValueAtTime(0.06 * gn, t + d - 0.05); gg.gain.linearRampToValueAtTime(0, t + d + 0.3); out(gg, 0.35);
    const sb = osc('sine', fq(root - 24), t, d + 0.1), sg = gain(); sb.connect(sg);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.18 * gn, t + 0.03); sg.gain.setValueAtTime(0.18 * gn, t + d - 0.04); sg.gain.linearRampToValueAtTime(0, t + d + 0.05); out(sg);
  },
  sawwall(t, d, deg = 0) {
    const lp = filt('lowpass', 300, 1); lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(3000, t + d);
    const gg = gain(); lp.connect(gg); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.045, t + 0.3); gg.gain.setValueAtTime(0.045, t + d - 0.2); gg.gain.linearRampToValueAtTime(0, t + d); out(gg, IS_MOBILE ? 0.15 : 0.3);
    const r = semis(fitOct(deg, 0, 6));
    if (IS_MOBILE) { for (const iv of [-12, 0, 7]) osc('sawtooth', fq(r + iv), t, d).connect(lp); }
    else for (const iv of [-24, -12, -5, 0, semis(deg + 2) - semis(deg), 7]) for (const det of [-12, 0, 12]) { const o = osc('sawtooth', fq(r + iv), t, d); o.detune.value = det; o.connect(lp); }
  },
  // thunder kick: long pitch sweep from the top down to A1, measured on the reel
  kick(t, v = 1) {
    const o = C().createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(400, t); o.frequency.exponentialRampToValueAtTime(105, t + 0.04); o.frequency.exponentialRampToValueAtTime(50, t + 0.26);
    const gg = gain();
    if (IS_MOBILE) o.connect(gg); else { const sh = C().createWaveShaper(); sh.curve = curveSoft; o.connect(sh); sh.connect(gg); }
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.65 * v, t + 0.002); gg.gain.setTargetAtTime(0.45 * v, t + 0.05, 0.18); gg.gain.exponentialRampToValueAtTime(1e-4, t + 0.72);
    out(gg, 0.03); o.start(t); o.stop(t + 0.7);
    const n = noise(t, 0.02), hp = filt('highpass', 3500), ng = gain(); n.connect(hp); hp.connect(ng); env(ng, t, 0.0005, 0.12 * v, 0.012); out(ng);
  },
  clap(t, v = 1) {
    const bp = filt('highpass', 900, 0.5), gg = gain(); bp.connect(gg); out(gg, 0.35);
    const n = noise(t, 0.35); n.connect(bp); const p = gg.gain; p.setValueAtTime(0, t);
    for (const o of [0, 0.011, 0.022]) { p.setValueAtTime(0.8 * v, t + o); p.exponentialRampToValueAtTime(0.1 * v, t + o + 0.009); }
    p.setValueAtTime(0.55 * v, t + 0.031); p.exponentialRampToValueAtTime(1e-4, t + 0.34);
  },
  hat(t, v = 1) { const n = noise(t, 0.06), hp = filt('highpass', 8000), gg = gain(); n.connect(hp); hp.connect(gg); env(gg, t, 0.001, 0.12 * v, 0.045); out(gg, 0.05); },
  tick(t, v = 1) { const o = osc('square', 1520, t, 0.03), gg = gain(), hp = filt('highpass', 900); o.connect(hp); hp.connect(gg); env(gg, t, 0.001, 0.045 * v, 0.025); out(gg, 0.2); },
  riser(t, d) {
    const n = noise(t, d + 0.05), bp = filt('bandpass', 400, 3), gg = gain();
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(9000, t + d);
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.14, t + d); gg.gain.linearRampToValueAtTime(0, t + d + 0.02); n.connect(bp); bp.connect(gg); out(gg, 0.25);
  },
  // the shot: crack + boom + rolling thunder tail
  gunshot(t) {
    const c = noise(t, 0.05), chp = filt('highpass', 1800), cg = gain(); c.connect(chp); chp.connect(cg); env(cg, t, 0.0005, IS_MOBILE ? 0.28 : 0.4, 0.03); out(cg, IS_MOBILE ? 0.3 : 0.5);
    const n = noise(t, 1.4), lp = filt('lowpass', 7000, 0.5), ng = gain();
    lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(160, t + 1.0);
    n.connect(lp); lp.connect(ng); env(ng, t, 0.001, IS_MOBILE ? 0.15 : 0.22, 1.2); out(ng, IS_MOBILE ? 0.3 : 0.5);
    const b = C().createOscillator(); b.frequency.setValueAtTime(140, t); b.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    const bg = gain(); b.connect(bg); env(bg, t, 0.002, IS_MOBILE ? 0.35 : 0.6, 1.0); out(bg, 0.2); b.start(t); b.stop(t + 1.2);
    const r = noise(t, 1.8), rlp = filt('lowpass', 140, 0.8), rg = gain(); r.connect(rlp); rlp.connect(rg);
    rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(IS_MOBILE ? 0.3 : 0.5, t + 0.1); rg.gain.exponentialRampToValueAtTime(1e-4, t + 1.8); out(rg, IS_MOBILE ? 0.15 : 0.25);
  },
  dryfire(t) {
    const n = noise(t, 0.05), hp = filt('highpass', 2500), gg = gain(); n.connect(hp); hp.connect(gg); env(gg, t, 0.0005, 0.35, 0.035); out(gg, 0.4);
    for (const [f, a] of [[2637, 0.07], [3951, 0.04], [5274, 0.025]]) { const o = osc('sine', f, t + 0.004, 1.5), og = gain(); o.connect(og); env(og, t + 0.004, 0.001, a, 1.3); out(og, 0.8, 0.3); }
  },
  // the Dealer's lead (VS): square stack, no 2f partial, darker fixed low-pass
  dlead(t, p, d, gn = 1) {
    const f = fq(p), len = Math.min(d * 0.8, 0.2), gg = gain(), lp = filt('lowpass', 2400, 0.8), k = 0.85 * gn;
    if (IS_MOBILE) { osc('square', f, t, len + 0.12).connect(lp); const sub = osc('square', f / 2, t, len + 0.12), sg = gain(0.25); sub.connect(sg); sg.connect(lp); }
    else { for (const det of [-9, 0, 9]) { const o = osc('square', f, t, len + 0.15); o.detune.value = det; o.connect(lp); } const sub = osc('square', f / 2, t, len + 0.15), sg = gain(0.3); sub.connect(sg); sg.connect(lp); }
    lp.connect(gg); const v = gg.gain; v.setValueAtTime(0, t); v.linearRampToValueAtTime(0.075 * k, t + 0.003);
    v.setValueAtTime(0.075 * k, t + len); v.linearRampToValueAtTime(0, t + len + 0.03); out(gg, IS_MOBILE ? 0.08 : 0.12, IS_MOBILE ? 0.08 : 0.16);
  },
  // arcade coin blip
  coin(t) {
    const o = osc('square', 988, t, 0.16), hp = filt('highpass', 300), gg = gain(); o.frequency.setValueAtTime(1319, t + 0.06); o.connect(hp); hp.connect(gg);
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.07, t + 0.002); gg.gain.setValueAtTime(0.07, t + 0.14); gg.gain.linearRampToValueAtTime(0, t + 0.16); out(gg, 0.1);
  },
  // pump-action rack: two clacks + a low thump
  rack(t) {
    const gg = gain(); out(gg, 0.15);
    for (const o of [0, 0.09]) { const n = noise(t + o, 0.04), bp = filt('bandpass', 1200, 2), ng = gain(); n.connect(bp); bp.connect(ng); env(ng, t + o, 0.001, 0.5, 0.04); ng.connect(gg); }
    const s = osc('sine', 90, t + 0.09, 0.06), sg = gain(); s.connect(sg); env(sg, t + 0.09, 0.001, 0.4, 0.05); sg.connect(gg);
  },
  // rimshot (on-beat lock)
  rim(t) {
    const gg = gain(); out(gg, 0.15);
    const n = noise(t, 0.03), bp = filt('bandpass', 1800, 4), ng = gain(); n.connect(bp); bp.connect(ng); env(ng, t, 0.001, 0.35, 0.03); ng.connect(gg);
    const o = osc('sine', 820, t, 0.025), og = gain(); o.connect(og); env(og, t, 0.001, 0.2, 0.025); og.connect(gg);
  },
  // shell placed in the row: G#6 ping (minor third of F), ~100 ms ring, measured on the reel
  place(t) {
    const f = fq(39), gg = gain(); out(gg, 0.25, 0.08);
    const o = osc('sine', f, t, 0.2), og = gain(); o.connect(og); env(og, t, 0.001, 0.16, 0.13); og.connect(gg);
    const o2 = osc('triangle', f * 2, t, 0.08), o2g = gain(); o2.connect(o2g); env(o2g, t, 0.001, 0.035, 0.05); o2g.connect(gg);
    const n = noise(t, 0.02), hp = filt('highpass', 6000), ng = gain(); n.connect(hp); hp.connect(ng); env(ng, t, 0.0005, 0.07, 0.012); ng.connect(gg);
  },
  // brass shell clink on every reveal
  clink(t) {
    const gg = gain(); out(gg, 0.3);
    for (const [f, a] of [[3150, 0.05], [4730, 0.03]]) { const o = osc('sine', f, t, 0.2), og = gain(); o.connect(og); env(og, t, 0.001, a, 0.18); og.connect(gg); }
  },
  // death sequence: revolver cylinder ratchet click
  ratchet(t, v = 1) {
    const n = noise(t, 0.03), bp = filt('bandpass', 3200, 3), gg = gain(); n.connect(bp); bp.connect(gg); env(gg, t, 0.0005, 0.45 * v, 0.022); out(gg, 0.2);
    const o = osc('sine', 180, t, 0.03), og = gain(); o.connect(og); env(og, t, 0.001, 0.25 * v, 0.025); out(og);
  },
  // heartbeat: lub-dub
  heart(t, v = 1) {
    for (const [o, a] of [[0, 1], [0.16, 0.7]]) { const s = osc('sine', 52, t + o, 0.2), sg = gain(); s.frequency.exponentialRampToValueAtTime(38, t + o + 0.15); s.connect(sg); env(sg, t + o, 0.008, 0.5 * v * a, 0.16); out(sg); }
  },
  // the screen breaking: a sharp crack, shards tinkling, a low thud
  glass(t) {
    const n = noise(t, 0.12), hp = filt('highpass', 2500), gg = gain(); n.connect(hp); hp.connect(gg); env(gg, t, 0.0005, 0.6, 0.09); out(gg, 0.4);
    for (let k = 0; k < 9; k++) { const tk = t + 0.03 + Math.random() * 0.45, o = osc('sine', 3000 + Math.random() * 4000, tk, 0.12), og = gain(); o.connect(og); env(og, tk, 0.001, 0.05, 0.1); out(og, 0.5); }
    V.kick(t, 0.9);
  },
  // the shot that kills: gunshot + sub drop + long dark tail
  boom(t) {
    V.gunshot(t); V.kick(t, 1.2);
    const s = osc('sine', 90, t, 2.2), sg = gain(); s.frequency.exponentialRampToValueAtTime(28, t + 1.8); s.connect(sg);
    const ws = C().createWaveShaper(); ws.curve = curveSoft; sg.connect(ws); const og = gain(); ws.connect(og); env(sg, t, 0.002, 0.9, 1.9); og.gain.value = 0.7; out(og, 0.4);
    const n = noise(t, 2.5), lp = filt('lowpass', 900, 0.5), ng = gain(); n.connect(lp); lp.connect(ng); env(ng, t, 0.01, 0.12, 2.3); out(ng, 0.6);
  },
  // Shepard copy (reel shell 7): soft triangle, loudness from the bell curve
  shep(t, p, d, gn = 1) { const o = osc('triangle', fq(p), t, d), gg = gain(); o.connect(gg); env(gg, t, 0.01, 0.16 * gn, d * 1.1); out(gg, 0.3); },
};
