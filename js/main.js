// Beat The Dealer: main loop, input, auto-pause
"use strict";
// ---------- main loop ----------
function drawFuse(step){
  const k=Math.min(1,step/PRE);g.fillStyle='rgba(255,255,255,.12)';rr(253,462,214,6,3);g.fill();
  const gr=g.createLinearGradient(253,0,467,0);gr.addColorStop(0,'#e8743a');gr.addColorStop(1,'#ff5d8a');g.fillStyle=gr;rr(253,462,214*k,6,3);g.fill();
  g.fillStyle='rgba(255,255,255,.35)';for(let b=1;b<8;b++)g.fillRect(253+214*b/8-1,460,2,10);
  if(run.lam<PRE){g.fillStyle='#ffb347';g.fillRect(253+214*run.lam/PRE-2,455,4,20)}
  if(run.cpuCall!==null&&run.cpuAt!=null){g.fillStyle=COL.v;g.fillRect(253+214*Math.min(1,run.cpuAt/PRE)-2,457,4,16)}
  g.fillStyle='#fff';g.beginPath();g.arc(253+214*k,465,7,0,7);g.fill()}
function drawLock(step){if(!run||run.lam>=PRE||st.rev)return;const x=X(run.lam);
  g.save();if(step<run.lam)g.setLineDash([6,6]);g.strokeStyle='rgba(255,179,71,.85)';g.lineWidth=2;g.beginPath();g.moveTo(x,GY0+10);g.lineTo(x,GY1);g.stroke();g.restore();
  g.font='700 13px "Barlow Semi Condensed"';g.textAlign='center';g.fillStyle='#ffb347';g.fillText('LOCK',x,GY0+22)}
