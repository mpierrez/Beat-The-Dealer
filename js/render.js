// Beat The Dealer: Canvas drawing, shells, oscilloscope scope, traces, intro animations
"use strict";
// ---------- drawing ----------
function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function drawShell(cx,top,w,h,kind,glow=0,alpha=1){
  g.save();g.globalAlpha=alpha;
  const bh=h*.2,body=h-bh;
  const c=kind==='live'?['#ff4a68','#c8102e','#ff2d55']:kind==='blank'?['#8fe8ff','#2aa6e0','#5fd8ff']:['#3c4d44','#1d2822','#2e3d35'];
  if(glow){g.shadowColor=c[2];g.shadowBlur=24*glow}
  const gr=g.createLinearGradient(cx-w/2,0,cx+w/2,0);gr.addColorStop(0,c[1]);gr.addColorStop(.35,c[0]);gr.addColorStop(1,c[1]);
  g.fillStyle=gr;rr(cx-w/2,top,w,body,w*.18);g.fill();g.shadowBlur=0;
  g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=Math.max(1,w/30);
  for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(cx+k*w*.14,top+2);g.lineTo(cx+k*w*.12,top+body*.12);g.stroke()}
  g.fillStyle='rgba(0,0,0,.12)';for(let yy=top;yy<top+body;yy+=3)g.fillRect(cx-w/2,yy,w,1);
  const bg=g.createLinearGradient(cx-w/2,0,cx+w/2,0);bg.addColorStop(0,'#9a7420');bg.addColorStop(.4,'#f3d27a');bg.addColorStop(1,'#8a6416');
  g.fillStyle=bg;rr(cx-w/2-w*.06,top+body,w*1.12,bh,w*.08);g.fill();
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(cx-w/2-w*.06,top+body+bh*.45,w*1.12,Math.max(1,bh*.1));
  if(kind==='unknown'){g.fillStyle='#7be0a3';g.font=`700 ${Math.round(w*.75)}px "Barlow Semi Condensed"`;g.textAlign='center';g.textBaseline='middle';g.fillText('?',cx,top+body*.45)}
  g.restore();
}
const lerp=(a,b,t)=>a+(b-a)*t;
function background(t){
  const tt=st.tint,tg=st.tintTarget;for(let k=0;k<4;k++)tt[k]=lerp(tt[k],tg[k],.06);
  g.fillStyle='#050806';g.fillRect(0,0,720,1280);
  const rg=g.createRadialGradient(360,640,40,360,640,820);
  rg.addColorStop(0,`rgba(${tt[0]|0},${tt[1]|0},${tt[2]|0},${tt[3]})`);rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg;g.fillRect(0,0,720,1280);
  g.strokeStyle='rgba(120,160,130,.05)';g.lineWidth=1.2;
  for(let k=0;k<3;k++){g.beginPath();g.ellipse(GXT,668,150,60,k*Math.PI/3+t*.05,0,Math.PI*2);g.stroke()}
  g.strokeStyle='rgba(90,150,110,.13)';g.lineWidth=1;
  for(let x=GX0;x<=GX1+1;x+=35){g.beginPath();g.moveTo(x,GY0);g.lineTo(x,GY1);g.stroke()}
  g.font='600 15px "Barlow Semi Condensed"';g.textAlign='left';g.textBaseline='middle';
  for(let o=1;o<=5;o++){const y=781-71*(o-1);g.fillStyle='rgba(110,170,130,.45)';g.fillText('F'+o,30,y);
    g.strokeStyle='rgba(90,150,110,.07)';g.beginPath();g.moveTo(GX0,y);g.lineTo(GX1,y);g.stroke()}
}
function axes(showTrig,trigDash){
  g.strokeStyle='rgba(150,140,200,.7)';g.fillStyle='rgba(150,140,200,.8)';g.lineWidth=2;
  g.beginPath();g.moveTo(68,668);g.lineTo(645,668);g.stroke();
  g.beginPath();g.moveTo(652,668);g.lineTo(640,662);g.lineTo(640,674);g.fill();
  if(!showTrig)return;
  g.beginPath();g.moveTo(GXT,GY1);g.lineTo(GXT,GY0+4);g.stroke();
  g.beginPath();g.moveTo(GXT,GY0-4);g.lineTo(GXT-6,GY0+8);g.lineTo(GXT+6,GY0+8);g.fill();
  g.font='700 13px "Barlow Semi Condensed"';g.textAlign='center';g.fillStyle=st.rev?(G.mag[st.i]?'#ff6b8a':'#9aeaff'):'#f2b25c';g.fillText('TRIGGER',GXT,GY0-12);
  if(trigDash>0){g.save();g.setLineDash([5,5]);g.strokeStyle=`rgba(255,170,90,${trigDash})`;g.lineWidth=2;
    g.beginPath();g.moveTo(GXT,GY0+10);g.lineTo(GXT,GY1);g.stroke();g.restore()}
}
function glowStroke(col,w=3,alpha=1){g.globalAlpha=alpha;g.shadowColor=col;g.shadowBlur=16;g.strokeStyle=col;g.lineWidth=w;g.stroke();
  g.shadowBlur=0;g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1.1;g.stroke();g.globalAlpha=1}
