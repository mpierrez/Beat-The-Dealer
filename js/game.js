// Beat The Dealer: state, modes, difficulty, leaderboard, title theme, screens, run logic, HUD, pause
"use strict";
// ---------- state ----------
const st={mode:'title',i:0,t0:0,rev:false,guess:null,grid:[],pre:[],post:[],introT0:0,paused:false,who:'you',locked:0,gamma:1,
  flashT:-9,flashCol:'',shakeT:-9,shakeAmp:22,tint:[30,60,40,.5],tintTarget:[30,60,40,.5],perm:null,introFlash:0};
let run=null;   // the current run; null before the first run
const now=()=>ctx?ctx.currentTime:performance.now()/1000;
const RUN_STATES=['intro','reload','play','over'];
const inRun=()=>RUN_STATES.includes(st.mode);

// ---------- modes ----------
const MODES={
  classic:{name:'CLASSIC',col:'#e8195a',tag:'The reel. Count. Call. Cash in.',
    rules:['8 shells: 4 live, 4 blank, shuffled.','Call each one before the trigger.','Long shots pay more. Streaks multiply.']},
  survival:{name:'SURVIVAL',col:'#ff3d6e',tag:"Dead man's magazine.",
    rules:['Magazine after magazine. 3 hearts.','A miss costs a heart. A perfect magazine heals.','The lock creeps closer. The key keeps rising.']},
  duel:{name:'VS DEALER',col:'#b06cff',tag:'One gun. Two players. Buckshot rules.',
    rules:['LIVE shoots the Dealer. BLANK shoots you.','A blank on yourself: shoot again.','Three stages. Call his shells for points.']},
  daily:{name:'DAILY DEALER',col:'#f6d342',tag:'One seed per day. One ranked shot.',
    rules:['Same magazine for everyone today.','One ranked attempt, then practice.']},
};
const MODE_KEYS=['classic','survival','duel','daily'];
// difficulty: EASY = plain-words formulas, P(LIVE) in %, wider beat window; HARD = dense formulas, P(LIVE) hidden (count yourself)
const DIFFS={easy:{name:'EASY',col:'#6dffa0',k:.75,win:.12,blunder:[.4,.25,.12],lamD:0,desc:'Plain formulas. Odds in %. Wide beat window. Score ×0.75'},
  normal:{name:'NORMAL',col:'#f6d342',k:1,win:.07,blunder:[.25,.12,0],lamD:0,desc:'The reel. Score ×1'},
  hard:{name:'HARD',col:'#ff3d6e',k:1.5,win:.05,blunder:[.08,0,0],lamD:4,desc:'Dense formulas. P(LIVE) hidden: count. Score ×1.5'}};
const DIFF_KEYS=['easy','normal','hard'];let DIFF=DIFF_KEYS.includes(store.get('diff','normal'))?store.get('diff','normal'):'normal';
const D=()=>DIFFS[(run&&run.diff)||DIFF];
function setDiff(d){DIFF=DIFF_KEYS[(DIFF_KEYS.indexOf(DIFF)+d+3)%3];store.set('diff',DIFF);if(ctx)V.tick(now(),1);menuRender()}
const MODS=[{name:'STANDARD',n:8,L:4,d:'4 live, 4 blank.'},{name:'HEAVY LOAD',n:8,L:6,d:'6 live, 2 blank.'},
            {name:'DRY SPELL',n:8,L:2,d:'2 live, 6 blank.'},{name:'TEN-GAUGE',n:10,L:5,d:'10 shells, 5 live.'}];
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const daySeed=date=>fnv1a32('BTD1|'+date);
const dailyMod=date=>MODS[Math.floor(mulberry32(daySeed(date))()*MODS.length)];   // same first draw as startRun

// ---------- leaderboard (local) ----------
const CPU_N=['DLR','808','BEL','SAW','PAD','HAT','KIK','CLP','ODD','ZZZ'];
const CPU_S={classic:[15000,10000,6000,4000,3000,2200,1600,1100,700,300],survival:[60000,40000,25000,16000,10000,7000,5000,3000,1500,600],
             duel:[45000,30000,20000,14000,10000,7000,5000,3500,2000,800]};
const CPU_X={classic:j=>`${[8,8,7,7,6,6,5,5,4,3][j]}/8`,survival:j=>`MAG ${[12,10,8,7,6,5,4,3,2,1][j]}`,duel:j=>j<3?'III':j<6?'II':'I'};
function table(mode,date=today()){
  if(mode==='daily')return(store.get('hs.daily',{})[date]||[]).slice();
  let t=store.get('hs.'+mode,null);
  if(!t){t=CPU_S[mode].map((s,j)=>({n:CPU_N[j],s,t:j,cpu:1,x:CPU_X[mode](j)}));store.set('hs.'+mode,t)}
  return t.slice()}
function saveTable(mode,date,t){
  if(mode!=='daily')return store.set('hs.'+mode,t);
  const all=store.get('hs.daily',{});all[date]=t;for(const k of Object.keys(all).sort().reverse().slice(14))delete all[k];store.set('hs.daily',all)}
