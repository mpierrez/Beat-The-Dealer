/**
 * Canvas drawing and the per-frame loop. Ported from legacy/js/render.js.
 * Added: the Shepard layer (4 octave copies, loudness as opacity) for the reel's shell 7.
 * `frame()` advances the run and returns the screen effects for the Stage component to apply.
 */
import { COL, CX, G, GX0, GX1, GXT, GY0, GY1, INTRO, IS_MOBILE, LOAD0, LOADD, LOADG, loadAt, Note, opt, POST, PRE, SD, shuffle, X, Y } from './core';
import { now } from './audio';
import { afterShell, cpuDecide, DEALER_DEATH, DEATH, endRun, QUICK_DEATH, hud, lockButtons, reveal, run, st, startShell, theme, themeTick } from './game';
import type { Layer } from './layers';

let g: CanvasRenderingContext2D;
export const setCanvas = (c: HTMLCanvasElement) => { g = c.getContext('2d')!; };
/** draw into another 2D context (menu vignettes) with the same helpers */
export function onCtx<T>(c: CanvasRenderingContext2D, fn: () => T): T { const old = g; g = c; try { return fn(); } finally { g = old; } }

// ---------- drawing ----------
function rr(x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function drawShell(cx: number, top: number, w: number, h: number, kind: string, glow = 0, alpha = 1) {
  g.save(); g.globalAlpha = alpha;
  const bh = h * 0.2, body = h - bh;
  const c = kind === 'live' ? ['#ff4a68', '#c8102e', '#ff2d55'] : kind === 'blank' ? ['#8fe8ff', '#2aa6e0', '#5fd8ff'] : ['#3c4d44', '#1d2822', '#2e3d35'];
  if (glow) { g.shadowColor = c[2]; g.shadowBlur = 24 * glow; }
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); gr.addColorStop(0, c[1]); gr.addColorStop(0.35, c[0]); gr.addColorStop(1, c[1]);
  g.fillStyle = gr; rr(cx - w / 2, top, w, body, w * 0.18); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(1, w / 30);
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * w * 0.14, top + 2); g.lineTo(cx + k * w * 0.12, top + body * 0.12); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.12)'; for (let yy = top; yy < top + body; yy += 3) g.fillRect(cx - w / 2, yy, w, 1);
  const bg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); bg.addColorStop(0, '#9a7420'); bg.addColorStop(0.4, '#f3d27a'); bg.addColorStop(1, '#8a6416');
  g.fillStyle = bg; rr(cx - w / 2 - w * 0.06, top + body, w * 1.12, bh, w * 0.08); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - w / 2 - w * 0.06, top + body + bh * 0.45, w * 1.12, Math.max(1, bh * 0.1));
  if (kind === 'unknown') { g.fillStyle = '#7be0a3'; g.font = `700 ${Math.round(w * 0.75)}px "Barlow Semi Condensed"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, top + body * 0.45); }
  g.restore();
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function background(t: number) {
  const tt = st.tint, tg = st.tintTarget; for (let k = 0; k < 4; k++) tt[k] = lerp(tt[k], tg[k], 0.06);
  g.fillStyle = '#050806'; g.fillRect(0, 0, 720, 1280);
  const rg = g.createRadialGradient(360, 640, 40, 360, 640, 820);
  rg.addColorStop(0, `rgba(${tt[0] | 0},${tt[1] | 0},${tt[2] | 0},${tt[3]})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 720, 1280);
  g.strokeStyle = 'rgba(120,160,130,.05)'; g.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(GXT, 668, 150, 60, (k * Math.PI) / 3 + t * 0.05, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(90,150,110,.13)'; g.lineWidth = 1;
  for (let x = GX0; x <= GX1 + 1; x += 35) { g.beginPath(); g.moveTo(x, GY0); g.lineTo(x, GY1); g.stroke(); }
  g.font = '600 15px "Barlow Semi Condensed"'; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let o = 1; o <= 5; o++) {
    const y = 781 - 71 * (o - 1); g.fillStyle = 'rgba(110,170,130,.45)'; g.fillText('F' + o, 30, y);
    g.strokeStyle = 'rgba(90,150,110,.07)'; g.beginPath(); g.moveTo(GX0, y); g.lineTo(GX1, y); g.stroke();
  }
}
function axes(showTrig: boolean, trigDash: number) {
  g.strokeStyle = 'rgba(150,140,200,.7)'; g.fillStyle = 'rgba(150,140,200,.8)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(68, 668); g.lineTo(645, 668); g.stroke();
  g.beginPath(); g.moveTo(652, 668); g.lineTo(640, 662); g.lineTo(640, 674); g.fill();
  if (!showTrig) return;
  g.beginPath(); g.moveTo(GXT, GY1); g.lineTo(GXT, GY0 + 4); g.stroke();
  g.beginPath(); g.moveTo(GXT, GY0 - 4); g.lineTo(GXT - 6, GY0 + 8); g.lineTo(GXT + 6, GY0 + 8); g.fill();
  g.font = '700 13px "Barlow Semi Condensed"'; g.textAlign = 'center'; g.fillStyle = st.rev ? (G.mag[st.i] ? '#ff6b8a' : '#9aeaff') : '#f2b25c'; g.fillText('TRIGGER', GXT, GY0 - 12);
  if (trigDash > 0) { g.save(); g.setLineDash([5, 5]); g.strokeStyle = `rgba(255,170,90,${trigDash})`; g.lineWidth = 2; g.beginPath(); g.moveTo(GXT, GY0 + 10); g.lineTo(GXT, GY1); g.stroke(); g.restore(); }
}
function glowStroke(col: string, w = 3, alpha = 1) {
  g.globalAlpha = alpha; g.shadowColor = col; g.shadowBlur = 16; g.strokeStyle = col; g.lineWidth = w; g.stroke();
  g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.1; g.stroke(); g.globalAlpha = 1;
}
function dot(x: number, y: number, col: string, r = 7, a = 1) { g.globalAlpha = a; g.shadowColor = col; g.shadowBlur = 22; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1; }
function drawLayer(l: Layer, cur: number, colOverride: string | null, labels: boolean) {
  if (l.mode === 'none') return null;
  const col = COL[colOverride || l.col!] || COL.y;
  const vis = l.notes.filter(n => n.s <= cur); if (!vis.length) return null;
  let head: [number, number] | null = null;
  if (l.mode === 'step' || l.mode === 'reese') {
    const passes = l.mode === 'reese' ? 2 : 1;
    for (let ps = 0; ps < passes; ps++) {
      g.beginPath(); let prevY: number | null = null, prevE = 0;
      for (const n of vis) {
        const e = Math.min(n.s + n.d, cur), x1 = X(n.s), x2 = X(e);
        let y = Y(n.p); if (ps) y += 2 + (1 + (5 * (n.s % 32)) / 32) * (l.wide ? 2.4 : 1.1) * ((n.s % 4) / 4 + 0.6);
        if (prevY === null) g.moveTo(x1, y); else { g.lineTo(x1, prevY + (l.mode === 'step' ? 4 : 0)); g.lineTo(x1, y); }
        g.lineTo(x2, y); prevY = y; prevE = n.s + n.d; head = [x2, y];
      }
      glowStroke(col, ps ? 1.6 : 3, ps ? 0.75 : 1);
    }
    if (l.mode === 'reese' && head) {
      const n = vis[vis.length - 1]; g.font = '600 13px "Barlow Semi Condensed"'; g.fillStyle = col; g.textAlign = 'left';
      g.fillText(`Δf = ${(1 + (5 * (n.s % 32)) / 32 + (l.wide ? 4 : 0)).toFixed(1)} Hz`, head[0] - 30, head[1] - 16);
    }
  } else if (l.mode === 'dash') {
    for (const n of vis) {
      const e = Math.min(n.s + n.d, cur), x1 = X(n.s), x2 = X(e), y = Y(n.p); g.beginPath();
      if (l.thin) { g.moveTo(x1, y); g.lineTo(x2, y); glowStroke(col, 2, 0.8); }
      else { g.moveTo(x1 - 3, y + 9); g.lineTo(x1, y + 9); g.lineTo(x1, y); g.lineTo(x2, y); if (e >= n.s + n.d) { g.lineTo(x2, y + 9); g.lineTo(x2 + 3, y + 9); } glowStroke(col, 3); }
      head = [x2, y];
    }
  } else if (l.mode === 'spike') {
    g.beginPath(); let prevY: number | null = null, prevE = 0;
    for (const n of vis) {
      const e = Math.min(n.s + n.d, cur), x1 = X(n.s), x2 = X(e), y = Y(n.p), pk = Y(n.p + 20);
      if (prevY === null) g.moveTo(x1, pk); else g.lineTo(x1, prevY);
      g.lineTo(x1, pk); const w = x2 - x1;
      for (let k = 1; k <= 10; k++) { const f = k / 10; g.lineTo(x1 + Math.min(w, 7) * f, lerp(pk, y, 1 - Math.exp(-4 * f))); }
      g.lineTo(x2, y); prevY = y; prevE = n.s + n.d; head = [x2, y];
    }
    glowStroke(col, 2.6);
  } else if (l.mode === 'shep') {
    // 4 octave copies; loudness = opacity; a copy wrapping from the bottom to the top breaks its line
    const heads: [number, number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const ns = vis.filter(n => n.k === k); let prev: number | null = null;
      for (const n of ns) {
        const e = Math.min(n.s + n.d, cur), x1 = X(n.s), x2 = X(e), y = Y(n.p); g.beginPath();
        if (prev !== null && Math.abs(prev - y) < 40) { g.moveTo(x1, prev); g.lineTo(x1, y); } else g.moveTo(x1, y);
        g.lineTo(x2, y); glowStroke(col, 2.6, 0.12 + 0.88 * (n.g ?? 1)); prev = y;
        if (n === ns[ns.length - 1]) heads.push([x2, y, n.g ?? 1]);
      }
    }
    for (const h of heads) dot(h[0], h[1], col, 5, 0.25 + 0.75 * h[2]);
    return null;
  } else if (l.mode === 'flat') {
    const n = l.notes[0], e = Math.min(n.s + n.d, cur), y = Y(n.p); g.beginPath(); g.moveTo(X(n.s), y); g.lineTo(X(e), y); glowStroke(col, 2.4); return null;
  }
  if (labels) {
    g.font = '700 16px "Barlow Semi Condensed"'; g.textAlign = 'center'; g.fillStyle = col;
    vis.forEach(n => { if (n.lab == null || cur < n.s + 0.4) return; const x = (X(n.s) + X(Math.min(n.s + n.d, cur))) / 2; g.fillText(String(n.lab), x, Y(n.p) - 14); });
  }
  return head ? { x: head[0], y: head[1], col } : null;
}
function ticks(Ls: Layer[], cur: number) {
  for (const l of Ls) {
    if (l.mode === 'none') continue;
    for (const n of l.notes) {
      if (n.s > cur || (n.k ?? 0) > 0) continue;
      const x = X(n.s), h = 5 + ((n.p + 40) % 9) * 1.6, latest = cur - n.s < 1.2;
      g.fillStyle = latest ? 'rgba(140,255,180,.95)' : 'rgba(70,190,120,.55)'; g.fillRect(x, 826 - h - (latest ? 6 : 0), 2, h + (latest ? 6 : 0));
    }
  }
}
// shell row: revealed shells coloured, current one framed (amber = you, violet = Dealer), pop on reveal
const ROW = { sp: 46, w: 26, h: 64, top: 300 }, rowX = (j: number, n: number) => CX + (j - (n - 1) / 2) * ROW.sp;
const BAR: Record<string, string> = { ok: '#6dffa0', bad: '#ff6b6b', late: '#ffb347', dlr: '#b06cff' };
function topRow(t: number) {
  const n = G.mag.length, { w, h, top } = ROW, amn = run && run.amnesia, play = st.mode === 'play', kt = t - (st.t0 + PRE * SD);
  for (let j = 0; j < n; j++) {
    const cx = rowX(j, n); let kind = 'unknown', gl = 0, dy = 0;
    if ((j < st.i && !amn) || (j === st.i && st.rev)) kind = G.mag[j] ? 'live' : 'blank';
    if (j === st.i && play) {
      gl = st.rev ? 1.4 : 0;
      if (st.rev && kt >= 0 && kt < 0.5) dy = -14 * Math.exp(-6 * kt) * Math.cos(10 * kt);
      if (!st.rev) {
        g.save(); const fc = st.who === 'dlr' ? BAR.dlr : '#f0b13a'; g.shadowColor = st.who === 'dlr' ? BAR.dlr : '#ffb52e'; g.shadowBlur = 18 + 6 * Math.sin(t * 8);
        g.strokeStyle = fc; g.lineWidth = 2.5; rr(cx - w / 2 - 6, top - 6, w + 12, h + 12, 6); g.stroke(); g.restore();
      }
    }
    drawShell(cx, top + dy, w, h, kind, gl, play && j > st.i ? 0.75 : 1);
  }
}
/**
 * "100 %" then "IT'S LIVE." as in the reel (measured frame by frame): "100 %" pops in over ~0.1 s
 * one beat into the shell with a text cursor under it, then the line is typed ~0.05 s per letter.
 * The game's LIVE red (or BLANK cyan), darker outline, glow.
 */
