/** Root: the stage, the current screen, and input handling ported from legacy/js/main.js. */
import { useEffect } from 'react';
import { Stage } from './ui/Stage';
import { Game, HowTo, Menu, Results, Title } from './ui/screens';
import { useUI } from './ui/store';
import * as game from './engine/game';
import { st, inRun, run } from './engine/game';
import { ctx, initAudio, killRoute, now, V } from './engine/audio';

/** the browser only allows sound after a gesture: any interaction starts the title music */
function ensureTitleAudio() {
  initAudio();
  if (!ctx || st.paused) return;   // paused: the audio clock is the game clock, it must stay frozen
  if (ctx.state !== 'running') {
    void ctx.resume().then(() => {
      if (st.mode === 'title') { if (!game.theme) game.themeStart(); else game.theme.next = ctx!.currentTime + 0.02; game.themeMuffle(18000); }
    });
  } else if (st.mode === 'title') { if (!game.theme) game.themeStart(); game.themeMuffle(18000); }
}

function onKey(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (st.paused) {
    if (e.repeat) return;
    if (k === 'escape' || k === 'p') game.resumeGame();
    else if (k === 'arrowup' || k === 'arrowdown') {
      const B = ['pResume', 'pRestart', 'pQuit'].map(id => document.getElementById(id)!), j = B.indexOf(document.activeElement as HTMLElement);
      B[((j < 0 ? 0 : j + (k === 'arrowup' ? -1 : 1)) + 3) % 3].focus({ preventScroll: true });
    } else if (k === 'enter' && document.activeElement && (document.activeElement as HTMLElement).click) { e.preventDefault(); (document.activeElement as HTMLElement).click(); }
    return;
  }
  if (inRun()) {
    if (e.repeat) return;
    if (k === 'escape' || k === 'p') { game.pauseGame(); return; }
    if (st.mode === 'play') { if (k === 'l' || k === 'arrowleft') game.call(1); else if (k === 'b' || k === 'arrowright') game.call(0); }
    return;
  }
  if (e.repeat) return;
  switch (st.mode) {
    case 'title': if (!['shift', 'control', 'alt', 'meta', 'tab'].includes(k)) game.goMenu(); break;
    case 'menu':
      if (k === 'arrowleft') game.menuMove(-1); else if (k === 'arrowright') game.menuMove(1); else if (k === 'enter' || k === ' ') game.menuPlay();
      else if (k === '?' || k === 'i') game.howOpen(false); else if (k === 'escape') { V.tick(now(), 0.6); game.goTitle(); }
      break;
    case 'how': if (k === 'escape' || k === 'enter' || k === ' ') game.howClose(); break;
    case 'results': if (k === 'enter' || k === ' ') game.resultsMain(); else if (k === 'escape') game.goMenu(); break;
  }
}

export function App() {
  const screen = useUI(s => s.screen);
  useEffect(() => {
    try { ensureTitleAudio(); } catch { /* needs a gesture */ }
    const evts = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown', 'click'];
    evts.forEach(ev => addEventListener(ev, ensureTitleAudio, { passive: true }));
    addEventListener('keydown', onKey);
    // auto-pause: tab hidden or window blurred during a run; outside a run just suspend/resume the audio clock
    const onVis = () => {
      if (!ctx) return;
      if (document.hidden) { if (inRun()) game.pauseGame(); else void ctx.suspend(); }
      else if (!st.paused) void ctx.resume();   // a paused run waits for RESUME
    };
    const onBlur = () => { if (inRun()) game.pauseGame(); };
    document.addEventListener('visibilitychange', onVis); addEventListener('blur', onBlur);
    const onTouch = () => { if (ctx && ctx.state === 'suspended' && !st.paused) void ctx.resume(); };
    document.addEventListener('touchstart', onTouch, { passive: true }); document.addEventListener('touchend', onTouch, { passive: true });
    // phone / browser back button: return to the menu or the title
    try { history.replaceState({ screen: 'app' }, ''); history.pushState({ screen: 'app' }, ''); } catch { /* sandboxed */ }
    const onPop = () => {
      try { history.pushState({ screen: 'app' }, ''); } catch { /* sandboxed */ }
      if (inRun() || st.mode === 'results') { st.paused = false; useUI.setState({ paused: false }); if (run) killRoute(run.route); if (ctx) void ctx.resume(); st.tintTarget = [30, 55, 40, 0.45]; game.goMenu(); }
      else if (st.mode === 'how') game.howClose();
      else if (st.mode === 'menu') { V.tick(now(), 0.6); game.goTitle(); }
    };
    addEventListener('popstate', onPop);
    game.goTitle();
    return () => {
      evts.forEach(ev => removeEventListener(ev, ensureTitleAudio));
      removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); removeEventListener('blur', onBlur); removeEventListener('popstate', onPop);
    };
  }, []);

  return (
    <Stage>
      <Game />
      {screen === 'title' && <Title />}
      {screen === 'menu' && <Menu />}
      {screen === 'how' && <HowTo />}
      {screen === 'results' && <Results />}
    </Stage>
  );
}