const cmpE=(a,b)=>b.s-a.s||a.t-b.t;
function qualifies(mode,date,s){if(s<=0)return false;const t=table(mode,date);return t.length<10||s>t[Math.min(9,t.length-1)].s}
function insertE(mode,date,e){const t=table(mode,date);t.push(e);t.sort(cmpE);const r=t.slice(0,10);saveTable(mode,date,r);return r.indexOf(e)}
const fmtD=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const fmtT=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'\\,');
const ord=r=>r+(r===1?'ST':r===2?'ND':r===3?'RD':'TH');
const roman=s=>['I','II','III'][s-1]||String(s);

// ---------- title theme: Fm → G♭ loop, kicks, glass bells (same voices as the game) ----------
let theme=null;
const THEME_G={scale:SCALES[0].s,scaleTex:'',key:0,shells:[],mag:[]},THEME_PROG=[0,1,0,5];
function themeStart(){if(!ctx||theme)return;theme={route:mkRoute(menuLP,.85),next:now()+.15,bar:0}}
function themeStop(t){if(!theme)return;killRoute(theme.route,t);theme=null}
function themeMuffle(hz){if(menuLP&&ctx)menuLP.frequency.setTargetAtTime(hz,now(),.12)}
function themeTick(){
  if(!theme||ctx.state!=='running')return;
  if(theme.next<now())theme.next=now()+.05;
  while(theme.next<now()+1.2){const t=theme.next,b=theme.bar++,deg=THEME_PROG[b%4];
    withG(THEME_G,()=>routeTo(theme.route,()=>{
      V.pad(t,deg,2,.9);
      for(let k=0;k<4;k++){V.kick(t+k*.5,k%2?.45:.85);if(b%4>0)V.hat(t+k*.5+.25,.45)}
      const T=[deg,deg+2,deg+4,deg+7].map(d=>semis(fitOct(d,0,6)));
      const pat=b%2?[0,1,2,3,2,1,2,3]:[3,2,1,0,1,2,1,0];
      for(let k=0;k<8;k++)if(k%2===0||Math.random()<.45)V.bell(t+k*.25,T[pat[k]]+12,.25,.42);
      if(b%8===7)V.riser(t+1,1);
      if(b%8===0&&b>0){V.dryfire(t);theme.pulse=t}}));
    theme.next+=2}}

// ---------- screens ----------
const SCR=['scrTitle','scrMenu','scrHow','scrHof','scrResults','scrInit'];
function show(id){for(const s of SCR)$(s).classList.toggle('hide',s!==id)}
let menuIdx=Math.max(0,MODE_KEYS.indexOf((store.get('last',{})||{}).mode));
function titleRender(){
  const hi=table('classic')[0],last=store.get('last',{})||{};
  $('t1up').textContent='1UP '+String(last.s||0).padStart(6,'0');$('tHi').textContent=String(hi?hi.s:0).padStart(6,'0');
  $('tCred').textContent=ctx?'01':'00';
  $('tMarqTxt').textContent=MODE_KEYS.map(m=>{const e=table(m)[0];return`${MODES[m].name} 1ST ${e?e.n+' '+fmtD(e.s):'—'}`}).join('   ·   ')}
function goTitle(){st.mode='title';show('scrTitle');themeMuffle(18000);titleRender();hideGame()}
function goMenu(){initAudio();ctx.resume();uiLock=performance.now()+400;if(st.mode==='title')V.rack(now());
  st.mode='menu';show('scrMenu');themeStart();themeMuffle(2600);menuRender();hideGame()}
function hideGame(){$('ctrl').style.display='none';$('pauseBtn').style.display='none';for(const id of['mA','mB','mC'])setTex($(id),'')}
function menuRender(){
  const k=MODE_KEYS[menuIdx],M=MODES[k],c=$('card');$('scrMenu').style.setProperty('--mc',M.col);c.style.setProperty('--mc',M.col);
  $('cName').textContent=M.name;$('cTag').textContent=M.tag;
  const rules=M.rules.slice();let chip='';
  if(k==='daily'){const d=today(),mod=dailyMod(d),log=store.get('daily.log',{});rules.push(`Today: ${mod.name}. ${mod.d}`);
    chip=log[d]?(log[d].done?`TODAY ${fmtD(log[d].s)} · PRACTICE ONLY`:'PRACTICE ONLY'):'RANKED ATTEMPT READY'}
  $('cRules').innerHTML=rules.map(r=>`<div>${r}</div>`).join('');
  const best=table(k)[0];$('cBest').textContent=best?`BEST   ${best.n}   ${fmtD(best.s)}`:'BEST   —';
  const pb=(store.get('pb',{})||{})[k];$('cPb').textContent=`YOUR BEST ${pb?fmtD(pb):'—'}`;$('cChip').textContent=chip;
  const Dd=DIFFS[DIFF];$('dVal').textContent='DIFFICULTY: '+Dd.name;$('dVal').style.color=Dd.col;$('dDesc').textContent=Dd.desc;
  $('dots').innerHTML=MODE_KEYS.map((_,j)=>`<i class="${j===menuIdx?'on':''}"></i>`).join('');
  onCtx($('cVig').getContext('2d'),()=>{g.clearRect(0,0,480,200);
    if(k==='classic')for(let j=0;j<8;j++)drawShell(240+(j-3.5)*54,40,36,100,j<4?'live':'blank',.5);
    else if(k==='survival'){for(let r=0;r<3;r++)for(let j=0;j<r+3;j++)drawShell(240+(j-(r+2)/2)*40,8+r*64,24,56,'unknown');
      g.font='700 40px "Barlow Semi Condensed"';g.fillStyle=COL.r;g.textAlign='right';g.textBaseline='top';g.fillText('♥♥♥',470,4)}
    else if(k==='duel'){for(let j=0;j<3;j++){drawShell(60+j*50,60,34,96,'unknown');drawShell(320+j*50,60,34,96,'unknown')}
      g.font='700 34px "Barlow Semi Condensed"';g.textAlign='center';g.textBaseline='top';g.fillStyle='#ffb52e';g.fillText('YOU ♥♥',110,10);g.fillStyle=COL.v;g.fillText('♥♥ DLR',370,10)}
    else{const d=today();g.font='700 80px "Barlow Semi Condensed"';g.fillStyle='#f6d342';g.textAlign='center';g.textBaseline='top';g.fillText(d.slice(5).replace('-','·'),240,0);
      for(let j=0;j<8;j++)drawShell(240+(j-3.5)*48,104,28,80,'unknown')}})}
