// Beat The Dealer: input handling, keyboard/touch bindings, loop bootstrap
"use strict";
// ---------- input ----------
let uiLock=0;const tap=(id,fn)=>$(id).addEventListener('click',e=>{e.stopPropagation();if(performance.now()<uiLock)return;fn()});
function ensureTitleAudio(){
  initAudio();
  if(!ctx)return;
  if(ctx.state!=='running'){
    ctx.resume().then(()=>{
      if(st.mode==='title'){
        if(!theme)themeStart();
        else if(theme)theme.next=ctx.currentTime+.02;
        themeMuffle(18000);
      }
    });
  }else if(st.mode==='title'){
    if(!theme)themeStart();
    themeMuffle(18000);
  }
}
try{ensureTitleAudio()}catch(e){}
['pointerdown','touchstart','touchend','mousedown','mouseup','keydown','click'].forEach(evt=>{
  window.addEventListener(evt,ensureTitleAudio,{passive:true});
});
$('scrTitle').addEventListener('click',e=>{
  ensureTitleAudio();
  if(st.mode!=='title')return;
  const onStart=e.target.id==='press'||e.target.closest('#press');
  if(onStart){
    goMenu();
  }
});
tap('mPrev',()=>menuMove(-1));tap('mNext',()=>menuMove(1));tap('mPlay',menuPlay);tap('card',menuPlay);
tap('mBack',()=>{V.tick(now(),.6);goTitle()});
tap('mHof',()=>hofOpen(MODE_KEYS[menuIdx]));tap('mHow',()=>howOpen(false));tap('hBack',howClose);
let swipeX=null;$('card').addEventListener('pointerdown',e=>{swipeX=e.clientX});
$('card').addEventListener('pointerup',e=>{if(swipeX!==null&&Math.abs(e.clientX-swipeX)>60/(+stage.dataset.s||1)){menuMove(e.clientX<swipeX?1:-1);swipeX=-1e9}else swipeX=null});
$('card').addEventListener('click',e=>{if(swipeX===-1e9){swipeX=null;e.stopImmediatePropagation()}},true);
$('hofTabs').addEventListener('click',e=>{const b=e.target.closest('[data-j]');if(b){hof.tab=+b.dataset.j;hof.hi=-1;V.tick(now(),.8);hofRender()}});
$('hofBtns').addEventListener('click',e=>{if(e.target.id==='hRetry')hofBack(true);else if(e.target.id==='hMenu')hofBack(false)});
tap('rMain',resultsMain);tap('rMenu',goMenu);tap('iOk',initConfirm);
$('iCells').addEventListener('click',e=>{const b=e.target.closest('[data-j]');if(!b)return;const j=+b.dataset.j;
  if(b.dataset.d)initSet(j,+b.dataset.d);else{ini.cur=j;initRender()}});
$('bL').addEventListener('pointerdown',e=>{e.preventDefault();call(1)});$('bB').addEventListener('pointerdown',e=>{e.preventDefault();call(0)});
$('pauseBtn').addEventListener('pointerdown',e=>{e.preventDefault();pauseGame()});
tap('pResume',resumeGame);tap('pRestart',restartGame);tap('pQuit',quitGame);
addEventListener('keydown',e=>{const k=e.key.toLowerCase();
  if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k))e.preventDefault();
  if(st.paused){if(e.repeat)return;
    if(k==='escape'||k==='p')resumeGame();
    else if(k==='arrowup'||k==='arrowdown'){const B=['pResume','pRestart','pQuit'].map($),j=B.indexOf(document.activeElement);
      B[((j<0?0:j+(k==='arrowup'?-1:1))+3)%3].focus({preventScroll:true})}
    else if(k==='enter'&&document.activeElement&&document.activeElement.click){e.preventDefault();document.activeElement.click()}
    return}
  if(inRun()){if(e.repeat)return;
    if(k==='escape'||k==='p'){pauseGame();return}
    if(st.mode==='play'){if(k==='l'||k==='arrowleft')call(1);else if(k==='b'||k==='arrowright')call(0)}
    return}
  if(e.repeat&&st.mode!=='init')return;
  switch(st.mode){
    case'title':if(!['shift','control','alt','meta','tab'].includes(k))goMenu();break;
    case'menu':if(k==='arrowleft')menuMove(-1);else if(k==='arrowright')menuMove(1);else if(k==='enter'||k===' ')menuPlay();
      else if(k==='h')hofOpen(MODE_KEYS[menuIdx]);else if(k==='?'||k==='i')howOpen(false);else if(k==='escape'){V.tick(now(),.6);goTitle()}break;
    case'how':if(k==='escape'||k==='enter'||k===' ')howClose();break;
    case'hof':if(k==='arrowleft'||k==='arrowright'){hof.tab=(hof.tab+(k==='arrowleft'?-1:1)+4)%4;hof.hi=-1;V.tick(now(),.8);hofRender()}
      else if(k==='enter')hofBack(true);else if(k==='escape')hofBack(false);break;
    case'results':if(k==='enter'||k===' ')resultsMain();else if(k==='escape')goMenu();break;
    case'init':if(k==='arrowup')initSet(ini.cur,-1);else if(k==='arrowdown')initSet(ini.cur,1);
      else if(k==='arrowleft'){ini.cur=Math.max(0,ini.cur-1);initRender()}else if(k==='arrowright'){ini.cur=Math.min(2,ini.cur+1);initRender()}
      else if(k==='backspace'){ini.cur=Math.max(0,ini.cur-1);initRender()}else if(k==='enter')initConfirm();
      else if(k.length===1)initType(k.toUpperCase());break;
  }});
// auto-pause: tab hidden or window blurred during a run; outside a run just suspend/resume the audio clock
document.addEventListener('visibilitychange',()=>{if(!ctx)return;
  if(document.hidden){if(inRun())pauseGame();else ctx.suspend()}
  else{ctx.resume();if(inRun()&&st.paused)resumeGame()}});
addEventListener('blur',()=>{if(inRun())pauseGame()});
// proactive AudioContext resume for mobile touch
['touchstart','touchend'].forEach(evt=>{
  document.addEventListener(evt,()=>{if(ctx&&ctx.state==='suspended')ctx.resume()},{passive:true});
});
// mobile hardware / browser back button navigation: return to main menu or title
try{history.replaceState({screen:'app'},'');history.pushState({screen:'app'},'')}catch(e){}
window.addEventListener('popstate',()=>{
  try{history.pushState({screen:'app'},'')}catch(e){}
  if(inRun()||st.mode==='play'||st.mode==='intro'||st.mode==='reload'||st.mode==='over'||st.mode==='results'){
    st.paused=false;$('scrPause').classList.add('hide');if(run)killRoute(run.route);if(ctx)ctx.resume();
    st.tintTarget=[30,55,40,.45];goMenu();
  }else if(st.mode==='how'){howClose();
  }else if(st.mode==='hof'){hofBack(false);
  }else if(st.mode==='init'){goMenu();
  }else if(st.mode==='menu'){V.tick(now(),.6);goTitle();}
});
goTitle();
requestAnimationFrame(frame);
