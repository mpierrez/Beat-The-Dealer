/**
 * Game state, modes, leaderboard, title theme, screens and run logic. Ported from legacy/js/game.js;
 * DOM writes became `ui(...)` store updates that the React screens render. The ranked mode and the leaderboard are removed.
 */
import { COL, G, loadAt, LOADD, PRE, R, rnd, SCALES, SD, semis, fitOct, shuffle, store, withG, opt, IS_MOBILE } from './core';
import { ctx, initAudio, killRoute, menuLP, mkRoute, now, Route, routeTo, V, getBus } from './audio';
import { newGame } from './riffs';
import { drums, Layer, layers, schedule } from './layers';
import { ui, useUI } from '../ui/store';

// ---------- state ----------
export const st = {
  mode: 'title', i: 0, t0: 0, rev: false, guess: null as number | null, grid: [] as string[], pre: [] as Layer[], post: [] as Layer[],
  introT0: 0, paused: false, who: 'you' as 'you' | 'dlr', locked: 0, gamma: 1, lastPay: 0, lastM: 1,
  flashT: -9, flashCol: '', shakeT: -9, shakeAmp: 22, tint: [30, 60, 40, 0.5], tintTarget: [30, 60, 40, 0.5], perm: null as number[] | null, introFlash: 0,
};
export let run: any = null;   // the current run; null before the first run
const RUN_STATES = ['intro', 'reload', 'play', 'over'];
export const inRun = () => RUN_STATES.includes(st.mode);

// ---------- modes ----------
export const MODES: Record<string, { name: string; col: string; tag: string; rules: string[] }> = {
  classic: { name: 'CLASSIC', col: '#e8195a', tag: 'The reel. Count. Call. Cash in.', rules: ['8 shells: 4 live, 4 blank, shuffled.', 'Call each one before the trigger.', 'Long shots pay more. Streaks multiply.'] },
  survival: { name: 'SURVIVAL', col: '#ff3d6e', tag: "Dead man's magazine.", rules: ['Magazine after magazine. 3 hearts.', 'A miss costs a heart. A perfect magazine heals.', 'The lock creeps closer. The key keeps rising.'] },
  duel: { name: 'VS DEALER', col: '#b06cff', tag: 'One gun. Two players. Buckshot rules.', rules: ['LIVE shoots the Dealer. BLANK shoots you.', 'A blank on yourself: shoot again.', 'Only blanks left: new round. Take his 2 hearts.'] },
};
export const MODE_KEYS = ['classic', 'survival', 'duel'];

export const fmtD = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmtT = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
const roman = (s: number) => ['I', 'II', 'III'][s - 1] || String(s);

// ---------- title theme: Fm -> G♭ loop, kicks, glass bells (same voices as the game) ----------
export let theme: { route: Route; next: number; bar: number; pulse?: number } | null = null;
const THEME_G = { scale: SCALES[0].s, scaleTex: '', key: 0, shells: [], mag: [] }, THEME_PROG = [0, 1, 0, 5];
export function themeStart() {
  if (!ctx) initAudio();
  if (!ctx) return;
  if (theme) killRoute(theme.route);
  theme = { route: mkRoute(menuLP!, 0.9), next: (ctx.state === 'running' ? ctx.currentTime : 0) + 0.02, bar: 0 };
  themeMuffle(18000);
}
function themeStop(t?: number) { if (!theme) return; killRoute(theme.route, t); theme = null; }
export function themeMuffle(hz: number) {
  if (menuLP && ctx) { try { menuLP.frequency.cancelScheduledValues(ctx.currentTime); menuLP.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1); } catch { menuLP.frequency.value = hz; } }
}
export function themeTick() {
  if (!theme || !ctx || ctx.state !== 'running') return;
  const tc = ctx.currentTime;
  if (theme.next < tc) theme.next = tc + 0.02;
  while (theme.next < tc + 1.2) {
    const t = theme.next, b = theme.bar++, deg = THEME_PROG[b % 4], th = theme;
    withG(THEME_G as any, () => routeTo(th.route, () => {
      V.pad(t, deg, 2, 1.2);
      for (let k = 0; k < 4; k++) { V.kick(t + k * 0.5, k % 2 ? 0.5 : 1); if (b % 4 > 0) V.hat(t + k * 0.5 + 0.25, 0.5); }
      const T = [deg, deg + 2, deg + 4, deg + 7].map(d => semis(fitOct(d, 0, 6)));
      const pat = b % 2 ? [0, 1, 2, 3, 2, 1, 2, 3] : [3, 2, 1, 0, 1, 2, 1, 0];
      for (let k = 0; k < 8; k++) if (k % 2 === 0 || Math.random() < 0.45) V.bell(t + k * 0.25, T[pat[k]] + 12, 0.25, 0.6);
      if (b % 8 === 7) V.riser(t + 1, 1);
      if (b % 8 === 0 && b > 0) { V.dryfire(t); th.pulse = t; }
    }));
    theme.next += 2;
  }
}