function menuMove(d){menuIdx=(menuIdx+d+MODE_KEYS.length)%MODE_KEYS.length;
  const c=$('card');c.style.setProperty('--dx',(d*-40)+'px');c.classList.add('slide');setTimeout(()=>c.classList.remove('slide'),120);
  menuRender();if(ctx)withG(THEME_G,()=>V.lead(now()+.01,[0,3,7,10][menuIdx],.12,.6))}
let howThenPlay=false;
function howOpen(thenPlay=false){howThenPlay=thenPlay;st.mode='how';show('scrHow');themeMuffle(900);$('hBack').textContent=thenPlay?'GOT IT':'BACK'}
function howClose(){const seen=store.get('seen',{});seen.howto=1;store.set('seen',seen);if(howThenPlay)startRun(MODE_KEYS[menuIdx]);else goMenu()}
function menuPlay(){if(!(store.get('seen',{})||{}).howto)return howOpen(true);startRun(MODE_KEYS[menuIdx])}

// hall of fame
const hof={tab:0,hi:-1,post:false};
function hofOpen(mode,hi=-1,post=false){hof.tab=Math.max(0,MODE_KEYS.indexOf(mode));hof.hi=hi;hof.post=post;st.mode='hof';show('scrHof');themeStart();themeMuffle(900);hofRender()}
function hofRender(){
  const k=MODE_KEYS[hof.tab],t=table(k),me=(store.get('me',{})||{}).n;
  $('hofTabs').innerHTML=MODE_KEYS.map((m,j)=>`<button class="tab ${j===hof.tab?'on':''}" data-j="${j}" style="--mc:${MODES[m].col}">${MODES[m].name}</button>`).join('');
  $('hofDate').textContent=k==='daily'?`${today()} · ${dailyMod(today()).name}`:'';
  const RC=['#ffd84a','#cfd8dc','#d08a4a'],CY=['#e8195a','#f6d342','#7ef2ff','#f4f4f2'];
  $('hofRows').innerHTML=Array.from({length:10},(_,r)=>{const e=t[r];
    if(!e)return`<div class="row empty"><span class="rk">${ord(r+1)}</span><span class="nm">---</span><span class="sc">·····</span><span class="dt"></span></div>`;
    return`<div class="row ${e.cpu?'cpu':''} ${r===hof.hi?'new':''}" style="color:${CY[r%4]}"><span class="rk" style="color:${RC[r]||'#f4f4f2'}">${ord(r+1)}</span><span class="nm">${e.n}</span><span class="sc">${fmtD(e.s)}</span><span class="dt">${e.x||''}${e.n===me&&!e.cpu?' ◄':''}</span></div>`}).join('');
  const pb=(store.get('pb',{})||{})[k];$('hofFoot').textContent=(pb?`YOUR BEST ${fmtD(pb)}`:'')+(store.ok?'':'   ·   RECORDS LAST UNTIL YOU CLOSE THIS TAB');
  $('hofBtns').innerHTML=hof.post?'<button class="pbtn" id="hRetry">RETRY</button><button class="pbtn sec" id="hMenu">MENU</button>':'<button class="pbtn" id="hMenu">BACK</button>'}
function hofBack(retry){if(retry&&hof.post&&run)startRun(run.mode);else goMenu()}