function certain(step: number, live: boolean) {
  const T = step * SD, t1 = 0.55, t2 = 1.15; if (T < t1) return;
  const [fill, edge, glow] = live ? [COL.r, '#5a0018', COL.r] : [COL.c, '#0b4a58', COL.c];
  const x0 = 388, k = Math.min(1, (T - t1) / 0.1), sc = 1.12 - 0.12 * k;
  g.save(); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const paint = (txt: string, x: number, y: number) => { g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = fill; g.fillText(txt, x, y); g.shadowBlur = 0; g.strokeStyle = edge; g.lineWidth = 2.5; g.strokeText(txt, x, y); };
  g.globalAlpha = k; g.save(); g.translate(x0, 604); g.scale(sc, sc); g.font = '800 94px "Barlow Semi Condensed"'; paint('100 %', 0, 0); g.restore();
  g.font = '700 40px "Barlow Semi Condensed"';
  const line = live ? "IT'S LIVE." : "IT'S BLANK.", n = T < t2 ? 0 : Math.min(line.length, 1 + Math.floor((T - t2) / 0.05));
  if (n) paint(line.slice(0, n), x0 + 34, 656); else { g.fillStyle = fill; g.shadowColor = glow; g.shadowBlur = 10; g.fillRect(x0 + 36, 626, 6, 30); }
  g.restore();
}
/** "50 % CHANCE IT'S LIVE" under the magazine; when the answer is certain, "100 % IT'S LIVE." in big letters, like the reel */
function chance(step: number) {
  if (!run || run.amnesia) return;
  const n = G.mag.length, left = n - st.i, live = G.mag.slice(st.i).reduce((a, b) => a + b, 0), P = Math.round((100 * live) / left);
  g.save(); g.textBaseline = 'alphabetic'; g.font = '700 24px "Barlow Semi Condensed"';
  const a = `${P} %`, b = "  CHANCE IT'S LIVE", wa = g.measureText(a).width, wb = g.measureText(b).width, x0 = CX - (wa + wb) / 2;
  g.textAlign = 'left'; g.fillStyle = COL.r; g.fillText(a, x0, 408); g.fillStyle = '#e8ece9'; g.fillText(b, x0 + wa, 408);
  if ((P === 100 || P === 0) && st.mode === 'play' && !st.rev) certain(step, !!P);
  g.restore();
}
/** VS DEALER: hearts of both players, whose turn it is, the dealer's call and who got shot */
const VIO = '#b06cff', YOUC = '#ffb52e';
function duelHud(t: number, step: number) {
  if (!run || run.mode !== 'duel') return;
  const play = st.mode === 'play', you = st.who === 'you', sh = run.shot, kt = sh ? t - sh.t : 9;
  g.save(); g.textBaseline = 'alphabetic';
  // hearts, the side whose turn it is glows
  const side = (x: number, name: string, hp: number, col: string, active: boolean, hit: boolean) => {
    g.textAlign = 'center'; g.globalAlpha = active || !play ? 1 : 0.45; g.shadowColor = col; g.shadowBlur = active ? 18 + 6 * Math.sin(t * 6) : 0;
    g.font = '700 30px "Barlow Semi Condensed"'; g.fillStyle = col; g.fillText(name, x, 196);
    g.font = '700 38px "Barlow Semi Condensed"';
    for (let j = 0; j < run.H; j++) {
      const hx = x + (j - (run.H - 1) / 2) * 40, lost = j >= hp, justLost = hit && j === hp && kt < 0.9;
      g.fillStyle = lost ? '#2b3a32' : col; let sc = 1, dx = 0;
      if (justLost) { const e = 1 - kt / 0.9; sc = 1 + 0.8 * e; dx = (Math.random() - 0.5) * 12 * e; g.fillStyle = '#fff'; g.globalAlpha = 0.4 + 0.6 * e; }
      g.save(); g.translate(hx + dx, 240); g.scale(sc, sc); g.fillText('♥', 0, 0); g.restore(); g.globalAlpha = active || !play ? 1 : 0.45;
    }
  };
  const hitYou = !!(sh && (sh.late || (sh.res && sh.target === 'you'))), hitDlr = !!(sh && sh.res && sh.target === 'dlr');
  side(150, 'YOU', run.hp, YOUC, play && you, hitYou);
  side(570, 'DEALER', run.hpD, VIO, play && !you, hitDlr);
  g.shadowBlur = 0; g.globalAlpha = 1;
  dealer(t, step);
  g.shadowBlur = 0; g.globalAlpha = 1; g.textAlign = 'center';
  if (play && !st.rev) {
    g.font = '800 30px "Barlow Semi Condensed"';
    if (you) {
      g.fillStyle = YOUC; g.fillText('YOUR TURN', CX, 52);
    } else if (run.cpuCall === null) {
      g.fillStyle = VIO; g.fillText("DEALER'S TURN", CX, 52);
      g.font = '600 20px "Barlow Semi Condensed"'; g.fillStyle = '#d9c6ff'; g.fillText('thinking' + '.'.repeat(1 + (Math.floor(t * 3) % 3)), CX, 80);
    } else {
      g.fillStyle = VIO; g.fillText("DEALER'S TURN", CX, 52);
      g.font = '700 22px "Barlow Semi Condensed"'; g.fillStyle = run.cpuCall ? COL.r : COL.c;
      g.fillText(run.cpuCall ? 'DEALER CALLS LIVE' : 'DEALER CALLS BLANK', CX, 80);
    }
  }
  // after the trigger: what happened, at the top between the two players
  if (play && st.rev && sh) {
    const shooterIsTarget = (sh.you && sh.target === 'you') || (!sh.you && sh.target === 'dlr');
    const [a, b, c] = sh.late ? ['TOO LATE!', '♥ − 1', COL.r] : sh.res
      ? sh.target === 'dlr' ? ['DEALER HIT!', '♥ − 1', VIO] : ["YOU'RE HIT!", '♥ − 1', COL.r]
      : shooterIsTarget ? ['CLICK.', sh.you ? 'PLAY AGAIN' : 'DEALER PLAYS AGAIN', COL.c] : ['CLICK.', 'MISSED', COL.c];
    const k = Math.min(1, kt / 0.12), sc = 1 + 0.6 * (1 - k);
    g.shadowColor = c; g.shadowBlur = 22; g.fillStyle = c;
    g.save(); g.translate(CX, 56); g.scale(sc, sc); g.font = '800 40px "Barlow Semi Condensed"'; g.fillText(a, 0, 0); g.restore();
    g.font = '700 20px "Barlow Semi Condensed"'; g.fillText(b, CX, 84);
  }
  g.restore();
}
/**
 * Death: russian roulette. The cylinder spins and slows down one chamber per click (the clicks are
 * the same schedule as the sound), stops with the live round on top, the hammer cocks, BANG.
 */