// ---------- screens ----------
export let uiLock = 0;
function titleRender() {
  const pb = store.get('pb', {}) || {}, hi = Math.max(0, ...Object.values(pb).map(Number)), last = store.get('last', {}) || {};
  ui({ oneUp: '1UP ' + String(last.s || 0).padStart(6, '0'), hiScore: String(hi).padStart(6, '0'), credit: ctx ? '01' : '00' });
}
export function goTitle() { initAudio(); if (ctx && ctx.state !== 'running') void ctx.resume(); st.mode = 'title'; ui({ screen: 'title' }); if (!theme) themeStart(); themeMuffle(18000); titleRender(); hideGame(); }
export function goMenu() {
  initAudio(); void ctx!.resume(); uiLock = performance.now() + 400; if (st.mode === 'title') V.rack(now());
  st.mode = 'menu'; ui({ screen: 'menu' }); themeStart(); themeMuffle(2600); hideGame();
}
function hideGame() { ui({ ctrl: false, pauseBtn: false, mA: '', mB: '', mC: '' }); }
export function menuMove(d: number) {
  const idx = (useUI.getState().menuIdx + d + MODE_KEYS.length) % MODE_KEYS.length;
  ui({ menuIdx: idx, slide: d });
  setTimeout(() => ui({ slide: 0 }), 120);
  if (ctx) withG(THEME_G as any, () => V.lead(now() + 0.01, [0, 3, 7, 10][idx], 0.12, 0.6));
}
export function howOpen(thenPlay = false) { st.mode = 'how'; ui({ screen: 'how', howThenPlay: thenPlay }); themeMuffle(900); }
export function howClose() { const seen = store.get('seen', {}); seen.howto = 1; store.set('seen', seen); if (useUI.getState().howThenPlay) startRun(MODE_KEYS[useUI.getState().menuIdx]); else goMenu(); }
export function menuPlay() { if (!(store.get('seen', {}) || {}).howto) return howOpen(true); startRun(MODE_KEYS[useUI.getState().menuIdx]); }