// ---------- run ----------
function startRun(mode){
  initAudio();ctx.resume();
  const tb=now()+.15;themeStop(tb);
  if(run)killRoute(run.route);
  const date=today();
  run={mode,diff:DIFF,route:mkRoute(bus),date,sigma:0,shown:0,streak:0,bestM:1,correct:0,calls:0,shells:0,onBeat:0,maxW:0,late:0,
    hp:3,hpMax:5,k:1,magOk:true,stage:1,H:2,hpD:2,nextWho:'you',hits:0,extra:0,stageHurt:false,won:false,perfect:0,lam:32,
    ranked:false,practice:false,mod:null,qual:false,cpuStep:null,cpuCall:null,segT0:0,stageCard:false};
  const last=store.get('last',{})||{};last.mode=mode;store.set('last',last);
  if(mode==='daily'){
    R=mulberry32(daySeed(date));run.mod=MODS[rnd(MODS.length)];newGame(run.mod.n,run.mod.L);R=Math.random;
    const log=store.get('daily.log',{})||{};
    if(!log[date]){log[date]={start:Date.now(),mod:run.mod.name};store.set('daily.log',log);run.ranked=true}else run.practice=true}
  else if(mode==='survival')newGame(3,1+rnd(2));
  else if(mode==='duel'){run.H=2;run.hp=run.hpD=2;newGame(3,1)}
  else newGame(8,4);
  st.grid=[];st.i=0;st.mode='intro';st.paused=false;st.who='you';st.rev=false;st.introT0=tb;st.introFlash=0;st.perm=null;
  show(null);$('scrPause').classList.add('hide');$('pauseBtn').style.display='block';$('ctrl').style.display='none';
  const t=st.introT0,b=SD*4;
  routeTo(run.route,()=>{
    for(let k=0;k<9;k++){V.kick(t+k*b,k%4===0?1:.8);V.kick(t+k*b+b/2,.3)}
    for(let k=0;k<5;k++)V.tick(t+.5+k*.06,.8);                                // rattle
    for(let j=0,n=G.mag.length;j<n;j++){V.tick(t+loadAt(j),.7);V.clink(t+loadAt(j)+LOADD)}   // loaded one by one
    V.pad(t+2.5,0,1.95,1.2);V.riser(t+3.5,1);V.gunshot(t+4.5)});
  hud();
}
function counts(){const n=G.mag.length,i=st.i,L=G.mag.slice(i).reduce((a,b)=>a+b,0);return{n,L,left:n-i}}
function startShell(i,t0,who='you'){
  st.mode='play';st.i=i;st.t0=t0;st.rev=false;st.guess=null;st.who=who;st.locked=0;st.gamma=1;st.lastPay=0;
  const res=G.mag[i];st.pre=layers(i,'pre',null,who);st.post=layers(i,'post',res);
  routeTo(run.route,()=>{schedule(st.pre,t0);schedule(st.post,t0);drums(t0,'pre');drums(t0,'post',res);
    const tt=t0+PRE*SD;if(res)V.gunshot(tt);else V.dryfire(tt);V.clink(tt)});
  run.cpuStep=who==='dlr'?8+rnd(17):null;run.cpuCall=null;
  run.lam=run.mode==='survival'?Math.max(16,(run.k<=3?32:run.k<=5?28:run.k<=7?24:20)-(run.k>1?D().lamD:0)):32;
  $('ctrl').style.display='flex';
  for(const id of['bL','bB']){const b=$(id);b.disabled=false;b.className='btn '+(id==='bL'?'live':'blank')+(who==='dlr'?' call':'')}
  hud();
}
function call(v){
  if(st.mode!=='play'||st.paused||st.rev||st.guess!==null)return;
  const step=(now()-st.t0)/SD;if(step<0||step>=run.lam)return;
  st.guess=v;
  const tp=now()-(ctx.outputLatency||ctx.baseLatency||0),pos=(tp-st.t0)/SD,r=((pos%4)+4)%4,dl=Math.min(r,4-r)*SD;
  st.gamma=dl<=D().win?1.25:1;
  const me=$(v?'bL':'bB'),ot=$(v?'bB':'bL');me.classList.add('on');ot.classList.add('off');
  for(const b of[me,ot])b.disabled=true;
  if(st.gamma>1){V.rim(now());me.classList.add('gold');setTimeout(()=>me.classList.remove('gold'),160)}else V.tick(now(),1.5);
  hud();
}
function lockButtons(){for(const id of['bL','bB']){const b=$(id);b.disabled=true;b.classList.add('off')}}
function cpuDecide(){
  const{L,left}=counts(),P=L/left;
  let c=P===1?1:P===0?0:P>.5?1:P<.5?0:(Math.random()<.5?1:0);
  if(P>0&&P<1&&Math.random()<D().blunder[run.stage-1])c=Math.random()<.5?1:0;
  run.cpuCall=c;run.cpuAt=(now()-st.t0)/SD;V.tick(now(),1);
}
function payOf(v){const{L,left}=counts(),K=v?L:left-L;return K?{w:left/K,K}:{w:0,K:0}}
function fx(kind){const e=$('mA');e.classList.remove('hurt','heal');void e.offsetWidth;e.classList.add(kind)}
function reveal(){
  st.rev=true;const i=st.i,res=G.mag[i],n=G.mag.length,v=st.guess,M=Math.min(8,1+run.streak),m=run.mode;
  const fl=opt.flash?1:.3;st.flashT=now();st.flashCol=res?`rgba(255,190,200,${.75*fl})`:`rgba(170,215,240,${.6*fl})`;
  if(res){st.shakeT=now();st.shakeAmp=22*(.6+.1*M)*(opt.shake?1:0)}
  const{w}=v===null?{w:0}:payOf(v),ok=v!==null&&v===res,dlrTurn=m==='duel'&&st.who==='dlr';
  st.lastM=M;st.lastPay=0;
  if(v!==null)run.calls++;
  if(ok){const pay=Math.round(100*w*st.gamma*M*D().k);st.lastPay=pay;run.sigma+=pay;run.streak++;run.correct++;run.maxW=Math.max(run.maxW,w);
    if(st.gamma>1)run.onBeat++;run.bestM=Math.max(run.bestM,Math.min(8,1+run.streak))}
  else if(!(dlrTurn&&v===null))run.streak=0;
  if(v===null&&!dlrTurn)run.late++;
  run.shells++;
  st.grid[i]=dlrTurn&&v===null?'dlr':v===null?'late':ok?'ok':'bad';
  if(m==='survival'&&!ok){run.hp--;run.magOk=false;fx('hurt')}
  if(m==='duel'){const you=st.who==='you',c=you?(v===null?0:v):run.cpuCall;run.shot={you,c,res};
    if(you){if(c===1){if(res){run.hpD--;run.hits++;run.sigma+=300*run.stage}run.nextWho='dlr'}
            else if(res){run.hp--;run.stageHurt=true;fx('hurt');run.nextWho='dlr'}
            else{run.extra++;run.sigma+=150*run.stage;run.nextWho='you'}}
    else{if(c===1){if(res){run.hp--;run.stageHurt=true;fx('hurt')}run.nextWho='you'}
         else if(res){run.hpD--;run.nextWho='you'}else run.nextWho='dlr'}}
  if((m==='classic'||m==='daily')&&i===n-1&&st.grid.length===n&&st.grid.every(x=>x==='ok')){run.perfect=Math.round(8888*n/8);run.sigma+=run.perfect}
  // button readouts
  for(const id of['bL','bB'])$(id).disabled=true;
  if(v===null){if(!dlrTurn)for(const id of['bL','bB'])$(id).classList.add('late')}
  hud();
}
function afterShell(tn){
  const n=G.mag.length,m=run.mode;
  if(m==='survival'){
    if(run.hp<=0)return over(tn,false);
    if(st.i<n-1)return startShell(st.i+1,tn,'you');
    run.magBonus=250*run.k+(run.magOk?500*run.k:0);run.sigma+=run.magBonus;run.healed=false;
    if(run.magOk&&run.hp<run.hpMax){run.hp++;run.healed=true;fx('heal');
      routeTo(run.route,()=>[12,15,19].forEach((p,k)=>V.bell(tn+k*SD,p,.3,.7)))}
    run.k++;run.magOk=true;const nn=Math.min(8,run.k+2);newGame(nn,1+rnd(nn-1),{key:(run.k-1)%6});return startReload(tn)}
  if(m==='duel'){
    if(run.hp<=0)return over(tn,false);
    if(run.hpD<=0){run.sigma+=2000*run.stage+500*run.hp+(run.stageHurt?0:3000*run.stage);
      if(run.stage>=3){run.sigma+=10000;return over(tn,true)}
      run.stage++;run.H=run.stage+1;run.hp=run.hpD=run.H;run.stageHurt=false;run.nextWho='you';
      const nn=2+rnd(7);newGame(nn,1+rnd(nn-1),run.stage===3?{sc:SCALES[3]}:{});return startReload(tn,true)}
    if(st.i<n-1)return startShell(st.i+1,tn,run.nextWho);
    const nn=2+rnd(7);newGame(nn,1+rnd(nn-1));return startReload(tn)}
  if(st.i<n-1)return startShell(st.i+1,tn,'you');
  endRun(tn);
}
function startReload(t0,stage=false){
  st.mode='reload';run.segT0=t0;run.stageCard=stage;st.perm=null;st.rev=false;st.grid=[];st.i=0;st.introFlash=1;
  $('ctrl').style.display='none';
  const n=G.mag.length;
  routeTo(run.route,()=>{V.rack(t0);for(let b=0;b<8;b++)V.kick(t0+b*.5,b%4===0?1:.85);
    for(let j=0;j<n;j++)V.tick(t0+.25+j*Math.min(.25,1.75/n),1);
    V.riser(t0+2.5,1.5);for(let s=0;s<4;s++)V.hat(t0+3.5+s*SD,.5+s*.23);
    if(stage){V.pad(t0,0,4,1.1);[12,15,19,24].forEach((p,k)=>V.bell(t0+2+k*.5,p,.4,.7))}});
  hud();
}
function over(t0,win){
  st.mode='over';run.segT0=t0;run.won=win;$('ctrl').style.display='none';
  routeTo(run.route,()=>{if(win){V.pad(t0,0,2,1.2);[12,15,19,24].forEach((p,k)=>V.bell(t0+k*.25,p,.3,.7))}else V.flat(t0,2)});
  if(win){st.flashT=t0;st.flashCol='rgba(255,215,90,.6)'}
  hud();
}
function grade(){const m=run.mode,c=run.correct,n=G.mag.length;
  if(m==='survival'){const k=run.k;return k>=10?'S':k>=7?'A':k>=5?'B':k>=3?'C':'D'}
  if(m==='duel')return run.won?'S':run.stage>=3?'A':run.stage===2?'B':run.hits>0?'C':'D';
  return c===n?'S':c>=n-1?'A':c>=.75*n?'B':c>=.5*n?'C':'D'}