function frame(){
  const t=now();themeTick();
  if(run&&!st.paused){
    if(st.mode==='intro'&&t-st.introT0>=INTRO)startShell(0,st.introT0+INTRO,'you');
    else if(st.mode==='reload'&&t>=run.segT0+4)startShell(0,run.segT0+4,run.nextWho);
    else if(st.mode==='over'&&t>=run.segT0+2.2)endRun();
  }
  let step=0;
  if(st.mode==='play'&&!st.paused){step=(t-st.t0)/SD;
    if(st.who==='dlr'&&run.cpuCall===null&&step>=run.cpuStep)cpuDecide();
    if(!st.rev&&st.guess===null&&!st.locked&&step>=run.lam){st.locked=1;lockButtons()}
    if(!st.rev&&step>=PRE)reveal();
    if(step>=PRE+POST){afterShell(st.t0+(PRE+POST)*SD);if(st.mode==='play')step=(t-st.t0)/SD}}
  else if(st.mode==='play')step=(t-st.t0)/SD;
  if(inRun())hud();
  if(st.mode==='play'){if(!st.rev){const k=Math.max(0,(step-12)/20);st.tintTarget=[lerp(30,95,k),lerp(60,45,k),lerp(40,15,k),.5+.12*k]}
    else st.tintTarget=G.mag[st.i]?[105,18,38,.5]:[26,62,98,.45]}
  else if(st.mode==='over')st.tintTarget=run.won?[120,95,20,.6]:[60,10,20,.6];
  else if(st.mode==='reload')st.tintTarget=[30,60,40,.5];
  else if(!inRun())st.tintTarget=[30,55,40,.45];
  background(t);
  if(st.mode==='intro'||st.mode==='reload'){axes(false,0);
    introDraw(t,st.mode==='intro'?st.introT0:run.segT0,G.mag.length,G.mag.reduce((a,b)=>a+b,0),st.mode==='intro'?INTRO_PLAN:RELOAD_PLAN)}
  else if(st.mode==='play'||st.mode==='over'){
    const cur=st.mode==='over'?PRE+POST:Math.min(step,PRE+POST);
    axes(true,st.rev?0:Math.max(0,Math.min(.8,(step-14)/6)));
    if(st.mode==='play')drawLock(step);
    topRow(t);
    const res=G.mag[st.i],oc=st.rev?(res?'r':'c'):null;let head=null;
    // on the reveal a band sweeps left to right and recolours the riff (yellow -> red / cyan) as it passes
    const tT=st.t0+PRE*SD,bk=st.rev?(t-tT)/.42:1;
    if(st.rev&&bk<1&&st.mode==='play'){const bx=lerp(GX0-30,GXT+20,Math.max(0,bk));
      g.save();g.beginPath();g.rect(bx,0,720,1280);g.clip();for(const l of st.pre)drawLayer(l,Math.min(cur,PRE),null,true);g.restore();
      g.save();g.beginPath();g.rect(0,0,bx,1280);g.clip();for(const l of st.pre)drawLayer(l,Math.min(cur,PRE),oc,true);g.restore();
      const bc=res?'255,40,80':'110,230,255',gr=g.createLinearGradient(bx-40,0,bx+14,0);gr.addColorStop(0,`rgba(${bc},0)`);gr.addColorStop(.75,`rgba(${bc},.16)`);gr.addColorStop(1,`rgba(${bc},.38)`);
      g.fillStyle=gr;g.fillRect(bx-40,GY0-10,54,GY1-GY0+20)}
    else for(const l of st.pre){const h=drawLayer(l,Math.min(cur,PRE),oc,true);if(!st.rev&&h)head=h}
    if(st.rev)for(const l of st.post){const h=drawLayer(l,cur,null,false);if(h)head=h}
    ticks(st.rev?[...st.pre,...st.post]:st.pre,cur);
    if(head&&st.mode==='play')dot(head.x,head.y,head.col);
    if(st.rev&&st.mode==='play'){const pk=Math.max(0,1-(t-st.t0-PRE*SD)/.5);if(pk>0)dot(GXT,res?740:600,res?COL.r:COL.c,10,pk);
      g.font='700 15px "Barlow Semi Condensed"';g.textAlign='left';g.fillStyle=res?COL.r:COL.c;
      g.fillText(res?'÷4  (s = −2)':'×2  (s = +1)',res?GXT-100:GXT+12,res?712:620)}
    if(st.mode==='play'&&!st.rev)drawFuse(step);
    if(st.mode==='over'){const k=Math.min(1,(t-run.segT0)/2),c=run.won?'#ffd84a':'#ff3d6e';
      g.beginPath();g.moveTo(GX0,668);g.lineTo(lerp(GX0,GX1,k),668);glowStroke(c,3)}
  }else{ // menus: idle magazine
    const bob=st.mode==='title'?1:.5;
    for(let j=0;j<8;j++)drawShell(100+j*73,578+Math.sin(t*2+j)*4*bob,42,98,j<4?'live':'blank',st.mode==='title'?.6:.25,st.mode==='title'?1:.35)}
  if(theme&&theme.pulse&&t>=theme.pulse&&t-theme.pulse<.05&&st.mode==='title'){const l=$('logo');l.classList.remove('pulse');void l.offsetWidth;l.classList.add('pulse');theme.pulse=0}
  if(st.mode==='title')$('press').style.visibility=(performance.now()/1000%1)<.6?'visible':'hidden';
  const fl=opt.flash?1:.3,fa=Math.max(0,1-(t-st.flashT)/.45),fe=$('flash');fe.style.background=st.flashCol;fe.style.opacity=fa*(st.flashCol.includes('255,60,90')?fl:1);
  const sk=st.paused||!opt.shake?0:Math.max(0,1-(t-st.shakeT)/.5),s=stage.dataset.s,A=st.shakeAmp||22;
  const ab=st.paused?0:Math.max(0,1-(t-st.shakeT)/.25),zoom=1+.012*ab*ab;   // chromatic split + punch-in on every LIVE hit
  stage.style.transform=`translate(-50%,-50%) scale(${s*zoom}) translate(${(Math.random()-.5)*A*sk}px,${(Math.random()-.5)*A*sk}px)`;
  if(ab>0){const d=(1+4*ab).toFixed(1);$('rgbR').setAttribute('dx',d);$('rgbC').setAttribute('dx',-d);$('rgbR').setAttribute('dy','0')}
  const fil=(ab>0?'url(#rgbx) ':'')+(sk>0?`saturate(${1+sk}) contrast(${1+.2*sk})`:'');if(stage.style.filter!==fil)stage.style.filter=fil;
  // edges glow with the drop: red pulses on every kick after a LIVE, cold blue after a BLANK
  let vg='radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)';
  if(st.mode==='play'&&st.rev){const ph=(((t-st.t0)/SD)%4+4)%4*SD,pu=Math.exp(-ph*7),live=G.mag[st.i];
    vg=live?`radial-gradient(ellipse at center,transparent ${50-3*pu}%,rgba(${110+40*pu|0},0,25,${(.32+.14*pu).toFixed(2)}) 100%)`
           :`radial-gradient(ellipse at center,transparent 42%,rgba(10,45,90,${(.32+.06*pu).toFixed(2)}) 100%)`}
  else if(st.mode==='over'&&!run.won)vg='radial-gradient(ellipse at center,transparent 35%,rgba(120,0,20,.8) 100%)';
  const ve=$('vig');if(ve._v!==vg){ve._v=vg;ve.style.background=vg}
  if(st.mode==='init'&&performance.now()>ini.deadline)initConfirm();
  grain();ambient();requestAnimationFrame(frame);
}
const gc=$('grain').getContext('2d'),gimg=gc.createImageData(180,320);let gf=0;
// desktop backdrop: a tiny copy of the game canvas, blurred by CSS, fills the space around the portrait stage
const amb=document.getElementById('amb'),ambG=amb.getContext('2d');let af=0;
function ambient(){if(af++%6||innerWidth<innerHeight)return;ambG.drawImage(cv,0,0,72,128)}
function grain(){if(gf++%2)return;const d=gimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}gc.putImageData(gimg,0,0)}

// ---------- input ----------
let uiLock=0;const tap=(id,fn)=>$(id).addEventListener('click',e=>{e.stopPropagation();if(performance.now()<uiLock)return;fn()});
$('scrTitle').addEventListener('pointerdown',()=>{if(st.mode==='title')goMenu()});
tap('mPrev',()=>menuMove(-1));tap('dPrev',()=>setDiff(-1));tap('dNext',()=>setDiff(1));tap('mNext',()=>menuMove(1));tap('mPlay',menuPlay);tap('card',menuPlay);
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
  if(k==='f'&&st.mode!=='init'&&!inRun()){try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}catch(_){}return}
  if(e.repeat&&st.mode!=='init')return;
  switch(st.mode){
    case'title':if(!['shift','control','alt','meta','tab'].includes(k))goMenu();break;
    case'menu':if(k==='arrowleft')menuMove(-1);else if(k==='arrowright')menuMove(1);else if(k==='enter'||k===' ')menuPlay();else if(k==='arrowup')setDiff(1);else if(k==='arrowdown')setDiff(-1);
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
  else if(!st.paused&&!inRun())ctx.resume()});
addEventListener('blur',()=>{if(inRun())pauseGame()});
titleRender();show('scrTitle');
requestAnimationFrame(frame);