const CLICKS = (() => { const c: number[] = []; let tt = 0.1; for (let k = 0; tt < DEATH.stop; k++) { c.push(tt); tt += 0.035 + 0.006 * k * k / 4; } return c; })();
function cylinder(T: number, cx: number, cy: number, R: number) {
  // angle in chambers: one per click, eased between clicks
  let k = 0; while (k < CLICKS.length && CLICKS[k] <= T) k++;
  let pos = k;
  if (k > 0 && k < CLICKS.length) { const f = (T - CLICKS[k - 1]) / (CLICKS[k] - CLICKS[k - 1]); pos = k - 1 + (1 - (1 - f) ** 3); }
  const K = CLICKS.length, live = K % 6, ang = -Math.PI / 2 + (pos * Math.PI) / 3;
  g.save(); g.translate(cx, cy);
  // frame + barrel mark
  g.fillStyle = '#1a1d1c'; g.strokeStyle = '#8a9590'; g.lineWidth = 4; g.shadowColor = '#000'; g.shadowBlur = 30;
  g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#c9d3ce'; g.beginPath(); g.moveTo(0, -R - 6); g.lineTo(-14, -R - 30); g.lineTo(14, -R - 30); g.closePath(); g.fill();
  for (let j = 0; j < 6; j++) {
    const a = ang - (j * Math.PI) / 3, x = Math.cos(a) * R * 0.58, y = Math.sin(a) * R * 0.58, isLive = j === live;
    g.beginPath(); g.arc(x, y, R * 0.24, 0, 7); g.fillStyle = '#050606'; g.fill(); g.strokeStyle = '#59625e'; g.lineWidth = 3; g.stroke();
    if (isLive) { g.fillStyle = COL.r; g.shadowColor = COL.r; g.shadowBlur = 20; g.beginPath(); g.arc(x, y, R * 0.16, 0, 7); g.fill(); g.fillStyle = '#e4b54a'; g.beginPath(); g.arc(x, y, R * 0.07, 0, 7); g.fill(); g.shadowBlur = 0; }
  }
  g.fillStyle = '#3b4340'; g.beginPath(); g.arc(0, 0, R * 0.12, 0, 7); g.fill();
  g.restore();
}
function death(T: number) {
  // VS DEALER: no roulette, the dealer's shot breaks the screen at once (QUICK_DEATH)
  const quick = run.mode === 'duel', { stop } = DEATH, bang = quick ? 0 : DEATH.bang, end = quick ? QUICK_DEATH.end : DEATH.end;
  g.save();
  if (!quick) { g.fillStyle = `rgba(0,0,0,${T >= bang ? 1 : Math.min(0.88, T / 0.35)})`; g.fillRect(0, 0, 720, 1280); }
  if (T < bang) {
    const pre = Math.max(0, (T - stop) / (bang - stop)), sc = 0.85 + 0.15 * Math.min(1, T / 0.25) + 0.12 * pre * pre;
    const jx = pre > 0 ? (Math.random() - 0.5) * 5 * pre : 0, jy = pre > 0 ? (Math.random() - 0.5) * 5 * pre : 0;
    g.globalAlpha = Math.min(1, T / 0.2);
    cylinder(T, CX + jx, 600 + jy, 150 * sc);
    g.globalAlpha = 1; g.textAlign = 'center'; g.font = '700 30px "Barlow Semi Condensed"'; g.fillStyle = '#e8ece9';
    if (T > 0.3) g.fillText('LAST HEART.', CX, 360);
  } else {
    if (!run.cracks) {
      st.flashT = now(); st.flashCol = 'rgba(255,255,255,.95)'; st.shakeT = now(); st.shakeAmp = 70;
      const cracks: number[][][] = [];
      for (let i = 0; i < 14; i++) {
        let a = (i / 14) * Math.PI * 2 + Math.random() * 0.3, x = CX, y = 600; const pts = [[x, y]];
        for (let j = 0; j < 7; j++) { a += (Math.random() - 0.5) * 0.7; const l = 40 + Math.random() * 90; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
        cracks.push(pts);
      }
      run.cracks = cracks;
    }
    const D = T - bang, grow = Math.min(1, D / 0.12), fade = Math.max(0, Math.min(1, (end - 0.1 - T) / 0.8));
    g.globalAlpha = fade;
    g.fillStyle = `rgba(110,0,12,${0.55 * Math.min(1, D / 0.3)})`; g.fillRect(0, 0, 720, 1280);
    g.strokeStyle = 'rgba(255,235,235,.85)'; g.lineWidth = 2; g.shadowColor = '#ff2d55'; g.shadowBlur = 8;
    for (const pts of run.cracks) { const n = Math.max(2, Math.ceil(pts.length * grow)); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < n; j++) g.lineTo(pts[j][0], pts[j][1]); g.stroke(); }
    g.shadowBlur = 0; g.fillStyle = '#000'; g.beginPath(); g.arc(CX, 600, 16, 0, 7); g.fill();
    if (D > 0.35) {
      const gl = Math.max(0, 1 - (D - 0.35) / 0.5), dx = (Math.random() - 0.5) * 22 * gl;
      g.textAlign = 'center'; g.font = '800 88px "Barlow Semi Condensed"';
      g.globalAlpha = fade * 0.6; g.fillStyle = '#00e5ff'; g.fillText("YOU'RE DEAD.", CX + dx - 6, 420);
      g.globalAlpha = fade; g.fillStyle = '#ff2d55'; g.shadowColor = '#ff2d55'; g.shadowBlur = 30; g.fillText("YOU'RE DEAD.", CX + dx, 420);
      g.shadowBlur = 0;
    }
    if (D > 1.0) { g.font = '700 30px "Barlow Semi Condensed"'; g.fillStyle = '#e8ece9'; g.fillText('THE DEALER WINS.', CX, 820); }
    g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(0, 0, 720, 1280);   // fade to black
  }
  g.restore();
}
/**
 * VS DEALER: the dealer's face (public/dealer.png, edges faded into the dark) at the top between the
 * two players, with a pump shotgun and pale bony hands drawn over it. LIVE call: he levels the
 * shotgun at you. BLANK call: the barrel against his own face. Hit: he jolts, glitches.
 */