function quip(){const m=run.mode,c=run.correct,n=G.mag.length;
  if(m==='survival'){const k=run.k;return k>=10?'THE DEALER RAN OUT OF SHELLS.':k>=7?'THE DEALER IS SWEATING.':k>=4?'THE DEALER RELOADS.':'THE DEALER WINS.'}
  if(m==='duel')return run.won?'YOU BEAT THE DEALER. HE WANTS A REMATCH.':'THE DEALER WILL SEE YOU AGAIN.';
  return c===n?'YOU BEAT THE DEALER.':c>=.75*n?'THE DEALER IS SWEATING.':c>=.5*n?'COIN FLIP ENERGY.':'THE DEALER WINS.'}
function detail(){return detail0()+(run.diff!=='normal'?' '+DIFFS[run.diff].name[0]:'')}
function detail0(){const m=run.mode;
  if(m==='survival')return`MAG ${run.k}`;
  if(m==='duel')return roman(run.stage)+(run.won?' ★':'');
  return`${run.correct}/${G.mag.length} ×${run.bestM}`}
function endRun(){
  const m=run.mode;st.mode='results';killRoute(run.route,now()+1.5);
  $('ctrl').style.display='none';$('pauseBtn').style.display='none';
  const pb=store.get('pb',{})||{};if(!run.practice&&run.sigma>(pb[m]||0)){pb[m]=run.sigma;store.set('pb',pb)}
  const last=store.get('last',{})||{};last.s=run.sigma;store.set('last',last);
  if(m==='daily'){const log=store.get('daily.log',{})||{};if(run.ranked&&log[run.date]){Object.assign(log[run.date],{done:1,s:run.sigma,mod:run.mod.name});store.set('daily.log',log)}}
  run.qual=!run.practice&&qualifies(m,run.date,run.sigma);
  $('rMode').textContent=MODES[m].name+' · '+DIFFS[run.diff].name+(m==='daily'?` · ${run.date} · ${run.mod.name}${run.practice?' · PRACTICE':''}`:'');
  $('rScore').textContent=fmtD(run.sigma);
  const gr=grade(),gc={S:'#ffd84a',A:'#e8195a',B:'#7ef2ff',C:'#f4f4f2',D:'#6f8578'}[gr];
  const ge=$('rGrade');ge.textContent=gr;ge.style.color=gc;ge.style.animation='none';void ge.offsetWidth;ge.style.animation='';
  $('rQuip').textContent=quip();
  let rows;
  if(m==='survival')rows=[['MAGAZINE',run.k],['SHELLS',run.shells],['CORRECT',run.correct],['BEST STREAK','×'+run.bestM],['ON BEAT',run.onBeat]];
  else if(m==='duel')rows=[['STAGE',roman(run.stage)+(run.won?' ★':'')],['DEALER HITS',run.hits],['EXTRA TURNS',run.extra],['CALLS',`${run.correct}/${run.calls}`],['BEST STREAK','×'+run.bestM]];
  else rows=[['CORRECT',`${run.correct}/${G.mag.length}`],['ON BEAT',run.onBeat],['BEST STREAK','×'+run.bestM],['LONGEST SHOT','×'+run.maxW.toFixed(2)]].concat(run.perfect?[['PERFECT','+'+fmtD(run.perfect)]]:[]);
  $('rStats').innerHTML=rows.map(([a,b])=>`<span>${a}</span><span class="v">${b}</span>`).join('');
  $('rBits').innerHTML=G.mag.map(b=>`<b style="color:${b?COL.r:COL.c}">${b}</b>`).join('');
  $('rNew').textContent=run.qual?'NEW HIGH SCORE!':'';
  $('rMain').textContent=run.qual?'ENTER INITIALS':'RETRY';
  show('scrResults');
  const t=now();if(gr==='S')V.gunshot(t+.05);else V.dryfire(t+.05);
  themeStart();themeMuffle(2600);
}
function resultsMain(){if(run.qual)initOpen();else startRun(run.mode)}