// ---------- run ----------
export function startRun(mode: string) {
  initAudio(); void ctx!.resume();
  const tb = now() + 0.15; themeStop(tb);
  if (run) killRoute(run.route);
  run = {
    mode, route: mkRoute(getBus(), IS_MOBILE ? 0.7 : 0.85), sigma: 0, streak: 0, bestM: 1, correct: 0, calls: 0, shells: 0, onBeat: 0, maxW: 0, late: 0,
    hp: 3, hpMax: 3, k: 1, magOk: true, stage: 1, H: 2, hpD: 2, nextWho: 'you', hits: 0, extra: 0, round: 1, banner: '', shot: null, stageHurt: false, won: false, perfect: 0, lam: 32,
    cpuStep: null, cpuCall: null, segT0: 0, stageCard: false,
  };
  const last = store.get('last', {}) || {}; last.mode = mode; store.set('last', last);
  if (mode === 'survival') { run.hp = 3; run.hpMax = 3; newGame(3, 1 + rnd(2)); }
  else if (mode === 'duel') { run.H = 2; run.hp = 2; run.hpD = 2; newGame(3, 1); }
  else newGame(8, 4);
  ui({ screen: null, paused: false, pauseBtn: true, ctrl: false });
  startIntro(tb);
  hud();
}
/** the magazine loading animation + sound (the reel's opening); every new magazine plays it */
function startIntro(tb: number) {
  st.grid = []; st.i = 0; st.mode = 'intro'; st.paused = false; st.who = 'you'; st.rev = false; st.introT0 = tb; st.introFlash = 0; st.perm = null;
  ui({ ctrl: false });
  const t = tb, b = SD * 4;
  routeTo(run.route, () => {
    for (let k = 0; k < 9; k++) { V.kick(t + k * b, k % 4 === 0 ? 1 : 0.8); V.kick(t + k * b + b / 2, 0.3); }
    for (let k = 0; k < 3; k++) V.tick(t + 0.32 + k * 0.055, 0.6);                          // rattle
    for (let j = 0, n = G.mag.length; j < n; j++) V.place(t + loadAt(j) + LOADD);            // one ping per shell, on the sixteenths like the reel
    V.pad(t + 2.5, 0, 1.95, 1.2); V.riser(t + 3.5, 1); V.gunshot(t + 4.5);
  });
  hud();
}
export function counts() { const n = G.mag.length, i = st.i, L = G.mag.slice(i).reduce((a, b) => a + b, 0); return { n, L, left: n - i }; }
export function startShell(i: number, t0: number, who: 'you' | 'dlr' = 'you') {
  st.mode = 'play'; st.i = i; st.t0 = t0; st.rev = false; st.guess = null; st.who = who; st.locked = 0; st.gamma = 1; st.lastPay = 0;
  const res = G.mag[i]; st.pre = layers(i, 'pre', null, who); st.post = layers(i, 'post', res);
  routeTo(run.route, () => { schedule(st.pre, t0); drums(t0, 'pre'); });
  run.cpuStep = who === 'dlr' ? 8 + rnd(17) : null; run.cpuCall = null; run.cpuAt = null;
  run.lam = run.mode === 'survival' ? Math.max(16, run.k <= 3 ? 32 : run.k <= 5 ? 28 : run.k <= 7 ? 24 : 20) : 32;
  ui({ ctrl: true, disabled: false, bL: 'btn live' + (who === 'dlr' ? ' call think' : ''), bB: 'btn blank' + (who === 'dlr' ? ' call think' : '') });
  hud();
}
function onBeat(t: number) { const ph = ((t - st.t0) / SD) % 4; return ph < 0.07 || ph > 3.93; }
export function call(v: number) {
  if (st.mode !== 'play' || st.rev || st.guess !== null || st.who === 'dlr' || st.locked) return;
  const t = now(), step = (t - st.t0) / SD; if (step >= PRE) return;
  st.guess = v; st.gamma = onBeat(t) ? 1.25 : 1;
  const on = (v ? 'btn live' : 'btn blank') + ' on' + (st.gamma > 1 ? ' gold' : ''), off = (v ? 'btn blank' : 'btn live') + ' off';
  ui(v ? { bL: on, bB: off, disabled: true } : { bB: on, bL: off, disabled: true });
  if (st.gamma > 1) { V.rim(now()); setTimeout(() => { const s = useUI.getState(); ui(v ? { bL: s.bL.replace(' gold', '') } : { bB: s.bB.replace(' gold', '') }); }, 160); } else V.tick(now(), 1.5);
  hud();
}
export function lockButtons() { const s = useUI.getState(); ui({ disabled: true, bL: s.bL + ' off', bB: s.bB + ' off' }); }
const CPU_BLUNDER = [0.25, 0.12, 0];
export function cpuDecide() {
  const { L, left } = counts(), P = L / left;
  let c = P === 1 ? 1 : P === 0 ? 0 : P > 0.5 ? 1 : P < 0.5 ? 0 : Math.random() < 0.5 ? 1 : 0;
  if (P > 0 && P < 1 && Math.random() < CPU_BLUNDER[run.stage - 1]) c = Math.random() < 0.5 ? 1 : 0;
  run.cpuCall = c; run.cpuAt = (now() - st.t0) / SD; V.rim(now());
  // the dealer's pick shows on the buttons
  ui(c ? { bL: 'btn live on dlr', bB: 'btn blank off' } : { bB: 'btn blank on dlr', bL: 'btn live off' });
}
function payOf(v: number) { const { L, left } = counts(), K = v ? L : left - L; return K ? { w: left / K, K } : { w: 0, K: 0 }; }
function fx(kind: string) { ui({ mAfx: kind + ':' + performance.now() }); }
export function reveal() {
  st.rev = true; const i = st.i, res = G.mag[i], n = G.mag.length, v = st.guess, M = Math.min(8, 1 + run.streak), m = run.mode;
  routeTo(run.route, () => {
    schedule(st.post, st.t0); drums(st.t0, 'post', res);
    const tt = st.t0 + PRE * SD; if (res) V.gunshot(tt); else V.dryfire(tt); V.clink(tt);
  });
  const fl = opt.flash ? 1 : 0.3; st.flashT = now(); st.flashCol = res ? `rgba(255,190,200,${0.75 * fl})` : `rgba(170,215,240,${0.6 * fl})`;
  if (res) { st.shakeT = now(); st.shakeAmp = 22 * (0.6 + 0.1 * M) * (opt.shake ? 1 : 0); }
  const { w } = v === null ? { w: 0 } : payOf(v), ok = v !== null && v === res, dlrTurn = m === 'duel' && st.who === 'dlr';
  st.lastM = M; st.lastPay = 0;
  if (v !== null) run.calls++;
  if (ok) {
    const pay = Math.round(100 * w * st.gamma * M); st.lastPay = pay; run.sigma += pay; run.streak++; run.correct++; run.maxW = Math.max(run.maxW, w);
    if (st.gamma > 1) run.onBeat++; run.bestM = Math.max(run.bestM, Math.min(8, 1 + run.streak));
  } else if (!(dlrTurn && v === null)) run.streak = 0;
  if (v === null && !dlrTurn) run.late++;
  run.shells++;
  st.grid[i] = dlrTurn && v === null ? 'dlr' : v === null ? 'late' : ok ? 'ok' : 'bad';
  if (m === 'survival' && !ok) { run.hp--; run.magOk = false; fx('hurt'); }
  if (m === 'duel') {
    const you = st.who === 'you', c = you ? v : run.cpuCall;
    if (you && v === null) {
      // no call before the trigger: it costs a heart, and the gun goes to the dealer
      run.shot = { you, c: null, res, target: 'you', late: true, t: now() };
      run.hp--; run.stageHurt = true; fx('hurt'); run.nextWho = 'dlr';
    } else {
    run.shot = { you, c, res, target: (you ? c : !c) ? 'dlr' : 'you', t: now() };
    if (res && run.shot.target === 'dlr') { st.flashT = now(); st.flashCol = 'rgba(176,108,255,.55)'; }
    if (you) { if (c === 1) { if (res) { run.hpD--; run.hits++; run.sigma += 300 * run.stage; } run.nextWho = 'dlr'; } else if (res) { run.hp--; run.stageHurt = true; fx('hurt'); run.nextWho = 'dlr'; } else { run.extra++; run.sigma += 150 * run.stage; run.nextWho = 'you'; } }
    else { if (c === 1) { if (res) { run.hp--; run.stageHurt = true; fx('hurt'); } run.nextWho = 'you'; } else if (res) { run.hpD--; run.nextWho = 'you'; } else run.nextWho = 'dlr'; }
    }
  }
  if (m === 'classic' && i === n - 1 && st.grid.length === n && st.grid.every(x => x === 'ok')) { run.perfect = Math.round((8888 * n) / 8); run.sigma += run.perfect; }
  const s = useUI.getState();
  ui({ disabled: true, ...(v === null && !dlrTurn ? { bL: s.bL + ' late', bB: s.bB + ' late' } : {}) });
  hud();
}
export function afterShell(tn: number) {
  const n = G.mag.length, m = run.mode;
  if (m === 'survival') {
    if (run.hp <= 0) return over(tn, false);
    if (st.i < n - 1) return startShell(st.i + 1, tn, 'you');
    run.magBonus = 250 * run.k + (run.magOk ? 500 * run.k : 0); run.sigma += run.magBonus; run.healed = false;
    if (run.magOk && run.hp < run.hpMax) { run.hp++; run.healed = true; fx('heal'); routeTo(run.route, () => [12, 15, 19].forEach((p, k) => V.bell(tn + k * SD, p, 0.3, 0.7))); }
    run.k++; run.magOk = true; const nn = Math.min(8, run.k + 2); newGame(nn, 1 + rnd(nn - 1), { key: (run.k - 1) % 6 }); return startIntro(tn);
  }
  if (m === 'duel') {
    if (run.hp <= 0) return over(tn, false);
    if (run.hpD <= 0) { run.sigma += 5000 + 1000 * run.hp + (run.stageHurt ? 0 : 2000); return over(tn, true); }
    const rest = G.mag.slice(st.i + 1);
    if (rest.some(x => x)) return startShell(st.i + 1, tn, run.nextWho);
    // magazine empty, or only blanks left: next round with a fresh magazine
    run.round = (run.round || 1) + 1; run.banner = rest.length ? 'ONLY BLANKS LEFT' : 'MAGAZINE EMPTY';
    const nn = 2 + rnd(7); newGame(nn, 1 + rnd(nn - 1)); return startIntro(tn);
  }
  if (st.i < n - 1) return startShell(st.i + 1, tn, 'you');
  endRun();
}
/** death sequence timing (s after the fatal shell) */
export const DEATH = { stop: 1.45, bang: 2.1, end: 4.0 };
/** the dealer's death (VS DEALER win): eyes flicker until `out`, then the text, then black */
export const DEALER_DEATH = { out: 1.6, text: 2.0, end: 4.4 };
/** VS DEALER death: the screen breaks `after` sixteenths after the shot, results at `end` s */
export const QUICK_DEATH = { after: 4, end: 2.8 };
function over(t0: number, win: boolean) {
  st.mode = 'over'; run.segT0 = t0; run.won = win; ui({ ctrl: false });
  routeTo(run.route, () => {
    if (win) {
      // the dealer dies: slow heartbeat, his eyes crackle out, a thud, then the victory chord
      const { out, text } = DEALER_DEATH;
      for (const [o, v] of [[0.1, 0.9], [0.95, 0.6], [1.5, 0.35]]) V.heart(t0 + o, v);
      for (let k = 0; k < 9; k++) V.ratchet(t0 + 0.5 + Math.random() * (out - 0.5), 0.35 + Math.random() * 0.4);
      V.kick(t0 + out, 1.1);
      V.pad(t0 + text, 0, 2, 1.2); [12, 15, 19, 24].forEach((p, k) => V.bell(t0 + text + k * 0.25, p, 0.3, 0.7));
      return;
    }
    if (run.mode === 'duel') { V.glass(t0); return; }   // the dealer already fired: the screen breaks
    // russian roulette: heartbeat, the cylinder spins and slows click by click, hammer, BANG
    for (const [o, v] of [[0, 0.8], [0.62, 0.9], [1.2, 1], [1.72, 1]]) V.heart(t0 + o, v);
    let tt = t0 + 0.1; for (let k = 0; tt < t0 + DEATH.stop; k++) { V.ratchet(tt, 0.6 + 0.4 * Math.min(1, k / 12)); tt += 0.035 + 0.006 * k * k / 4; }
    V.rack(t0 + DEATH.stop + 0.25);
    V.boom(t0 + DEATH.bang);
  });
  run.cracks = null;
  hud();
}
function grade() {
  const m = run.mode, c = run.correct, n = G.mag.length;
  if (m === 'survival') { const k = run.k; return k >= 10 ? 'S' : k >= 7 ? 'A' : k >= 5 ? 'B' : k >= 3 ? 'C' : 'D'; }
  if (m === 'duel') return run.won ? 'S' : run.stage >= 3 ? 'A' : run.stage === 2 ? 'B' : run.hits > 0 ? 'C' : 'D';
  return c === n ? 'S' : c >= n - 1 ? 'A' : c >= 0.75 * n ? 'B' : c >= 0.5 * n ? 'C' : 'D';
}
function quip() {
  const m = run.mode, c = run.correct, n = G.mag.length;
  if (m === 'survival') { const k = run.k; return k >= 10 ? 'THE DEALER RAN OUT OF SHELLS.' : k >= 7 ? 'THE DEALER IS SWEATING.' : k >= 4 ? 'THE DEALER RELOADS.' : 'THE DEALER WINS.'; }
  if (m === 'duel') return run.won ? 'YOU BEAT THE DEALER. HE WANTS A REMATCH.' : 'THE DEALER WILL SEE YOU AGAIN.';
  return c === n ? 'YOU BEAT THE DEALER.' : c >= 0.75 * n ? 'THE DEALER IS SWEATING.' : c >= 0.5 * n ? 'COIN FLIP ENERGY.' : 'THE DEALER WINS.';
}
export function endRun() {
  const m = run.mode; st.mode = 'results'; killRoute(run.route, now() + 1.5);
  const pb = store.get('pb', {}) || {}, best = run.sigma > (pb[m] || 0); if (best) { pb[m] = run.sigma; store.set('pb', pb); }
  const last = store.get('last', {}) || {}; last.s = run.sigma; store.set('last', last);
  const gr = grade(), gc = { S: '#ffd84a', A: '#e8195a', B: '#7ef2ff', C: '#f4f4f2', D: '#6f8578' }[gr]!;
  let rows: [string, any][];
  if (m === 'survival') rows = [['MAGAZINE', run.k], ['SHELLS', run.shells], ['CORRECT', run.correct], ['BEST STREAK', '×' + run.bestM], ['ON BEAT', run.onBeat]];
  else if (m === 'duel') rows = [['STAGE', roman(run.stage) + (run.won ? ' ★' : '')], ['DEALER HITS', run.hits], ['EXTRA TURNS', run.extra], ['CALLS', `${run.correct}/${run.calls}`], ['BEST STREAK', '×' + run.bestM]];
  else rows = ([['CORRECT', `${run.correct}/${G.mag.length}`], ['ON BEAT', run.onBeat], ['BEST STREAK', '×' + run.bestM], ['LONGEST SHOT', '×' + run.maxW.toFixed(2)]] as [string, any][]).concat(run.perfect ? [['PERFECT', '+' + fmtD(run.perfect)]] : []);
  ui({
    screen: 'results', ctrl: false, pauseBtn: false,
    rMode: MODES[m].name, rScore: fmtD(run.sigma), rGrade: gr, rGradeColor: gc, rQuip: quip(), rStats: rows.map(([a, b]) => [a, String(b)]),
    rBits: [...G.mag], rNew: best && run.sigma > 0,
  });
  const t = now(); if (gr === 'S') V.gunshot(t + 0.05); else V.rack(t + 0.05);
  themeStart(); themeMuffle(2600);
}
export function resultsMain() { startRun(run.mode); }

