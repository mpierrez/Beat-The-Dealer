/** The screens, with the same markup (ids / classes) as legacy/index.html so legacy CSS applies unchanged. */
import { useEffect, useRef } from 'react';
import { useUI } from './store';
import { Tex } from './Tex';
import * as game from '../engine/game';
import { MODE_KEYS, MODES } from '../engine/game';
import { drawShell, onCtx } from '../engine/render';
import { store } from '../engine/core';
import { now } from '../engine/audio';
import { V } from '../engine/audio';

const locked = () => performance.now() < game.uiLock;
/** click handler that respects the 400 ms lock after leaving the title (legacy `tap`) */
const tap = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); if (!locked()) fn(); };

export function Title() {
  const { oneUp, hiScore, credit } = useUI();
  return (
    <section className="panel clear" id="scrTitle" onClick={() => game.goMenu()}>
      <div id="tStrip"><span id="t1up">{oneUp}</span><span><b>HI-SCORE</b><span id="tHi">{hiScore}</span></span><span>CREDIT <span id="tCred">{credit}</span></span></div>
      <div className="logo" id="logo"><div className="box"><div className="l1">BEAT THE</div><div className="l2">DEALER</div></div></div>
      <div className="pill"><span>Buckshot Roulette, but it's math</span></div>
      <div id="press" className="blink">PRESS START</div>
      <div className="foot">© 2026 Mathys PIERREZ</div>
    </section>
  );
}

function Vignette({ k }: { k: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!.getContext('2d')!;
    onCtx(c, () => {
      c.clearRect(0, 0, 480, 200);
      if (k === 'classic') for (let j = 0; j < 8; j++) drawShell(240 + (j - 3.5) * 54, 40, 36, 100, j < 4 ? 'live' : 'blank', 0.5);
      else if (k === 'survival') {
        for (let r = 0; r < 3; r++) for (let j = 0; j < r + 3; j++) drawShell(240 + (j - (r + 2) / 2) * 40, 8 + r * 64, 24, 56, 'unknown');
        c.font = '700 40px "Barlow Semi Condensed"'; c.fillStyle = '#ff3d6e'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('♥♥♥', 470, 4);
      } else {
        for (let j = 0; j < 3; j++) { drawShell(60 + j * 50, 60, 34, 96, 'unknown'); drawShell(320 + j * 50, 60, 34, 96, 'unknown'); }
        c.font = '700 34px "Barlow Semi Condensed"'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#ffb52e'; c.fillText('YOU ♥♥', 110, 10); c.fillStyle = '#b06cff'; c.fillText('♥♥ DLR', 370, 10);
      }
    });
  }, [k]);
  return <canvas id="cVig" ref={ref} width={480} height={200} />;
}

export function Menu() {
  const { menuIdx, slide } = useUI();
  const k = MODE_KEYS[menuIdx], M = MODES[k];
  const pb = (store.get('pb', {}) || {})[k];
  const swipe = useRef<number | null>(null);
  const scale = () => Math.min(innerWidth / 720, innerHeight / 1280);
  return (
    <section className="panel" id="scrMenu" style={{ ['--mc' as string]: M.col }}>
      <h2>CHOOSE YOUR GAMEMODE</h2>
      <div id="card" className={slide ? 'slide' : ''} style={{ ['--mc' as string]: M.col, ['--dx' as string]: `${slide * -40}px` }}
        onPointerDown={e => { swipe.current = e.clientX; }}
        onPointerUp={e => { if (swipe.current !== null && Math.abs(e.clientX - swipe.current) > 60 / scale()) { game.menuMove(e.clientX < swipe.current ? 1 : -1); swipe.current = -1e9; } else swipe.current = null; }}
        onClick={e => { if (swipe.current === -1e9) { swipe.current = null; return; } tap(game.menuPlay)(e); }}>
        <div id="cName">{M.name}</div><div id="cTag">{M.tag}</div><Vignette k={k} />
        <div id="cRules">{M.rules.map(r => <div key={r}>{r}</div>)}</div>
        <div id="cPb">YOUR BEST {pb ? game.fmtD(pb) : '—'}</div><div id="cChip" />
      </div>
      <button className="arr" id="mPrev" aria-label="Previous" onClick={tap(() => game.menuMove(-1))}>◀</button>
      <button className="arr" id="mNext" aria-label="Next" onClick={tap(() => game.menuMove(1))}>▶</button>
      <div id="dots">{MODE_KEYS.map((m, j) => <i key={m} className={j === menuIdx ? 'on' : ''} />)}</div>
      <button className="pbtn" id="mPlay" onClick={tap(game.menuPlay)}>PLAY</button>
      <div id="mRow">
        <button className="pbtn sec" id="mBack" onClick={tap(() => { V.tick(now(), 0.6); game.goTitle(); })}>BACK</button>
        <button className="pbtn sec" id="mHow" onClick={tap(() => game.howOpen(false))}>HOW TO PLAY</button>
      </div>
    </section>
  );
}