// initials (arcade style)
const CH='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-';const ini={c:[0,0,0],cur:0,deadline:0};
function initOpen(){const me=((store.get('me',{})||{}).n||'AAA').padEnd(3,'A').slice(0,3);
  ini.c=[...me].map(ch=>Math.max(0,CH.indexOf(ch)));ini.cur=0;ini.deadline=performance.now()+30000;
  st.mode='init';show('scrInit');themeMuffle(1400);
  $('iCells').innerHTML=[0,1,2].map(j=>`<div class="cell"><button data-j="${j}" data-d="-1">▲</button><div class="ch" id="ic${j}" data-j="${j}"></div><button data-j="${j}" data-d="1">▼</button></div>`).join('');
  $('iMode').textContent=MODES[run.mode].name+(run.mode==='daily'?' · '+run.date:'');$('iScore').textContent=fmtD(run.sigma);
  const t=table(run.mode,run.date);let r=t.filter(e=>e.s>=run.sigma).length;$('iRank').textContent='RANK '+ord(r+1);initRender()}
function initRender(){for(let j=0;j<3;j++){const e=$('ic'+j);e.textContent=CH[ini.c[j]];e.classList.toggle('cur',j===ini.cur)}}
function initSet(j,d){ini.c[j]=(ini.c[j]+d+CH.length)%CH.length;V.tick(now(),1.2);initRender()}
function initType(ch){const x=CH.indexOf(ch);if(x<0)return;ini.c[ini.cur]=x;ini.cur=Math.min(2,ini.cur+1);V.tick(now(),1.2);initRender()}
function initConfirm(){if(st.mode!=='init')return;
  const n=ini.c.map(x=>CH[x]).join('');store.set('me',{n});
  const r=insertE(run.mode,run.date,{n,s:run.sigma,t:Date.now(),x:detail()});run.qual=false;
  V.gunshot(now()+.02);st.flashT=now();st.flashCol='rgba(255,60,90,.55)';
  if(r===0){V.pad(now(),0,2,1);[12,15,19,24].forEach((p,k)=>V.bell(now()+k*.25,p,.3,.7))}
  hofOpen(run.mode,r,true)}