// ---------- HUD: the math block is the whole in-game interface ----------
const CR = '#ff3d6e', CC = '#7ef2ff', OKC = '#6dffa0', BADC = '#ff6b6b', DIM = '#2b3a32', VIO = '#b06cff';
const tc = (c: string, s: string) => `\\textcolor{${c}}{${s}}`;
const hearts = (h: number, m: number, c: string) => (h > 0 ? tc(c, '\\heartsuit'.repeat(h)) : '') + (m - h > 0 ? tc(DIM, '\\heartsuit'.repeat(m - h)) : '');
const magT = (L: number, B: number) => `${L}\\,${tc(CR, '\\mathrm{L}')} + ${B}\\,${tc(CC, '\\mathrm{B}')}`;
const fmtW = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));
export function hud() {
  if (!run) return;
  const m = run.mode, M = Math.min(8, 1 + run.streak), sig = `\\Sigma = ${fmtT(run.sigma)}`; let A = '', B = '', C = '';
  const YS = () => `\\text{YOU}\\;${hearts(run.hp, run.H, CR)}`, DS = () => `${hearts(run.hpD, run.H, VIO)}\\;\\text{DLR}`;
  const patch: any = {};
  if (st.mode === 'intro' || st.mode === 'reload') {
    const n = G.mag.length, L = G.mag.reduce((a, b) => a + b, 0), mag = magT(L, n - L);
    if (m === 'survival') {
      A = `${hearts(run.hp, run.hpMax, CR)}\\quad \\text{mag}_{${run.k}} = ${mag}`; B = `\\text{key: } ${G.scaleTex},\\quad f_{\\text{out}} = f\\cdot 2^{\\,s}`;
      C = run.k > 1 ? `\\Sigma \\mathrel{+}= ${fmtT(run.magBonus || 0)}${run.healed ? '\\qquad ' + tc(OKC, '\\heartsuit + 1') : ''}\\qquad ${sig}` : `${sig}\\qquad \\times ${M}`;
    } else if (m === 'duel') {
      A = `\\text{ROUND ${run.round}}${run.banner ? `\\text{: ${run.banner.toLowerCase()}}` : ''}`; B = `\\text{mag} = ${mag}`;
    } else { A = `\\text{mag} = ${mag}`; B = `\\text{this game: } ${G.scaleTex},\\quad f_{\\text{out}} = f\\cdot 2^{\\,s}`; C = `${sig}\\qquad \\times 1`; }
  } else if (st.mode === 'play' || st.mode === 'over') {
    const sh = G.shells[st.i], { L, left } = counts(), res = G.mag[st.i], v = st.guess, dlr = st.who === 'dlr';
    const form = sh.formula || 'd_n = n^2 \\bmod 8 \\in \\{0, 1, 4\\}';
    const nTex = sh.notesTex || '\\text{note} = \\text{scale}[d_n] : F, G\\flat, C, G\\flat';
    if (m === 'survival') A = `${hearts(run.hp, run.hpMax, CR)}\\qquad ${form}`;
    else A = form;
    B = nTex;
    let gain = '';
    if (st.rev && v !== null) gain = v === res ? `\\qquad ${tc(OKC, '+' + fmtT(st.lastPay))}` : `\\qquad ${tc(BADC, '+0')}`;
    if (!st.rev) C = 'f_{\\text{out}} = f\\cdot 2^s, \\quad s = ?';
    else C = res ? `f_{\\text{out}} = f\\cdot 2^s, \\quad s = -2 \\quad (${tc(CR, '\\text{LIVE}')})${gain}` : `f_{\\text{out}} = f\\cdot 2^s, \\quad s = +1 \\quad (${tc(CC, '\\text{BLANK}')})${gain}`;
    if (m === 'survival' && st.rev && !(v !== null && v === res)) C += `\\quad ${tc(CR, '\\heartsuit - 1')}`;
    if (st.mode === 'over') {
      if (m === 'duel') C = run.won ? `\\heartsuit_{\\text{DLR}} = 0\\;\\Rightarrow\\;\\text{YOU WIN}` : `\\heartsuit_{\\text{YOU}} = 0\\;\\Rightarrow\\;\\lim_{t\\to\\infty} y(t) = 0`;
      else if (m === 'survival') C = `\\heartsuit = 0\\;\\Rightarrow\\;\\lim_{t\\to\\infty} y(t) = 0`;
    }
    // button small lines: payout multipliers (no words)
    if (st.mode === 'play') {
      const wl = L ? left / L : 0, wb = left - L ? left / (left - L) : 0, fxw = (w: number) => (w ? '×' + fmtW(w) : '×—');
      let sl = fxw(wl), sb = fxw(wb);
      if (st.rev) {
        const okL = v === 1 && res === 1, okB = v === 0 && res === 0;
        if (v === null) sl = sb = dlr ? '' : '∅';
        else if (v === 1) sl = okL ? '✓ +' + fmtD(st.lastPay) : '✗'; else sb = okB ? '✓ +' + fmtD(st.lastPay) : '✗';
      } else if (st.locked && v === null) sl = sb = '—';
      patch.sL = sl; patch.sB = sb;
    }
  }
  if (st.mode === 'over') A = B = C = '';   // the death scenes own the screen
  const cur = useUI.getState();
  if (cur.mA !== A) patch.mA = A; if (cur.mB !== B) patch.mB = B; if (cur.mC !== C) patch.mC = C;
  if (patch.sL === cur.sL) delete patch.sL; if (patch.sB === cur.sB) delete patch.sB;
  if (Object.keys(patch).length) ui(patch);
}

// ---------- pause ----------
export function pauseGame() { if (st.paused || !inRun()) return; st.paused = true; if (ctx) void ctx.suspend(); ui({ paused: true, pauseNote: '' }); }
export function resumeGame() {
  if (!st.paused) return;
  // unpause once the audio clock runs again, so the game never sees a time jump
  const go = () => { st.paused = false; ui({ paused: false }); };
  if (ctx) ctx.resume().then(go, go); else go();
}
export function restartGame() { st.paused = false; ui({ paused: false }); if (run) killRoute(run.route); if (ctx) void ctx.resume(); startRun(run.mode); }
export function quitGame() { st.paused = false; ui({ paused: false }); if (run) killRoute(run.route); if (ctx) void ctx.resume(); st.tintTarget = [30, 55, 40, 0.45]; goMenu(); }

export { COL, R, shuffle };