export function HowTo() {
  const thenPlay = useUI(s => s.howThenPlay);
  return (
    <section className="panel" id="scrHow">
      <h2>HOW TO PLAY</h2>
      <ol>
        <li>The magazine holds <b className="L">LIVE</b> and <b className="B">BLANK</b> shells. You see how many of each at the start.</li>
        <li>Each shell plays a little tune. Before it hits the TRIGGER line, guess: <b className="L">LIVE</b> or <b className="B">BLANK</b>?</li>
        <li><b className="L">LIVE</b>: the tune drops into a heavy bass. <b className="B">BLANK</b>: it turns into bells.</li>
        <li>Right guess = points, and a streak multiplies them. Wrong guess = streak lost (and a ♥ in Survival).</li>
        <li>Tip: count the shells already fired. The fewer LIVE left, the more a LIVE guess pays.</li>
      </ol>
      <button className="pbtn" id="hBack" onClick={tap(game.howClose)}>{thenPlay ? 'GOT IT' : 'BACK'}</button>
    </section>
  );
}

export function Results() {
  const s = useUI();
  return (
    <section className="panel" id="scrResults">
      <div id="rMode">{s.rMode}</div>
      <div id="rGrade" key={s.rScore + s.rGrade} style={{ color: s.rGradeColor }}>{s.rGrade}</div>
      <h2 id="rQuip">{s.rQuip}</h2>
      <div id="rStats">{s.rStats.flatMap(([a, b]) => [<span key={a}>{a}</span>, <span key={a + 'v'} className="v">{b}</span>])}</div>
      <div id="rBits">{s.rBits.map((b, j) => <b key={j} style={{ color: b ? '#ff3d6e' : '#7ef2ff' }}>{b}</b>)}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <button className="pbtn" id="rMain" onClick={tap(game.resultsMain)}>RETRY</button>
        <button className="pbtn sec" id="rMenu" onClick={tap(game.goMenu)}>MENU</button>
      </div>
    </section>
  );
}

export function Game() {
  const s = useUI();
  const fxClass = s.mAfx.split(':')[0];
  return (
    <>
      <div className="abs" id="math">
        <Tex id="mA" key={s.mAfx} className={fxClass} tex={s.mA} />
        <Tex id="mB" tex={s.mB} />
        <Tex id="mC" tex={s.mC} />
      </div>
      <div className="abs" id="ctrl" style={{ display: s.ctrl ? 'flex' : 'none' }}>
        <button className={s.bL} id="bL" disabled={s.disabled} onPointerDown={e => { e.preventDefault(); game.call(1); }}>LIVE</button>
        <button className={s.bB} id="bB" disabled={s.disabled} onPointerDown={e => { e.preventDefault(); game.call(0); }}>BLANK</button>
      </div>
      <button id="pauseBtn" aria-label="Pause" style={{ display: s.pauseBtn ? 'block' : 'none' }} onPointerDown={e => { e.preventDefault(); game.pauseGame(); }}>II</button>
      {s.paused && (
        <section className="panel" id="scrPause">
          <h2>PAUSED</h2>
          <button className="pbtn" id="pResume" autoFocus onClick={game.resumeGame}>RESUME</button>
          <button className="pbtn sec" id="pRestart" onClick={game.restartGame}>RESTART</button>
          <button className="pbtn sec" id="pQuit" onClick={game.quitGame}>QUIT TO MENU</button>
          <div className="keys" id="pNote">{s.pauseNote}</div>
        </section>
      )}
    </>
  );
}