const DEALER_IMG = new Image(); DEALER_IMG.src = `${import.meta.env.BASE_URL}dealer.png`;
const IMG = { w: 270, h: 236, face: [135, 125], eyes: [[95, 82], [177, 82]], unit: 1.37 };   // unit: image px per gun-drawing unit
const DX = CX, DY = 150, DS = 1;                                   // face position + size at the top of the screen
const DW = 300;                                                    // drawn width of the image at size 1
interface DealerPose { t: number; eyes: number; flare: number; grin: number; gun: 'you' | 'self' | null; aim: number; kick: number; flash: number; tilt: number; glitch: number }
const SKIN = '#b9b2a2', SKIN_D = '#0d0b09', SUIT = '#0b0a0a', WOOD = '#4a3020', WOOD_D = '#1c120a', INK = '#0d0b09';
/** a long pale bony finger along points (knuckles, dark nail), or a dark sleeve when `sleeve` */
function limb(pts: number[][], w: number, nail = true, sleeve = false) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.strokeStyle = sleeve ? '#1a1718' : SKIN_D; g.lineWidth = w + 3; g.stroke();
  g.strokeStyle = sleeve ? SUIT : SKIN; g.lineWidth = w; g.stroke();
  if (nail && !sleeve) {
    for (const p of pts.slice(1, -1)) { g.fillStyle = SKIN; g.strokeStyle = SKIN_D; g.lineWidth = 1; g.beginPath(); g.arc(p[0], p[1], w * 0.62, 0, 7); g.fill(); g.stroke(); }   // knuckles
    const a = pts[pts.length - 2], b = pts[pts.length - 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
    g.strokeStyle = '#8c8375'; g.lineWidth = w * 0.55; g.beginPath(); g.moveTo(b[0] - ux, b[1] - uy); g.lineTo(b[0] + ux * 3, b[1] + uy * 3); g.stroke();   // dark nail
  }
  g.restore();
}
function blob(x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fillStyle = SKIN; g.fill(); g.strokeStyle = SKIN_D; g.lineWidth = 1.2; g.stroke();
}
function metal(path: () => void, col = '#3d4442') {
  g.beginPath(); path(); g.closePath();
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#6a6a62'); gr.addColorStop(0.5, '#3a3a36'); gr.addColorStop(1, '#141412');
  g.fillStyle = col === '#3d4442' ? gr : col; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
}
function flashStar(x: number, y: number, R: number, k: number) {
  g.save(); g.globalAlpha *= k; g.fillStyle = '#fff3c4'; g.shadowColor = '#ffb347'; g.shadowBlur = 40; g.beginPath();
  for (let j = 0; j < 14; j++) { const an = (j / 14) * Math.PI * 2, r = j % 2 ? R * 0.35 : R * (0.8 + Math.random() * 0.4); g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
  g.closePath(); g.fill(); g.restore();
}
/** the shotgun against his own face (side view, steep diagonal), both hands on it */
function gunSelf(o: DealerPose) {
  g.save(); g.translate(50, 4); g.rotate(0.95); g.scale(0.72, 0.72);                  // muzzle at his cheek, stock down to the right
  limb([[150, 70], [120, 40], [96, 22]], 22, false, true);                              // sleeve to the pump hand
  limb([[200, 40], [182, 20], [166, 12]], 22, false, true);                             // sleeve to the trigger hand
  metal(() => { g.moveTo(0, -6); g.lineTo(150, -6); g.lineTo(150, 3); g.lineTo(0, 3); });              // barrel
  metal(() => { g.moveTo(10, 4); g.lineTo(120, 4); g.lineTo(120, 11); g.lineTo(10, 11); });             // magazine tube
  metal(() => { g.moveTo(70, 1); g.lineTo(118, 1); g.lineTo(116, 15); g.lineTo(72, 15); }, WOOD);       // pump
  metal(() => { g.moveTo(148, -9); g.lineTo(190, -9); g.lineTo(192, 12); g.lineTo(146, 12); });          // receiver
  metal(() => { g.moveTo(190, -6); g.lineTo(250, 6); g.lineTo(252, 30); g.lineTo(196, 14); }, WOOD);     // stock
  g.strokeStyle = WOOD_D; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(76 + k * 11, 3); g.lineTo(76 + k * 11, 13); g.stroke(); }   // pump grooves
  blob(96, 20, 10, 8, 0.2);                                                             // pump hand: fingers wrapped under the pump
  for (let k = 0; k < 4; k++) limb([[100 - k * 8, 22], [96 - k * 8, 13], [90 - k * 8, 3]], 4.4);
  limb([[104, 14], [104, 2], [99, -6]], 4.8);                                           // thumb over the top
  blob(170, 16, 9, 11, 0.4);                                                            // trigger hand
  limb([[166, 8], [158, 14], [156, 20]], 4.4);                                          // index on the trigger
  for (let k = 0; k < 3; k++) limb([[176, 14 + k * 5], [166, 22 + k * 4], [160, 28 + k * 4]], 4.4);
  g.restore();
  if (o.flash > 0) flashStar(50, 4, 44, o.flash);
}
/** the shotgun levelled at you (front view): barrel over the magazine tube, pale hand under the pump */
function gunYou(o: DealerPose) {
  const r = 13 + 7 * o.aim, gx = 46 + Math.sin(o.t * 2.1) * 4 * (1 - o.aim), gy = 50 - 8 * o.aim + o.kick;
  limb([[96, 118], [gx + r * 1.2, gy + r * 2.6]], 22, false, true);                    // sleeve
  metal(() => g.ellipse(gx, gy + r * 1.55, r * 1.3, r * 1.0, 0, 0, 7), WOOD);                                // the pump round the tube
  metal(() => g.arc(gx, gy + r * 1.5, r * 0.75, 0, 7)); g.fillStyle = '#000'; g.beginPath(); g.arc(gx, gy + r * 1.5, r * 0.35, 0, 7); g.fill();   // magazine tube
  metal(() => g.arc(gx, gy, r, 0, 7)); g.fillStyle = '#000'; g.beginPath(); g.arc(gx, gy, r * 0.68, 0, 7); g.fill();                              // barrel + bore
  g.fillStyle = '#e8e2cf'; g.beginPath(); g.arc(gx, gy - r * 1.05, r * 0.12, 0, 7); g.fill();                                                       // bead sight
  const fw = Math.max(4, r * 0.3);
  blob(gx + r * 0.2, gy + r * 2.75, r * 1.0, r * 0.55, 0.1);                                                  // palm under the pump
  for (let k = 0; k < 4; k++) { const a = Math.PI * (0.62 + 0.12 * k), cx2 = gx, cy2 = gy + r * 1.55; limb([[gx - r * 0.3 + k * r * 0.12, gy + r * 2.7], [cx2 + Math.cos(a) * r * 1.45, cy2 + Math.sin(a) * r * 1.1], [cx2 + Math.cos(a + 0.45) * r * 1.3, cy2 + Math.sin(a + 0.45) * r * 1.0]], fw); }   // fingers curling up round the pump
  limb([[gx + r * 1.6, gy + r * 2.7], [gx + r * 1.7, gy + r * 1.9], [gx + r * 1.4, gy + r * 1.2]], fw * 1.1);   // thumb
  if (o.flash > 0) flashStar(gx, gy, 78, o.flash);
}
function dealerFigure(x: number, y: number, sc: number, o: DealerPose) {
  if (!DEALER_IMG.complete || !DEALER_IMG.naturalWidth) return;
  const lean = o.gun === 'you' ? 0.1 * o.aim : 0, k = (sc * (1 + lean + 0.03 * o.grin) * DW) / IMG.w;
  g.save(); g.translate(x, y + o.kick); g.rotate(o.tilt); g.scale(k, k);
  if (o.glitch) g.translate((Math.random() - 0.5) * 20 * o.glitch, 0);
  const a0 = g.globalAlpha;
  // the face; a violet glow when it's his turn; flickers with his eyes when he dies
  g.save(); g.translate(-IMG.face[0], -IMG.face[1]);
  g.globalAlpha = a0 * (0.35 + 0.65 * Math.max(o.eyes, 0.15));
  g.drawImage(DEALER_IMG, 0, 0);
  if (o.glitch) { g.globalAlpha = a0 * 0.35; g.globalCompositeOperation = 'lighter'; g.drawImage(DEALER_IMG, 6, 0); g.globalCompositeOperation = 'source-over'; }
  if (o.eyes > 0 && o.t % 4.1 > 0.1) {   // a faint glint deep in the empty eyes
    g.globalAlpha = a0 * o.eyes * 0.7; g.fillStyle = '#efe8d4'; g.shadowColor = '#fff6d8'; g.shadowBlur = 8;
    for (const [ex, ey] of IMG.eyes) { g.beginPath(); g.arc(ex + 2, ey + 3, 2.4, 0, 7); g.fill(); }
    g.shadowBlur = 0;
  }
  g.restore(); g.globalAlpha = a0;
  // the shotgun, in drawing units around the face
  g.scale(IMG.unit, IMG.unit); g.translate(0, 14);
  if (o.gun === 'self') gunSelf(o); else if (o.gun === 'you') gunYou(o);
  g.restore();
}
function dealer(t: number, step: number) {
  if (st.mode === 'over' && run.won) return;   // his death scene draws him
  const play = st.mode === 'play', sh = run.shot, kt = sh && st.rev ? t - sh.t : 9;
  const turn = play && st.who === 'dlr', call = turn ? run.cpuCall : null;
  const hitMe = !!(sh && sh.res && sh.target === 'dlr' && kt < 0.9);           // the dealer took a live round
  const jx = hitMe ? (Math.random() - 0.5) * 16 * (1 - kt / 0.9) : 0, jy = hitMe ? -10 * Math.exp(-kt * 6) : 0;
  const shotNow = !!(st.rev && sh && !sh.you && kt < 0.15 && sh.res);
  let gun: DealerPose['gun'] = null;
  if (call === 1 || (st.rev && sh && !sh.you && sh.c === 1 && kt < 1.2)) gun = 'you';
  else if (call === 0 || (st.rev && sh && !sh.you && sh.c === 0 && kt < 1.2)) gun = 'self';
  const aim = st.rev ? 1 : Math.max(0, Math.min(1, (step - (run.cpuAt ?? step)) / Math.max(1, PRE - (run.cpuAt ?? 0))));
  dealerFigure(DX + jx, DY + jy, DS, {
    t, eyes: hitMe ? Math.min(1, kt / 0.6) : 1, flare: call !== null ? 1.5 : 1,
    grin: sh && (sh.late || (sh.res && sh.target === 'you' && !sh.you)) && kt < 3 ? 1 : 0, gun, aim,
    kick: shotNow ? -8 : 0, flash: shotNow ? 1 - kt / 0.15 : 0, tilt: hitMe ? 0.1 * Math.exp(-kt * 4) : 0,
    glitch: t % 5.3 < 0.08 ? 1 : 0,
  });
}
/** the dealer's death: he comes to the centre, his eyes flicker and die, he slumps into the dark */
function dealerDeath(T: number) {
  const { out, text, end } = DEALER_DEATH, e = smooth(Math.min(1, T / 0.5)), s = smooth((T - out) / 0.7);
  g.save();
  g.fillStyle = `rgba(0,0,0,${Math.min(0.94, T / 0.4)})`; g.fillRect(0, 0, 720, 1280);
  let eyes = 1; if (T > 0.5 && T < out) eyes = Math.random() < (out - T) / (out - 0.5) ? 0.3 + 0.7 * Math.random() : 0.04; else if (T >= out) eyes = 0;
  const glitch = T > 0.5 && T < out && Math.random() < 0.25 ? 1 : 0;
  dealerFigure(lerp(DX, CX, e), lerp(DY, 560, e) + 150 * s, lerp(DS, 2.3, e), { t: T, eyes, flare: 1.6 * (1 - s), grin: Math.max(0, 1 - T / out), gun: null, aim: 0, kick: 0, flash: 0, tilt: 0.3 * s, glitch });
  g.fillStyle = `rgba(0,0,0,${0.8 * s})`; g.fillRect(0, 0, 720, 1280);   // he sinks into the dark
  g.textAlign = 'center';
  if (T > text) {
    const k = Math.min(1, (T - text) / 0.15), dx = (Math.random() - 0.5) * 18 * Math.max(0, 1 - (T - text) / 0.5);
    g.font = '800 64px "Barlow Semi Condensed"';
    g.globalAlpha = 0.5 * k; g.fillStyle = COL.c; g.fillText('THE DEALER IS DEAD.', CX + dx - 5, 250);
    g.globalAlpha = k; g.fillStyle = '#ffd84a'; g.shadowColor = '#ffd84a'; g.shadowBlur = 24; g.fillText('THE DEALER IS DEAD.', CX + dx, 250); g.shadowBlur = 0;
    if (T > text + 0.6) { g.font = '700 40px "Barlow Semi Condensed"'; g.fillStyle = '#fff'; g.fillText('YOU WIN.', CX, 960); }
  }
  g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, (T - (end - 0.6)) / 0.6))})`; g.fillRect(0, 0, 720, 1280);
  g.restore();
}
// intro / reload magazine animations
const INTRO_PLAN = { video: 1, a: 1.25, b: 2.7, c: 3.2, flash: 4.5, drop: [0.05, 0.11], labels: 1, text: 1 }, RELOAD_PLAN = { a: 2.0, b: 3.2, c: 3.7, drop: [0.25, 0.25], labels: 1 } as any;
const dropAt = (plan: any, j: number, n: number) => plan.drop[0] + j * Math.min(plan.drop[1], (plan.drop[0] < 0.1 ? 0.9 : 1.75) / n);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function magLabels(al: number, pos: (j: number) => number, n: number, L: number) {
  if (al <= 0) return;
  g.save(); g.globalAlpha = al; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const xl = L ? (pos(0) + pos(L - 1)) / 2 : CX, xb = n - L ? (pos(L) + pos(n - 1)) / 2 : CX;
  g.font = '700 30px "Barlow Semi Condensed"'; g.shadowBlur = 14;
  if (L) { g.fillStyle = '#ff2d55'; g.shadowColor = '#ff2d55'; g.fillText(`${L} LIVE`, xl, 744); }
  if (n - L) { g.fillStyle = '#62e6ff'; g.shadowColor = '#62e6ff'; g.fillText(`${n - L} BLANK`, xb, 744); }
  g.shadowBlur = 0; g.font = '600 15px "Barlow Semi Condensed"'; g.fillStyle = '#cfd8d2';
  if (L) g.fillText('the riff drops 2 octaves', xl, 768); if (n - L) g.fillText('it turns into bells', xb, 768);
  g.restore();
}
function introVideo(T: number, n: number, L: number) {
  const bs = Math.min(62, 560 / Math.max(1, n - 1)), pos = (j: number) => CX + (j - (n - 1) / 2) * bs, hj = (j: number) => Math.sin(j * 12.9898 + n * 78.233) * 0.5;
  if (T < 0.45) magLabels(Math.min(1, Math.max(0, (0.42 - T) / 0.12)) * Math.min(1, T / 0.08), pos, n, L);
  const f = (T - LOAD0) / LOADG, shift = T < LOAD0 ? 0 : Math.floor(f) + smooth((f - Math.floor(f)) / 0.75);
  for (let j = 0; j < n; j++) {
    let cx = pos(j), top = 578, w = 42, h = 98, kind = j < L ? 'live' : 'blank', gl = 0.8; const al = Math.min(1, T / 0.08);
    if (T > 0.28) { kind = 'unknown'; gl = 0; }
    if (T > 0.3 && T < LOAD0) { const e = Math.sin((Math.PI * (T - 0.3)) / (LOAD0 - 0.3)); top = 578 - 36 * hj(j) * e + Math.sin(T * 60 + j * 2) * 5 * e; cx += hj(j + 3) * 10 * e; }
    const tl = loadAt(j);
    if (T >= LOAD0 && T < tl) cx = pos(0) + Math.max(0, j - shift) * bs;
    if (T >= tl) {
      const k = Math.min(1, (T - tl) / LOADD), e = 1 - Math.pow(1 - k, 3);
      cx = lerp(pos(0), rowX(j, n), e); top = lerp(578, ROW.top, e) - Math.sin(k * Math.PI) * 24; w = lerp(42, ROW.w, e); h = lerp(98, ROW.h, e);
      if (k >= 1) gl = Math.max(0, 1.2 - (T - tl - LOADD) * 5);
    }
    drawShell(cx, top, w, h, kind, gl, al);
    const kr = (T - tl - LOADD) / 0.35;
    if (kr >= 0 && kr < 1) { g.save(); g.globalAlpha = 1 - kr; g.strokeStyle = '#6dffa0'; g.shadowColor = '#6dffa0'; g.shadowBlur = 16; g.lineWidth = 3; g.beginPath(); g.arc(rowX(j, n), ROW.top + ROW.h / 2, 24 + 22 * smooth(kr), 0, 7); g.stroke(); g.restore(); }
  }
}
function introDraw(t: number, T0: number, n: number, L: number, plan: any) {
  const T = t - T0, bs = Math.min(62, 560 / Math.max(1, n - 1)), pos = (j: number) => CX + (j - (n - 1) / 2) * bs, { a, b, c } = plan;
  if (plan.video) { introVideo(T, n, L); introText(T, plan); return; }
  if (!st.perm || st.perm.length !== n) st.perm = shuffle([...Array(n).keys()], Math.random);
  if (plan.labels && T < a + 0.3) magLabels(Math.min(1, Math.max(0, (T - dropAt(plan, n - 1, n)) / 0.25)) * Math.max(0, Math.min(1, (a + 0.3 - T) / 0.3)), pos, n, L);
  for (let j = 0; j < n; j++) {
    const kind0 = j < L ? 'live' : 'blank'; let cx = pos(j), top = 578, w = 42, h = 98, kind = kind0, gl = 0.8;
    if (plan.drop && T < a) {
      const td = dropAt(plan, j, n); if (T < td) continue;
      const k = (T - td) / 0.16; top = k < 1 ? lerp(-140, 578, k * k) : 578 - 18 * Math.exp(-(k - 1) * 1.6) * Math.abs(Math.sin((k - 1) * 2.4));
      if (k >= 1 && k < 1.6) gl = 0.8 + 1.2 * (1.6 - k);
    }
    if (T > a && T < b) {
      const k = (T - a) / (b - a), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cx = lerp(pos(j), pos(st.perm![j]), e); top = 578 - Math.sin(e * Math.PI) * (j % 2 ? 60 : -40) - Math.abs(Math.sin(T * 14 + j)) * 10; kind = k > 0.35 ? 'unknown' : kind0; gl = k > 0.35 ? 0 : 0.8;
    }
    if (T >= b) { const k = Math.min(1, (T - b) / (c - b)), e = 1 - Math.pow(1 - k, 3); cx = lerp(pos(st.perm![j]), rowX(st.perm![j], n), e); top = lerp(578, ROW.top, e); w = lerp(42, ROW.w, e); h = lerp(98, ROW.h, e); kind = 'unknown'; gl = 0; }
    drawShell(cx, top, w, h, kind, gl);
  }
  introText(T, plan);
}
function introText(T: number, plan: any) {
  if (plan.text && T > 3.0) {
    const fade = Math.max(0, Math.min(1, (INTRO - 0.1 - T) / 0.5)); g.save(); g.textBaseline = 'alphabetic';
    const k = Math.min(1, (T - 3) / 0.18), sc = 1 + 0.5 * (1 - k) * (1 - k); g.globalAlpha = k * fade;
    g.translate(CX, 598); g.scale(sc, sc);
    g.font = '700 58px "Barlow Semi Condensed"'; const w1 = g.measureText('LIVE').width; g.font = '700 32px "Barlow Semi Condensed"'; const w2 = g.measureText(' or ').width;
    g.font = '700 58px "Barlow Semi Condensed"'; const w3 = g.measureText('BLANK?').width; let x = -(w1 + w2 + w3) / 2; g.textAlign = 'left';
    g.shadowBlur = 20; g.shadowColor = '#ff2d55'; g.fillStyle = '#ff2d55'; g.fillText('LIVE', x, 0); x += w1;
    g.shadowBlur = 0; g.font = '700 32px "Barlow Semi Condensed"'; g.fillStyle = '#fff'; g.fillText(' or ', x, 0); x += w2;
    g.font = '700 58px "Barlow Semi Condensed"'; g.shadowColor = '#62e6ff'; g.shadowBlur = 20; g.fillStyle = '#62e6ff'; g.fillText('BLANK?', x, 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.shadowBlur = 0; g.textAlign = 'center'; g.globalAlpha = fade;
    if (T > 3.5) { const s = 'GUESS RIGHT.'; g.font = '700 36px "Barlow Semi Condensed"'; g.fillStyle = '#fff'; g.fillText(s.slice(0, Math.ceil((T - 3.5) / 0.05)), CX, 656); }
    if (T > plan.flash) {
      const j = Math.max(0, 1 - (T - plan.flash) / 0.25), dx = (Math.random() - 0.5) * 14 * j;
      g.font = '700 44px "Barlow Semi Condensed"'; g.fillStyle = '#ff2d55'; g.shadowColor = '#ff2d55'; g.shadowBlur = 24;
      g.globalAlpha = fade * 0.5; g.fillStyle = '#00e5ff'; g.fillText('...OR ELSE.', CX + dx - 4 * j, 722);
      g.globalAlpha = fade; g.fillStyle = '#ff2d55'; g.fillText('...OR ELSE.', CX + dx, 722);
    }
    g.restore();
  }
  if (plan.flash && T > plan.flash && !st.introFlash) { st.introFlash = 1; st.flashT = now(); st.flashCol = 'rgba(255,60,90,.55)'; st.shakeT = now(); st.tintTarget = [160, 10, 40, 0.7]; }
}

// title: a riff-shaped trace scrolls across, red 808 spikes and cyan bells echo it
function titleScene(t: number) {
  const bp = theme ? (((t - (theme.next - 2)) % 0.5) + 0.5) % 0.5 : (performance.now() / 1000) % 0.5, pulse = Math.exp(-bp * 9);
  const y0 = 650, amp = 70, L = GX0 - 40, Rr = GX1 + 40, sp = t * 90;
  const wave = (x: number, o: number) => { const u = (x + sp + o) / 58, k = Math.floor(u); const v = [0, 4, 1, 4, 0, 7, 1, 4][((k % 8) + 8) % 8]; return y0 - (amp * 0.42 * v) / 2 - (u - k < 0.08 ? 8 * pulse : 0); };
  g.save();
  g.strokeStyle = `rgba(90,150,110,${0.06 + 0.08 * pulse})`; g.lineWidth = 1; for (let x = L; x <= Rr; x += 35) { g.beginPath(); g.moveTo(x, y0 - 170); g.lineTo(x, y0 + 170); g.stroke(); }
  g.strokeStyle = 'rgba(150,140,200,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(L, y0 + 40); g.lineTo(Rr, y0 + 40); g.stroke();
  for (const [col, off, dy, a, w] of [['#ff3d6e', 29, 150, 0.5, 2.5], ['#7ef2ff', 13, -150, 0.45, 2.5], ['#ffd84a', 0, 0, 1, 4]] as const) {
    g.beginPath(); for (let x = L; x <= Rr; x += 3) { const y = wave(x, off) + dy; if (x === L) g.moveTo(x, y); else g.lineTo(x, y); }
    g.globalAlpha = a * (0.75 + 0.25 * pulse); g.shadowColor = col; g.shadowBlur = 14 + 10 * pulse; g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,170,90,.55)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(CX, y0 - 180); g.lineTo(CX, y0 + 180); g.stroke(); g.setLineDash([]);
  dot(CX, wave(CX, 0), '#ffd84a', 7 + 3 * pulse);
  g.restore();
}

// ---------- main loop ----------
function drawFuse(step: number) {
  const k = Math.min(1, step / PRE); g.fillStyle = 'rgba(255,255,255,.12)'; rr(253, 462, 214, 6, 3); g.fill();
  const gr = g.createLinearGradient(253, 0, 467, 0); gr.addColorStop(0, '#e8743a'); gr.addColorStop(1, '#ff5d8a'); g.fillStyle = gr; rr(253, 462, 214 * k, 6, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let b = 1; b < 8; b++) g.fillRect(253 + (214 * b) / 8 - 1, 460, 2, 10);
  if (run.lam < PRE) { g.fillStyle = '#ffb347'; g.fillRect(253 + (214 * run.lam) / PRE - 2, 455, 4, 20); }
  if (run.cpuCall !== null && run.cpuAt != null) { g.fillStyle = COL.v; g.fillRect(253 + 214 * Math.min(1, run.cpuAt / PRE) - 2, 457, 4, 16); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(253 + 214 * k, 465, 7, 0, 7); g.fill();
}
function drawLock(step: number) {
  if (!run || run.lam >= PRE || st.rev) return; const x = X(run.lam);
  g.save(); if (step < run.lam) g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,179,71,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, GY0 + 10); g.lineTo(x, GY1); g.stroke(); g.restore();
  g.font = '700 13px "Barlow Semi Condensed"'; g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.fillText('LOCK', x, GY0 + 22);
}

export interface Fx { transform: string; filter: string; split: number; flash: string; flashOpacity: number; vignette: string; logoPulse: boolean }
const DEFAULT_VIG = 'radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)';

/**
 * Zoom pulse on the beat, as measured on the reel: on the beats of the bar before the trigger, and
 * on every beat after a LIVE (stronger on the last shell). Nothing in the intro or after a BLANK.
 * Each pulse decays in ~0.2 s.
 */
function beatZoom(t: number) {
  if (st.paused) return 0;
  const pulse = (since: number) => (since >= 0 ? Math.exp(-since / 0.06) : 0);
  if (st.mode !== 'play') return 0;
  const step = (t - st.t0) / SD, since = (((step % 4) + 4) % 4) * SD;
  if (!st.rev) return step >= 16 && step < PRE ? 0.018 * pulse(since) : 0;
  if (!G.mag[st.i] || step < PRE + 4) return 0;
  return (st.i === G.mag.length - 1 ? 0.035 : 0.018) * pulse(since);
}

/** advance the game and draw one frame; `scale` is the stage's fit-to-window scale */
export function frame(scale: number): Fx {
  const animT = performance.now() / 1000, t = now();
  themeTick();
  if (run && !st.paused) {
    if (st.mode === 'intro' && t - st.introT0 >= INTRO) startShell(0, st.introT0 + INTRO, run.mode === 'duel' ? run.nextWho : 'you');
    else if (st.mode === 'reload' && t >= run.segT0 + 4) startShell(0, run.segT0 + 4, run.nextWho);
    else if (st.mode === 'over' && t >= run.segT0 + (run.won ? DEALER_DEATH.end : run.mode === 'duel' ? QUICK_DEATH.end : DEATH.end)) endRun();
  }
  let step = 0;
  if (st.mode === 'play' && !st.paused) {
    step = (t - st.t0) / SD;
    if (st.who === 'dlr' && run.cpuCall === null && step >= run.cpuStep) cpuDecide();
    if (!st.rev && st.guess === null && !st.locked && step >= run.lam) { st.locked = 1; lockButtons(); }
    if (!st.rev && step >= PRE) reveal();
    const isDead = run && (run.hp <= 0 || (run.mode === 'duel' && run.hpD <= 0));
    const pLen = isDead ? (run.mode === 'duel' ? QUICK_DEATH.after : 14) : POST;   // VS: break the screen right after the shot
    if (step >= PRE + pLen) { afterShell(st.t0 + (PRE + pLen) * SD); if (st.mode === 'play') step = (t - st.t0) / SD; }
  } else if (st.mode === 'play') step = (t - st.t0) / SD;
  if (['intro', 'reload', 'play', 'over'].includes(st.mode)) hud();
  if (st.mode === 'play') {
    if (!st.rev) { const k = Math.max(0, (step - 12) / 20); st.tintTarget = [lerp(30, 95, k), lerp(60, 45, k), lerp(40, 15, k), 0.5 + 0.12 * k]; }
    else st.tintTarget = G.mag[st.i] ? [150, 12, 40, 0.75] : [30, 80, 125, 0.65];
  } else if (st.mode === 'over') st.tintTarget = run.won ? [120, 95, 20, 0.6] : [60, 10, 20, 0.6];
  else if (st.mode === 'reload') st.tintTarget = [30, 60, 40, 0.5];
  else if (!['intro'].includes(st.mode)) st.tintTarget = [30, 55, 40, 0.45];
  background(animT);
  if (st.mode === 'intro' || st.mode === 'reload') {
    axes(false, 0);
    duelHud(t, 0);
    introDraw(t, st.mode === 'intro' ? st.introT0 : run.segT0, G.mag.length, G.mag.reduce((a, b) => a + b, 0), st.mode === 'intro' ? INTRO_PLAN : RELOAD_PLAN);
  } else if (st.mode === 'play' || st.mode === 'over') {
    const cur = st.mode === 'over' ? PRE + POST : Math.min(step, PRE + POST);
    axes(true, st.rev ? 0 : Math.max(0, Math.min(0.8, (step - 14) / 6)));
    if (st.mode === 'play') drawLock(step);
    duelHud(t, step);
    topRow(t);
    chance(step);
    const res = G.mag[st.i], oc = st.rev ? (res ? 'r' : 'c') : null; let head: any = null;
    // on the reveal a band sweeps left to right and recolours the riff (yellow -> red / cyan) as it passes
    const tT = st.t0 + PRE * SD, bk = st.rev ? (t - tT) / 0.42 : 1;
    if (st.rev && bk < 1 && st.mode === 'play') {
      const bx = lerp(GX0 - 30, GXT + 20, Math.max(0, bk));
      g.save(); g.beginPath(); g.rect(bx, 0, 720, 1280); g.clip(); for (const l of st.pre) drawLayer(l, Math.min(cur, PRE), null, true); g.restore();
      g.save(); g.beginPath(); g.rect(0, 0, bx, 1280); g.clip(); for (const l of st.pre) drawLayer(l, Math.min(cur, PRE), oc, true); g.restore();
      const bc = res ? '255,40,80' : '110,230,255', gr = g.createLinearGradient(bx - 40, 0, bx + 14, 0);
      gr.addColorStop(0, `rgba(${bc},0)`); gr.addColorStop(0.75, `rgba(${bc},.45)`); gr.addColorStop(1, `rgba(${bc},.9)`);
      g.fillStyle = gr; g.fillRect(bx - 40, GY0 - 10, 54, GY1 - GY0 + 20);
    } else for (const l of st.pre) { const h = drawLayer(l, Math.min(cur, PRE), oc, true); if (!st.rev && h) head = h; }
    if (st.rev) for (const l of st.post) { const h = drawLayer(l, cur, null, false); if (h) head = h; }
    ticks(st.rev ? [...st.pre, ...st.post] : st.pre, cur);
    if (head && st.mode === 'play') dot(head.x, head.y, head.col);
    if (st.rev && st.mode === 'play') {
      const pk = Math.max(0, 1 - (t - st.t0 - PRE * SD) / 0.5); if (pk > 0) dot(GXT, res ? 740 : 600, res ? COL.r : COL.c, 10, pk);
      g.font = '700 15px "Barlow Semi Condensed"'; g.textAlign = 'left'; g.fillStyle = res ? COL.r : COL.c;
      g.fillText(res ? '÷4  (s = −2)' : '×2  (s = +1)', res ? GXT - 100 : GXT + 12, res ? 712 : 620);
    }
    if (st.mode === 'play' && !st.rev) drawFuse(step);
    if (st.mode === 'over' && run.won) dealerDeath(t - run.segT0);
    if (st.mode === 'over' && !run.won) death(t - run.segT0);
  } else {
    if (st.mode === 'title') titleScene(animT);
    const bob = st.mode === 'title' ? 1 : 0.5;
    if (st.mode !== 'results') for (let j = 0; j < 8; j++) drawShell(CX - 256 + j * 73, 578 + Math.sin(animT * 2 + j) * 4 * bob, 42, 98, j < 4 ? 'live' : 'blank', st.mode === 'title' ? 0.6 : 0.25, st.mode === 'title' ? 1 : 0.35);
  }
  // effects
  let logoPulse = false;
  if (theme && theme.pulse && t >= theme.pulse && t - theme.pulse < 0.05 && st.mode === 'title') { logoPulse = true; theme.pulse = 0; }
  const fl = opt.flash ? 1 : 0.3, fa = Math.max(0, 1 - (t - st.flashT) / 0.45);
  const sk = st.paused || !opt.shake ? 0 : Math.max(0, 1 - (t - st.shakeT) / 0.5), A = st.shakeAmp || 22;
  const ab = st.paused ? 0 : Math.max(0, 1 - (t - st.shakeT) / 0.4), zoom = 1 + 0.085 * ab * ab * ab + beatZoom(t);   // chromatic split + punch-in on every LIVE hit
  let vg = DEFAULT_VIG;
  if (st.mode === 'play' && st.rev) {
    const ph = ((((t - st.t0) / SD) % 4) + 4) % 4 * SD, pu = Math.exp(-ph * 7), live = G.mag[st.i];
    vg = live ? `radial-gradient(ellipse at center,transparent ${38 - 6 * pu}%,rgba(${(150 + 60 * pu) | 0},0,30,${(0.55 + 0.3 * pu).toFixed(2)}) 100%)`
      : `radial-gradient(ellipse at center,transparent 42%,rgba(10,55,110,${(0.5 + 0.12 * pu).toFixed(2)}) 100%)`;
  } else if (st.mode === 'over' && !run.won) vg = 'radial-gradient(ellipse at center,transparent 35%,rgba(120,0,20,.8) 100%)';
  return {
    transform: `translate(-50%, -50%) scale(${scale * zoom}) translate(${(Math.random() - 0.5) * A * sk}px,${(Math.random() - 0.5) * A * sk}px)`,
    filter: IS_MOBILE ? '' : (ab > 0 ? 'url(#rgbx) ' : '') + (sk > 0 ? `saturate(${1 + sk}) contrast(${1 + 0.2 * sk})` : ''),
    split: IS_MOBILE ? 0 : ab,
    flash: st.flashCol, flashOpacity: fa * (st.flashCol.includes('255,60,90') ? fl : 1),
    vignette: vg, logoPulse,
  };
}
export type { Note };
