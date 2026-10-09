// Beat The Dealer: canvas drawing: shells, scope, traces, intro animation
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
  if(labels){g.font='600 13px "Barlow Semi Condensed"';g.textAlign='center';g.fillStyle=col;
    vis.forEach((n,j)=>{if(n.lab==null)return;g.fillText(String(n.lab),X(n.s)+4,548-(j%2)*13)})}
  return head?{x:head[0],y:head[1],col}:null;
}
function ticks(Ls,cur){
  for(const l of Ls){if(l.mode==='none')continue;for(const n of l.notes){if(n.s>cur)continue;
    const x=X(n.s),h=5+((n.p+40)%9)*1.6,latest=cur-n.s<1.2;
    g.fillStyle=latest?'rgba(140,255,180,.95)':'rgba(70,190,120,.55)';g.fillRect(x,826-h-(latest?6:0),2,h+(latest?6:0))}}
}
// shell row (n ≤ 10): revealed shells coloured, current one framed (amber = you, violet = Dealer), under-bar per resolved call, pop on reveal
const ROW={sp:60,w:36,h:88,top:290},rowX=(j,n)=>360+(j-(n-1)/2)*ROW.sp;
const BAR={ok:'#6dffa0',bad:'#ff6b6b',late:'#ffb347',dlr:'#b06cff'};
function topRow(t){
  const n=G.mag.length,{w,h,top}=ROW,amn=run&&run.amnesia,play=st.mode==='play',kt=t-(st.t0+PRE*SD);
  for(let j=0;j<n;j++){const cx=rowX(j,n);let kind='unknown',gl=0,dy=0;
    if(j<st.i&&!amn||(j===st.i&&st.rev))kind=G.mag[j]?'live':'blank';
    if(j===st.i&&play){gl=st.rev?1.4:0;
      if(st.rev&&kt>=0&&kt<.5)dy=-14*Math.exp(-6*kt)*Math.cos(10*kt);
      if(!st.rev){g.save();const fc=st.who==='dlr'?BAR.dlr:'#f0b13a';g.shadowColor=st.who==='dlr'?BAR.dlr:'#ffb52e';g.shadowBlur=18+6*Math.sin(t*8);
        g.strokeStyle=fc;g.lineWidth=2.5;rr(cx-w/2-6,top-6,w+12,h+12,6);g.stroke();g.restore()}}
    drawShell(cx,top+dy,w,h,kind,gl,play&&j>st.i?.75:1);
    const r=st.grid[j];if(r&&(j<st.i||st.rev||st.mode==='over')){g.fillStyle=BAR[r]||BAR.late;g.fillRect(cx-w/2,top+h+8,w,4)}}
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
  const bs=Math.min(73,600/Math.max(1,n-1)),pos=j=>360+(j-(n-1)/2)*bs,hj=j=>Math.sin(j*12.9898+n*78.233)*.5;
  if(T<.45){const al=Math.min(1,Math.max(0,(.42-T)/.12))*Math.min(1,T/.08);
    if(al>0){g.save();g.globalAlpha=al;g.textAlign='center';g.textBaseline='alphabetic';const xl=L?(pos(0)+pos(L-1))/2:360,xb=n-L?(pos(L)+pos(n-1))/2:360;
      g.font='700 30px "Barlow Semi Condensed"';g.shadowBlur=14;
      if(L){g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.fillText(`${L} LIVE`,xl,744)}if(n-L){g.fillStyle='#62e6ff';g.shadowColor='#62e6ff';g.fillText(`${n-L} BLANK`,xb,744)}
      g.shadowBlur=0;g.font='600 15px "Barlow Semi Condensed"';g.fillStyle='#cfd8d2';if(L)g.fillText('the riff drops 2 octaves',xl,768);if(n-L)g.fillText('it turns into bells',xb,768);g.restore()}}
  // queue position: after shell k leaves, the rest slide one slot left (eased, done before the next launch)
  const f=(T-LOAD0)/LOADG,shift=T<LOAD0?0:Math.floor(f)+smooth((f-Math.floor(f))/.75);
  for(let j=0;j<n;j++){let cx=pos(j),top=578,w=52,h=120,kind=j<L?'live':'blank',gl=.8,al=Math.min(1,T/.08);
    if(T>.28){kind='unknown';gl=0}
    // rattle between the flip and the first launch
    if(T>.3&&T<LOAD0){const e=Math.sin(Math.PI*(T-.3)/(LOAD0-.3));top=578-36*hj(j)*e+Math.sin(T*60+j*2)*5*e;cx+=hj(j+3)*10*e}
    const tl=loadAt(j);
    if(T>=LOAD0&&T<tl)cx=pos(0)+Math.max(0,j-shift)*bs;
    if(T>=tl){const k=Math.min(1,(T-tl)/LOADD),e=1-Math.pow(1-k,3);
      cx=lerp(pos(0),rowX(j,n),e);top=lerp(578,ROW.top,e)-Math.sin(k*Math.PI)*24;w=lerp(52,ROW.w,e);h=lerp(120,ROW.h,e);
      if(k>=1)gl=Math.max(0,1.2-(T-tl-LOADD)*5)}
    drawShell(cx,top,w,h,kind,gl,al);
    // landing ring on the slot
    const kr=(T-tl-LOADD)/.35;if(kr>=0&&kr<1){g.save();g.globalAlpha=1-kr;g.strokeStyle='#6dffa0';g.shadowColor='#6dffa0';g.shadowBlur=16;g.lineWidth=3;
      g.beginPath();g.arc(rowX(j,n),ROW.top+ROW.h/2,24+22*smooth(kr),0,7);g.stroke();g.restore()}}
}
function introDraw(t,T0,n,L,plan){
  const T=t-T0,bs=Math.min(73,600/Math.max(1,n-1)),pos=j=>360+(j-(n-1)/2)*bs,{a,b,c}=plan;
  if(plan.video){introVideo(T,n,L);introText(T,plan);return}
  if(!st.perm||st.perm.length!==n)st.perm=shuffle([...Array(n).keys()],Math.random);
  // labels under the loaded magazine (fade out when the shuffle starts)
  if(plan.labels&&T<a+.3){const al=Math.min(1,Math.max(0,(T-dropAt(plan,n-1,n))/.25))*Math.max(0,Math.min(1,(a+.3-T)/.3));
    if(al>0){g.save();g.globalAlpha=al;g.textAlign='center';g.textBaseline='alphabetic';
      const xl=L?(pos(0)+pos(L-1))/2:360,xb=n-L?(pos(L)+pos(n-1))/2:360;
      g.font='700 30px "Barlow Semi Condensed"';g.shadowBlur=14;
      if(L){g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.fillText(`${L} LIVE`,xl,744)}
      if(n-L){g.fillStyle='#62e6ff';g.shadowColor='#62e6ff';g.fillText(`${n-L} BLANK`,xb,744)}
      g.shadowBlur=0;g.font='600 15px "Barlow Semi Condensed"';g.fillStyle='#cfd8d2';
      if(L)g.fillText('the riff drops 2 octaves',xl,768);if(n-L)g.fillText('it turns into bells',xb,768);g.restore()}}
  for(let j=0;j<n;j++){
    const kind0=j<L?'live':'blank';let cx=pos(j),top=578,w=52,h=120,kind=kind0,gl=.8;
    if(plan.drop&&T<a){const td=dropAt(plan,j,n);if(T<td)continue;
      // fall, hit the table, small bounce
      const k=(T-td)/.16;top=k<1?lerp(-140,578,k*k):578-18*Math.exp(-(k-1)*1.6)*Math.abs(Math.sin((k-1)*2.4));
      if(k>=1&&k<1.6)gl=.8+1.2*(1.6-k)}
    if(T>a&&T<b){const k=(T-a)/(b-a),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      cx=lerp(pos(j),pos(st.perm[j]),e);top=578-Math.sin(e*Math.PI)*(j%2?60:-40)-Math.abs(Math.sin(T*14+j))*10;kind=k>.35?'unknown':kind0;gl=k>.35?0:.8}
    if(T>=b){const k=Math.min(1,(T-b)/(c-b)),e=1-Math.pow(1-k,3);
      cx=lerp(pos(st.perm[j]),rowX(st.perm[j],n),e);top=lerp(578,ROW.top,e);w=lerp(52,ROW.w,e);h=lerp(120,ROW.h,e);kind='unknown';gl=0}
    drawShell(cx,top,w,h,kind,gl)}
  introText(T,plan);
}
function introText(T,plan){
  if(plan.text&&T>3.0){const fade=Math.max(0,Math.min(1,(INTRO-.1-T)/.5));g.save();g.textBaseline='alphabetic';
    // LIVE or BLANK? slams in, GUESS RIGHT. types in, ...OR ELSE. hits with the gunshot
    const k=Math.min(1,(T-3)/.18),sc=1+.5*(1-k)*(1-k);g.globalAlpha=k*fade;
    g.translate(360,598);g.scale(sc,sc);
    g.font='700 58px "Barlow Semi Condensed"';const w1=g.measureText('LIVE').width;g.font='700 32px "Barlow Semi Condensed"';const w2=g.measureText(' or ').width;
    g.font='700 58px "Barlow Semi Condensed"';const w3=g.measureText('BLANK?').width;let x=-(w1+w2+w3)/2;g.textAlign='left';
    g.shadowBlur=20;g.shadowColor='#ff2d55';g.fillStyle='#ff2d55';g.fillText('LIVE',x,0);x+=w1;
    g.shadowBlur=0;g.font='700 32px "Barlow Semi Condensed"';g.fillStyle='#fff';g.fillText(' or ',x,0);x+=w2;
    g.font='700 58px "Barlow Semi Condensed"';g.shadowColor='#62e6ff';g.shadowBlur=20;g.fillStyle='#62e6ff';g.fillText('BLANK?',x,0);
    g.setTransform(1,0,0,1,0,0);g.shadowBlur=0;g.textAlign='center';g.globalAlpha=fade;
    if(T>3.5){const s='GUESS RIGHT.';g.font='700 36px "Barlow Semi Condensed"';g.fillStyle='#fff';g.fillText(s.slice(0,Math.ceil((T-3.5)/.05)),360,656)}
    if(T>plan.flash){const j=Math.max(0,1-(T-plan.flash)/.25),dx=(Math.random()-.5)*14*j;
      g.font='700 44px "Barlow Semi Condensed"';g.fillStyle='#ff2d55';g.shadowColor='#ff2d55';g.shadowBlur=24;
      g.globalAlpha=fade*.5;g.fillStyle='#00e5ff';g.fillText('...OR ELSE.',360+dx-4*j,722);
      g.globalAlpha=fade;g.fillStyle='#ff2d55';g.fillText('...OR ELSE.',360+dx,722)}
    g.restore()}
  if(plan.flash&&T>plan.flash&&!st.introFlash){st.introFlash=1;st.flashT=now();st.flashCol='rgba(255,60,90,.55)';st.shakeT=now();st.tintTarget=[160,10,40,.7]}
}