// ---------- HUD: the math block is the whole in-game interface ----------
const CR='#ff3d6e',CC='#7ef2ff',OKC='#6dffa0',BADC='#ff6b6b',DIM='#2b3a32',VIO='#b06cff';
const tc=(c,s)=>`\\textcolor{${c}}{${s}}`;
const hearts=(h,m,c)=>(h>0?tc(c,'\\heartsuit'.repeat(h)):'')+(m-h>0?tc(DIM,'\\heartsuit'.repeat(m-h)):'');
const magT=(L,B)=>`${L}\\,${tc(CR,'\\mathrm{L}')} + ${B}\\,${tc(CC,'\\mathrm{B}')}`;
const fmtW=x=>Number.isInteger(x)?String(x):x.toFixed(2);
function setSmall(id,s){const e=$(id);if(e.textContent!==s)e.textContent=s}
function hud(){
  if(!run)return;
  const m=run.mode,t=now(),M=Math.min(8,1+run.streak),sig=`\\Sigma = ${fmtT(run.sigma)}`;let A='',B='',C='';
  const YS=()=>`\\text{YOU}\\;${hearts(run.hp,run.H,CR)}`,DS=()=>`${hearts(run.hpD,run.H,VIO)}\\;\\text{DLR}`;
  if(st.mode==='intro'||st.mode==='reload'){
    const n=G.mag.length,L=G.mag.reduce((a,b)=>a+b,0),mag=magT(L,n-L);
    if(m==='survival'){A=`${hearts(run.hp,run.hpMax,CR)}\\quad \\text{mag}_{${run.k}} = ${mag}`;B=`\\text{key: } ${G.scaleTex},\\quad f_{\\text{out}} = f\\cdot 2^{\\,s}`;
      C=run.k>1?`\\Sigma \\mathrel{+}= ${fmtT(run.magBonus||0)}${run.healed?'\\qquad '+tc(OKC,'\\heartsuit + 1'):''}\\qquad ${sig}`:`${sig}\\qquad \\times ${M}`}
    else if(m==='duel'){A=`\\mathrm{${roman(run.stage)}}\\quad ${YS()}\\qquad ${DS()}`;B=`\\text{mag} = ${mag}`;
      C=run.stageCard?`\\text{stage}\\ \\mathrm{${roman(run.stage)}}:\\quad \\heartsuit^{${run.H}}\\ \\text{vs}\\ \\heartsuit^{${run.H}}\\qquad ${sig}`
        :`\\text{LIVE}\\mapsto\\text{shoot}(\\text{DLR}),\\;\\;\\text{BLANK}\\mapsto\\text{shoot}(\\text{YOU})`}
    else if(m==='daily'){A=`\\text{seed} = ${run.date.replace(/-/g,'\\text{-}')}\\qquad\\text{mag} = ${mag}`;
      B=`\\text{${run.mod.name}}:\\quad P_0(\\text{LIVE}) = \\tfrac{${L}}{${n}}`;C=`${sig}\\qquad \\times 1`}
    else{A=`\\text{mag} = ${mag}`;B=`\\text{this game: } ${G.scaleTex},\\quad f_{\\text{out}} = f\\cdot 2^{\\,s}`;C=`${sig}\\qquad \\times 1`}
  }else if(st.mode==='play'||st.mode==='over'){
    const step=(t-st.t0)/SD,sh=G.shells[st.i],{n,L,left}=counts(),res=G.mag[st.i],v=st.guess,dlr=st.who==='dlr';
    const cert=step>=8&&L===left?' = '+tc(CR,'1'):step>=8&&L===0?' = '+tc(CC,'0'):'';
    const P=run.diff==='hard'?`P(\\text{LIVE}) = \\tfrac{?}{${left}}`:run.diff==='easy'?`P(\\text{LIVE}) = \\tfrac{${L}}{${left}} \\approx ${Math.round(100*L/left)}\\%`:`P(\\text{LIVE}) = \\tfrac{${L}}{${left}}${cert}`;
    // riff line
    if(!st.rev){if(sh.style==='boss'){const bits=G.mag.map((b,j)=>j<st.i&&!(run.mode==='survival'&&run.k>=7)?b:'?').join('\\,');B=step<16?`${bits} = \\text{this magazine}`:sh.m2}
                else{const k=run.diff==='easy'?'e':run.diff==='hard'?'h':'m';B=step<16?(sh[k+'1']||sh.m1):(sh[k+'2']||sh.m2)}}
    else B=res?(sh.style==='boss'?'s=-2:\\;\\; 808 + \\text{saw wall} + \\text{bells}':sh.reese?'s=-2:\\;\\; f/4\\;\\;\\text{LIVE (Reese + 808)}':'s=-2:\\;\\; f/4\\;\\;\\text{LIVE (distorted 808)}')
              :'s=+1:\\;\\; 2f\\;\\;\\text{BLANK (glass bells + pad)}';
    const g_=st.gamma>1?'\\cdot 1.25':'',pv=v===null?null:payOf(v),pay=pv&&pv.K?Math.round(100*pv.w*st.gamma*M*D().k):0;
    let payC;
    if(v===null)payC=st.locked?`\\text{LOCK}\\;\\Rightarrow\\;\\varnothing`:`\\Delta\\Sigma = 100\\,\\omega\\,\\gamma\\times ${M}`;
    else if(!pv.K)payC=`P = 0\\;\\Rightarrow\\;\\Delta\\Sigma = 0`;
    else payC=`\\Delta\\Sigma = 100\\cdot ${pv.K===left?'1':`\\tfrac{${left}}{${pv.K}}`}${g_}\\times ${M} = ${fmtT(pay)}`;
    let outC;
    if(st.rev){const ok=v!==null&&v===res,M2=ok?Math.min(8,1+run.streak):1,ML=st.lastM||M;
      outC=v===null?`\\varnothing\\;\\Rightarrow\\;\\Delta\\Sigma = 0\\qquad\\times ${ML}\\to\\times 1`
        :ok?`\\Delta\\Sigma = ${tc(OKC,'+'+fmtT(st.lastPay))}\\qquad \\times ${ML}\\to\\times ${M2}`:`\\Delta\\Sigma = ${tc(BADC,'0')}\\qquad \\times ${ML}\\to\\times 1`;
      if(run.perfect&&st.i===n-1&&step>=40)outC=`\\text{PERFECT}:\\;\\Sigma \\mathrel{+}= ${fmtT(run.perfect)}`}
    if(m==='duel'){
      A=`\\mathrm{${roman(run.stage)}}\\quad ${dlr?YS():`\\boxed{${YS()}}`}\\qquad ${dlr?`\\boxed{${DS()}}`:DS()}`;
      if(!st.rev){const tgt=dlr?(run.cpuCall===null?'\\text{DLR}:\\ \\text{shoot}(\\,?\\,)':`\\text{DLR}:\\ \\text{shoot}(\\text{${run.cpuCall?'YOU':'DLR'}})`)
          :(v===null?'\\text{shoot}(\\,?\\,)':`\\text{shoot}(\\text{${v?'DLR':'YOU'}})`);
        C=`${P}\\quad ${sig}\\quad \\times ${M}\\quad ${tgt}`}
      else{const s=run.shot||{},who=s.you?'\\text{YOU}':'\\text{DLR}',tgt=s.c?(s.you?'\\text{DLR}':'\\text{YOU}'):who;
        let eff=s.res?tc(CR,`\\heartsuit_{${s.c?(s.you?'\\text{DLR}':'\\text{YOU}'):(s.you?'\\text{YOU}':'\\text{DLR}')}} - 1`):(s.c?'\\varnothing':'\\varnothing\\;\\Rightarrow\\;\\text{turn}+1');
        C=`${who}\\to${tgt}:\\ ${eff}\\qquad ${v!==null?(v===res?tc(OKC,'+'+fmtT(st.lastPay)):tc(BADC,'\\times 1')):sig}`}
      if(st.mode==='over')C=run.won?`\\heartsuit_{\\text{DLR}} = 0\\;\\Rightarrow\\;\\text{YOU WIN}`:`\\heartsuit_{\\text{YOU}} = 0\\;\\Rightarrow\\;\\lim_{t\\to\\infty} y(t) = 0`;
    }else{
      A=(m==='survival'?`${hearts(run.hp,run.hpMax,CR)}\\quad `:'')+`${P}\\qquad ${sig}`;
      C=st.rev?outC:payC;
      if(m==='survival'){C=`\\text{mag}_{${run.k}}\\;\\big|\\;`+C;if(st.rev&&!(v!==null&&v===res))C+=`\\quad ${tc(CR,'\\heartsuit - 1')}`}
      if(st.mode==='over')C=`\\heartsuit = 0\\;\\Rightarrow\\;\\lim_{t\\to\\infty} y(t) = 0`;
    }
    // button small lines: payout multipliers (no words)
    if(st.mode==='play'){
      const wl=L?left/L:0,wb=left-L?left/(left-L):0,fx=w=>run.diff==='hard'?'×?':w?'×'+fmtW(w):'×—';
      let sl=fx(wl),sb=fx(wb);
      if(m==='duel'&&!dlr){sl='→DLR '+sl;sb='→YOU '+sb}
      if(st.rev){const okL=v===1&&res===1,okB=v===0&&res===0;
        if(v===null){sl=sb=dlr?'':'∅'}
        else if(v===1)sl=okL?'✓ +'+fmtD(st.lastPay):'✗';else sb=okB?'✓ +'+fmtD(st.lastPay):'✗'}
      else if(st.locked&&v===null)sl=sb='—';
      setSmall('sL',sl);setSmall('sB',sb)}
  }
  setTex($('mA'),A);setTex($('mB'),B);setTex($('mC'),C);
}

// ---------- pause ----------
function pauseGame(){if(st.paused||!inRun())return;st.paused=true;if(ctx)ctx.suspend();
  $('scrPause').classList.remove('hide');$('pNote').textContent=run&&run.ranked?'RANKED ATTEMPT: RESTART OR QUIT ENDS IT.':'';$('pResume').focus({preventScroll:true})}
function resumeGame(){if(!st.paused)return;st.paused=false;$('scrPause').classList.add('hide');if(ctx)ctx.resume()}
function restartGame(){st.paused=false;$('scrPause').classList.add('hide');if(run)killRoute(run.route);if(ctx)ctx.resume();startRun(run.mode)}
function quitGame(){st.paused=false;$('scrPause').classList.add('hide');if(run)killRoute(run.route);if(ctx)ctx.resume();
  st.tintTarget=[30,55,40,.45];goMenu();if(document.activeElement)document.activeElement.blur()}