function dot(x,y,col,r=7,a=1){g.globalAlpha=a;g.shadowColor=col;g.shadowBlur=22;g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,7);g.fill();g.shadowBlur=0;g.globalAlpha=1}
function drawLayer(l,cur,colOverride,labels){
  if(l.mode==='none')return null;
  const col=COL[colOverride||l.col]||COL.y;
  const vis=l.notes.filter(n=>n.s<=cur);if(!vis.length)return null;
  let head=null;
  if(l.mode==='step'||l.mode==='reese'){
    const passes=l.mode==='reese'?2:1;
    for(let ps=0;ps<passes;ps++){g.beginPath();let prevY=null,prevE=null;
      for(const n of vis){const e=Math.min(n.s+n.d,cur),x1=X(n.s),x2=X(e);
        let y=Y(n.p);if(ps)y+=2+(1+5*(n.s%32)/32)*(l.wide?2.4:1.1)*((n.s%4)/4+.6);
        if(prevY===null||prevE<n.s-.01)g.moveTo(x1,y);else{g.lineTo(x1,prevY+(l.mode==='step'?4:0));g.lineTo(x1,y)}
        g.lineTo(x2,y);prevY=y;prevE=n.s+n.d;head=[x2,y]}
      glowStroke(col,ps?1.6:3,ps?.75:1)}
    if(l.mode==='reese'&&head){const n=vis[vis.length-1];g.font='600 13px "Barlow Semi Condensed"';g.fillStyle=col;g.textAlign='left';
      g.fillText(`Δf = ${(1+5*(n.s%32)/32+(l.wide?4:0)).toFixed(1)} Hz`,head[0]-30,head[1]-16)}
  }else if(l.mode==='dash'){
    for(const n of vis){const e=Math.min(n.s+n.d,cur),x1=X(n.s),x2=X(e),y=Y(n.p);g.beginPath();
      if(l.thin){g.moveTo(x1,y);g.lineTo(x2,y);glowStroke(col,2,.8)}
      else{g.moveTo(x1-3,y+9);g.lineTo(x1,y+9);g.lineTo(x1,y);g.lineTo(x2,y);if(e>=n.s+n.d){g.lineTo(x2,y+9);g.lineTo(x2+3,y+9)}glowStroke(col,3)}
      head=[x2,y]}
  }else if(l.mode==='spike'){
    g.beginPath();let prevY=null,prevE=null;
    for(const n of vis){const e=Math.min(n.s+n.d,cur),x1=X(n.s),x2=X(e),y=Y(n.p),pk=Y(n.p+20);
      if(prevY===null||prevE<n.s-.01)g.moveTo(x1,pk);else g.lineTo(x1,prevY);
      g.lineTo(x1,pk);const w=x2-x1;
      for(let k=1;k<=10;k++){const f=k/10;g.lineTo(x1+Math.min(w,7)*f,lerp(pk,y,1-Math.exp(-4*f)))}
      g.lineTo(x2,y);prevY=y;prevE=n.s+n.d;head=[x2,y]}
    glowStroke(col,2.6);
  }else if(l.mode==='flat'){
    const n=l.notes[0],e=Math.min(n.s+n.d,cur),y=Y(n.p);g.beginPath();g.moveTo(X(n.s),y);g.lineTo(X(e),y);glowStroke(col,2.4);return null;
  }
  if(labels){g.font='700 16px "Barlow Semi Condensed"';g.textAlign='center';g.fillStyle=col;
    vis.forEach(n=>{if(n.lab==null||cur<n.s+0.4)return;
      const x=(X(n.s)+X(Math.min(n.s+n.d,cur)))/2;
      g.fillText(String(n.lab),x,Y(n.p)-14)})}
  return head?{x:head[0],y:head[1],col}:null;
}
function ticks(Ls,cur){
  for(const l of Ls){if(l.mode==='none')continue;for(const n of l.notes){if(n.s>cur)continue;
    const x=X(n.s),h=5+((n.p+40)%9)*1.6,latest=cur-n.s<1.2;
    g.fillStyle=latest?'rgba(140,255,180,.95)':'rgba(70,190,120,.55)';g.fillRect(x,826-h-(latest?6:0),2,h+(latest?6:0))}}
}
// shell row (n ≤ 10): revealed shells coloured, current one framed (amber = you, violet = Dealer), under-bar per resolved call, pop on reveal
const ROW={sp:46,w:26,h:64,top:300},rowX=(j,n)=>CX+(j-(n-1)/2)*ROW.sp;
const BAR={ok:'#6dffa0',bad:'#ff6b6b',late:'#ffb347',dlr:'#b06cff'};
function topRow(t){
  const n=G.mag.length,{w,h,top}=ROW,amn=run&&run.amnesia,play=st.mode==='play',kt=t-(st.t0+PRE*SD);
  for(let j=0;j<n;j++){const cx=rowX(j,n);let kind='unknown',gl=0,dy=0;
    if(j<st.i&&!amn||(j===st.i&&st.rev))kind=G.mag[j]?'live':'blank';
    if(j===st.i&&play){gl=st.rev?1.4:0;
      if(st.rev&&kt>=0&&kt<.5)dy=-14*Math.exp(-6*kt)*Math.cos(10*kt);
      if(!st.rev){g.save();const fc=st.who==='dlr'?BAR.dlr:'#f0b13a';g.shadowColor=st.who==='dlr'?BAR.dlr:'#ffb52e';g.shadowBlur=18+6*Math.sin(t*8);
        g.strokeStyle=fc;g.lineWidth=2.5;rr(cx-w/2-6,top-6,w+12,h+12,6);g.stroke();g.restore()}}
    drawShell(cx,top+dy,w,h,kind,gl,play&&j>st.i?.75:1);}
}
// shells shown big (live first), shuffled, then flown into the row. plan: shuffle start a, fly start b, landed c; drop: shells drop in one per tick
// drop: [start, max gap between shells]; text: the reel's "LIVE or BLANK? GUESS RIGHT. ...OR ELSE." sequence
const INTRO_PLAN={video:1,a:1.25,b:2.7,c:3.2,flash:4.5,drop:[.05,.11],labels:1,text:1},RELOAD_PLAN={a:2.0,b:3.2,c:3.7,drop:[.25,.25],labels:1};
const dropAt=(plan,j,n)=>plan.drop[0]+j*Math.min(plan.drop[1],(plan.drop[0]<.1?.9:1.75)/n);
// the reel's first second: coloured magazine -> '?' -> rattle -> the queue feeds the row one shell per sixteenth,
// each landing on the grid with a ping and a green ring (measured on the reel: launches every 0.125 s, ~4 frames of flight)
const LOAD0=.5,LOADG=SD,LOADD=SD,loadAt=j=>LOAD0+j*LOADG;
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
function introVideo(T,n,L){
  const bs=Math.min(62,560/Math.max(1,n-1)),pos=j=>CX+(j-(n-1)/2)*bs,hj=j=>Math.sin(j*12.9898+n*78.233)*.5;
  if(T<.45){const al=Math.min(1,Math.max(0,(.42-T)/.12))*Math.min(1,T/.08);
    if(al>0){g.save();g.globalAlpha=al;g.textAlign='center';g.textBaseline='alphabetic';const xl=L?(pos(0)+pos(L-1))/2:CX,xb=n-L?(pos(L)+pos(n-1))/2:CX;
      g.font='700 30px "Barlow Semi Condensed"';g.shadowBlur=14;
      if(L){g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.fillText(`${L} LIVE`,xl,744)}if(n-L){g.fillStyle='#62e6ff';g.shadowColor='#62e6ff';g.fillText(`${n-L} BLANK`,xb,744)}
      g.shadowBlur=0;g.font='600 15px "Barlow Semi Condensed"';g.fillStyle='#cfd8d2';if(L)g.fillText('f goes below 0',xl,768);if(n-L)g.fillText('f stays above 0',xb,768);g.restore()}}
  // queue position: after shell k leaves, the rest slide one slot left (eased, done before the next launch)
  const f=(T-LOAD0)/LOADG,shift=T<LOAD0?0:Math.floor(f)+smooth((f-Math.floor(f))/.75);
  for(let j=0;j<n;j++){let cx=pos(j),top=578,w=42,h=98,kind=j<L?'live':'blank',gl=.8,al=Math.min(1,T/.08);
    if(T>.28){kind='unknown';gl=0}
    // rattle between the flip and the first launch
    if(T>.3&&T<LOAD0){const e=Math.sin(Math.PI*(T-.3)/(LOAD0-.3));top=578-36*hj(j)*e+Math.sin(T*60+j*2)*5*e;cx+=hj(j+3)*10*e}
    const tl=loadAt(j);
    if(T>=LOAD0&&T<tl)cx=pos(0)+Math.max(0,j-shift)*bs;
    if(T>=tl){const k=Math.min(1,(T-tl)/LOADD),e=1-Math.pow(1-k,3);
      cx=lerp(pos(0),rowX(j,n),e);top=lerp(578,ROW.top,e)-Math.sin(k*Math.PI)*24;w=lerp(42,ROW.w,e);h=lerp(98,ROW.h,e);
      if(k>=1)gl=Math.max(0,1.2-(T-tl-LOADD)*5)}
    drawShell(cx,top,w,h,kind,gl,al);
    // landing ring on the slot
    const kr=(T-tl-LOADD)/.35;if(kr>=0&&kr<1){g.save();g.globalAlpha=1-kr;g.strokeStyle='#6dffa0';g.shadowColor='#6dffa0';g.shadowBlur=16;g.lineWidth=3;
      g.beginPath();g.arc(rowX(j,n),ROW.top+ROW.h/2,24+22*smooth(kr),0,7);g.stroke();g.restore()}}
}
function introDraw(t,T0,n,L,plan){
  const T=t-T0,bs=Math.min(62,560/Math.max(1,n-1)),pos=j=>CX+(j-(n-1)/2)*bs,{a,b,c}=plan;
  if(plan.video){introVideo(T,n,L);introText(T,plan);return}
  if(!st.perm||st.perm.length!==n)st.perm=shuffle([...Array(n).keys()],Math.random);
  // labels under the loaded magazine (fade out when the shuffle starts)
  if(plan.labels&&T<a+.3){const al=Math.min(1,Math.max(0,(T-dropAt(plan,n-1,n))/.25))*Math.max(0,Math.min(1,(a+.3-T)/.3));
    if(al>0){g.save();g.globalAlpha=al;g.textAlign='center';g.textBaseline='alphabetic';
      const xl=L?(pos(0)+pos(L-1))/2:CX,xb=n-L?(pos(L)+pos(n-1))/2:CX;
      g.font='700 30px "Barlow Semi Condensed"';g.shadowBlur=14;
      if(L){g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.fillText(`${L} LIVE`,xl,744)}
      if(n-L){g.fillStyle='#62e6ff';g.shadowColor='#62e6ff';g.fillText(`${n-L} BLANK`,xb,744)}
      g.shadowBlur=0;g.font='600 15px "Barlow Semi Condensed"';g.fillStyle='#cfd8d2';
      if(L)g.fillText('f goes below 0',xl,768);if(n-L)g.fillText('f stays above 0',xb,768);g.restore()}}
  for(let j=0;j<n;j++){
    const kind0=j<L?'live':'blank';let cx=pos(j),top=578,w=42,h=98,kind=kind0,gl=.8;
    if(plan.drop&&T<a){const td=dropAt(plan,j,n);if(T<td)continue;
      // fall, hit the table, small bounce
      const k=(T-td)/.16;top=k<1?lerp(-140,578,k*k):578-18*Math.exp(-(k-1)*1.6)*Math.abs(Math.sin((k-1)*2.4));
      if(k>=1&&k<1.6)gl=.8+1.2*(1.6-k)}
    if(T>a&&T<b){const k=(T-a)/(b-a),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      cx=lerp(pos(j),pos(st.perm[j]),e);top=578-Math.sin(e*Math.PI)*(j%2?60:-40)-Math.abs(Math.sin(T*14+j))*10;kind=k>.35?'unknown':kind0;gl=k>.35?0:.8}
    if(T>=b){const k=Math.min(1,(T-b)/(c-b)),e=1-Math.pow(1-k,3);
      cx=lerp(pos(st.perm[j]),rowX(st.perm[j],n),e);top=lerp(578,ROW.top,e);w=lerp(42,ROW.w,e);h=lerp(98,ROW.h,e);kind='unknown';gl=0}
    drawShell(cx,top,w,h,kind,gl)}
  introText(T,plan);
}
function introText(T,plan){
  if(plan.text&&T>3.0){const fade=Math.max(0,Math.min(1,(INTRO-.1-T)/.5));g.save();g.textBaseline='alphabetic';
    // LIVE or BLANK? slams in, GUESS RIGHT. types in, ...OR ELSE. hits with the gunshot
    const k=Math.min(1,(T-3)/.18),sc=1+.5*(1-k)*(1-k);g.globalAlpha=k*fade;
    g.translate(CX,598);g.scale(sc,sc);
    g.font='700 58px "Barlow Semi Condensed"';const w1=g.measureText('LIVE').width;g.font='700 32px "Barlow Semi Condensed"';const w2=g.measureText(' or ').width;
    g.font='700 58px "Barlow Semi Condensed"';const w3=g.measureText('BLANK?').width;let x=-(w1+w2+w3)/2;g.textAlign='left';
    g.shadowBlur=20;g.shadowColor='#ff2d55';g.fillStyle='#ff2d55';g.fillText('LIVE',x,0);x+=w1;
    g.shadowBlur=0;g.font='700 32px "Barlow Semi Condensed"';g.fillStyle='#fff';g.fillText(' or ',x,0);x+=w2;
    g.font='700 58px "Barlow Semi Condensed"';g.shadowColor='#62e6ff';g.shadowBlur=20;g.fillStyle='#62e6ff';g.fillText('BLANK?',x,0);
    g.setTransform(1,0,0,1,0,0);g.shadowBlur=0;g.textAlign='center';g.globalAlpha=fade;
    if(T>3.5){const s='GUESS RIGHT.';g.font='700 36px "Barlow Semi Condensed"';g.fillStyle='#fff';g.fillText(s.slice(0,Math.ceil((T-3.5)/.05)),CX,656)}
    if(T>plan.flash){const j=Math.max(0,1-(T-plan.flash)/.25),dx=(Math.random()-.5)*14*j;
      g.font='700 44px "Barlow Semi Condensed"';g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.shadowBlur=24;
      g.globalAlpha=fade*.5;g.fillStyle='#00e5ff';g.fillText('...OR ELSE.',CX+dx-4*j,722);
      g.globalAlpha=fade;g.fillStyle='#ff2d55';g.fillText('...OR ELSE.',CX+dx,722)}
    g.restore()}
  if(plan.flash&&T>plan.flash&&!st.introFlash){st.introFlash=1;st.flashT=now();st.flashCol='rgba(255,60,90,.55)';st.shakeT=now();st.tintTarget=[160,10,40,.7]}
}

// title: a riff-shaped trace scrolls across the full width, red 808 spikes and cyan bells echo it, the magazine fans out below
function titleScene(t){
  const bp=theme?((t-(theme.next-2))%.5+.5)%.5:(performance.now()/1000)%.5,pulse=Math.exp(-bp*9);   // beat phase (title theme when it plays)
  const y0=650,amp=70,L=GX0-40,Rr=GX1+40,sp=t*90;
  const wave=(x,o)=>{const u=(x+sp+o)/58,k=Math.floor(u);const v=[0,4,1,4,0,7,1,4][((k%8)+8)%8];return y0-amp*.42*v/2-(u-k<.08?8*pulse:0)};
  g.save();
  // faint grid sweep
  g.strokeStyle=`rgba(90,150,110,${.06+.08*pulse})`;g.lineWidth=1;for(let x=L;x<=Rr;x+=35){g.beginPath();g.moveTo(x,y0-170);g.lineTo(x,y0+170);g.stroke()}
  g.strokeStyle='rgba(150,140,200,.45)';g.lineWidth=2;g.beginPath();g.moveTo(L,y0+40);g.lineTo(Rr,y0+40);g.stroke();
  // echoes: red drop (two octaves down, spiky) and cyan bells (an octave up), then the yellow riff on top
  for(const [col,off,dy,a,w] of [['#ff3d6e',29,150,.5,2.5],['#7ef2ff',13,-150,.45,2.5],['#ffd84a',0,0,1,4]]){
    g.beginPath();for(let x=L;x<=Rr;x+=3){const y=wave(x,off)+dy;x===L?g.moveTo(x,y):g.lineTo(x,y)}
    g.globalAlpha=a*(.75+.25*pulse);g.shadowColor=col;g.shadowBlur=14+10*pulse;g.strokeStyle=col;g.lineWidth=w;g.stroke()}
  g.globalAlpha=1;g.shadowBlur=0;
  // trigger line in the middle with a playhead dot
  g.strokeStyle='rgba(255,170,90,.55)';g.setLineDash([6,6]);g.beginPath();g.moveTo(CX,y0-180);g.lineTo(CX,y0+180);g.stroke();g.setLineDash([]);
  dot(CX,wave(CX,0),'#ffd84a',7+3*pulse);
  g.restore();
}

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
  const animT=performance.now()/1000,t=now();
  themeTick();
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
    const isDead=run&&(run.hp<=0||(run.mode==='duel'&&run.hpD<=0));
    const pLen=isDead?14:POST;
    if(step>=PRE+pLen){afterShell(st.t0+(PRE+pLen)*SD);if(st.mode==='play')step=(t-st.t0)/SD}}
  else if(st.mode==='play')step=(t-st.t0)/SD;
  if(inRun())hud();
  if(st.mode==='play'){if(!st.rev){const k=Math.max(0,(step-12)/20);st.tintTarget=[lerp(30,95,k),lerp(60,45,k),lerp(40,15,k),.5+.12*k]}
    else st.tintTarget=G.mag[st.i]?[150,12,40,.75]:[30,80,125,.65]}
  else if(st.mode==='over')st.tintTarget=run.won?[120,95,20,.6]:[60,10,20,.6];
  else if(st.mode==='reload')st.tintTarget=[30,60,40,.5];
  else if(!inRun())st.tintTarget=[30,55,40,.45];
  background(animT);
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
      const bc=res?'255,40,80':'110,230,255',gr=g.createLinearGradient(bx-40,0,bx+14,0);gr.addColorStop(0,`rgba(${bc},0)`);gr.addColorStop(.75,`rgba(${bc},.45)`);gr.addColorStop(1,`rgba(${bc},.9)`);
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
    if(st.mode==='title')titleScene(animT);
    const bob=st.mode==='title'?1:.5;
    for(let j=0;j<8;j++)drawShell(CX-256+j*73,578+Math.sin(animT*2+j)*4*bob,42,98,j<4?'live':'blank',st.mode==='title'?.6:.25,st.mode==='title'?1:.35)}
  if(theme&&theme.pulse&&t>=theme.pulse&&t-theme.pulse<.05&&st.mode==='title'){const l=$('logo');l.classList.remove('pulse');void l.offsetWidth;l.classList.add('pulse');theme.pulse=0}
  if(st.mode==='title')$('press').style.visibility=(performance.now()/1000%1)<.6?'visible':'hidden';
  const fl=opt.flash?1:.3,fa=Math.max(0,1-(t-st.flashT)/.45),fe=$('flash');fe.style.background=st.flashCol;fe.style.opacity=fa*(st.flashCol.includes('255,60,90')?fl:1);
  const sk=st.paused||!opt.shake?0:Math.max(0,1-(t-st.shakeT)/.5),s=stage.dataset.s,A=st.shakeAmp||22;
  const ab=st.paused?0:Math.max(0,1-(t-st.shakeT)/.4),zoom=1+.035*ab*ab;   // chromatic split + punch-in on every LIVE hit
  stage.style.transform=`translate(-50%, -50%) scale(${s*zoom}) translate(${(Math.random()-.5)*A*sk}px,${(Math.random()-.5)*A*sk}px)`;
  if(!IS_MOBILE&&ab>0){const d=(3+11*ab).toFixed(1);$('rgbR').setAttribute('dx',d);$('rgbC').setAttribute('dx',-d);$('rgbR').setAttribute('dy',(ab*2).toFixed(1))}
  const fil=IS_MOBILE?'':((ab>0?'url(#rgbx) ':'')+(sk>0?`saturate(${1+sk}) contrast(${1+.2*sk})`:''));
  if(stage.style.filter!==fil)stage.style.filter=fil;
  // edges glow with the drop: red pulses on every kick after a LIVE, cold blue after a BLANK
  let vg='radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)';
  if(st.mode==='play'&&st.rev){const ph=(((t-st.t0)/SD)%4+4)%4*SD,pu=Math.exp(-ph*7),live=G.mag[st.i];
    vg=live?`radial-gradient(ellipse at center,transparent ${38-6*pu}%,rgba(${150+60*pu|0},0,30,${(.55+.3*pu).toFixed(2)}) 100%)`
           :`radial-gradient(ellipse at center,transparent 42%,rgba(10,55,110,${(.5+.12*pu).toFixed(2)}) 100%)`}
  else if(st.mode==='over'&&!run.won)vg='radial-gradient(ellipse at center,transparent 35%,rgba(120,0,20,.8) 100%)';
  const ve=$('vig');if(ve._v!==vg){ve._v=vg;ve.style.background=vg}
  if(st.mode==='init'&&performance.now()>ini.deadline)initConfirm();
  grain();requestAnimationFrame(frame);
}
const gc=$('grain').getContext('2d'),gimg=gc.createImageData(180,320);let gf=0;
function grain(){if(IS_MOBILE||(gf++%2))return;const d=gimg.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}gc.putImageData(gimg,0,0)}
