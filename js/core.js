// Beat The Dealer: layout, persistence, timing, seeded RNG, music theory, riff generators
"use strict";
// ---------- layout ----------
const stage=document.getElementById('stage');
function fit(){const s=Math.min(innerWidth/720,innerHeight/1280);stage.style.transform=`translate(-50%,-50%) scale(${s})`;stage.dataset.s=s}
addEventListener('resize',fit);fit();
const cv=document.getElementById('cv');let g=cv.getContext('2d');
const $=id=>document.getElementById(id);
// draw into another 2D context (menu/how-to vignettes) with the same helpers
function onCtx(c,fn){const old=g;g=c;try{return fn()}finally{g=old}}

// ---------- persistence (localStorage may throw: private mode, file://) ----------
const store=(()=>{const P='btd.v1.',mem=new Map();let ok=true;
  try{localStorage.setItem(P+'__t','1');localStorage.removeItem(P+'__t')}catch(e){ok=false}
  return{ok,
    get(k,d){if(ok)try{const v=localStorage.getItem(P+k);if(v!=null)return JSON.parse(v)}catch(e){}
             return mem.has(k)?mem.get(k):structuredClone(d)},
    set(k,v){mem.set(k,v);if(ok)try{localStorage.setItem(P+k,JSON.stringify(v))}catch(e){}}}})();
const RM=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();
const opt=Object.assign({vol:3,shake:RM?0:1,flash:RM?0:1,hints:0,off:0},store.get('opt',{}));
const VOLS=[0,.45,.7,.9];

// ---------- timing (measured on the reel: 120 BPM, 2 bars before the trigger, 2 after) ----------
const BPM=120, SD=60/BPM/4;            // one sixteenth
const F3=174.614;                       // the riff sits on F3, like the reel
const PRE=32, POST=32;                  // sixteenths before / after the trigger
const INTRO=6;                          // 3 bars
const fq=p=>F3*Math.pow(2,(p+G.key)/12);   // G.key: transposition in semitones (Survival key change)

// graph geometry
const GX0=75, GXT=355, GX1=635, GY0=488, GY1=806;
const X=s=>s<=PRE?GX0+(GXT-GX0)*s/PRE:GXT+(GX1-GXT)*(s-PRE)/POST;
const Y=p=>Math.max(GY0,Math.min(GY1,639-71*(p+G.key)/12));
const COL={y:'#ffd84a',r:'#ff3d6e',c:'#7ef2ff',g:'#9aa79f',v:'#b06cff'};

// ---------- seeded randomness (R = Math.random except while a seeded game is generated) ----------
let R=Math.random;
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const fnv1a32=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return h>>>0};

// ---------- music theory ----------
const rnd=n=>Math.floor(R()*n), pick=a=>a[rnd(a.length)];
function shuffle(a,f=R){for(let i=a.length-1;i>0;i--){const j=Math.floor(f()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const SCALES=[
  {tex:'\\text{phrygian}',s:[0,1,3,5,7,8,10]},   // the reel's colour: Fm → G♭
  {tex:'\\text{phrygian}',s:[0,1,3,5,7,8,10]},
  {tex:'\\text{minor}',s:[0,2,3,5,7,8,10]},
  {tex:'\\text{harmonic minor}',s:[0,2,3,5,7,8,11]},
  {tex:'\\text{dorian}',s:[0,2,3,5,7,9,10]},
];
const NAMES=['F','G\\flat','G','A\\flat','A','B\\flat','B','C','D\\flat','D','E\\flat','E'];
let G={scale:SCALES[0].s,scaleTex:'F\\ '+SCALES[0].tex,key:0,shells:[],mag:[]};
// run fn with another game as G (title theme drawing/scheduling)
function withG(gm,fn){const old=G;G=gm;try{return fn()}finally{G=old}}
const semis=deg=>G.scale[((deg%7)+7)%7]+12*Math.floor(deg/7);
function quality(deg){const t=semis(deg+2)-semis(deg),f=semis(deg+4)-semis(deg);return f===6?'dim':f===8?'aug':t===3?'m':''}
const chordTex=deg=>NAMES[((semis(deg)+G.key)%12+12)%12]+(quality(deg)==='m'?'{}m':'');
const fitOct=(d,lo,hi)=>{while(d>hi)d-=7;while(d<lo)d+=7;return d};
function progression(){
  const cands=[[0,1],[0,5],[0,6],[0,3],[0,4],[0,2],[5,6],[3,4],[0,1],[0,5]]
    .filter(([a,b])=>!['dim','aug'].includes(quality(a))&&!['dim','aug'].includes(quality(b)));
  return pick(cands);
}

// ---------- riff generators (fresh every game) ----------
const GEN={
  ostinato(pr){
    const m=[0,pick([1,2,3]),pick([4,4,5,7]),0];m[3]=pick([m[1],2,1]);
    const n=[];for(let b=0;b<2;b++){const r=fitOct(pr[b],0,5);for(let k=0;k<8;k++)n.push({s:b*16+k*2,d:2,deg:r+m[k%4]})}
    n[15].deg=fitOct(pr[1],0,5)+pick([0,4]);
    return{n,m1:`\\text{loop} = (${m.join(',\\,')})\\;\\;\\text{scale steps}`,
      m2:`4\\text{ notes}\\times 4\\;\\text{ over }\\;${chordTex(pr[0])}\\to ${chordTex(pr[1])}`,cap:'same 4 notes, new chord: it still fits',
      e1:`\\text{same 4 notes: } (${m.join(',\\,')})\\text{, 4 times}`,e2:`${chordTex(pr[0])}\\text{ then }${chordTex(pr[1])}`,
      h1:`y_n = r_{\\lfloor n/8\\rfloor} + m_{\\,n \\bmod 4},\\quad m=(${m.join(',')})`,h2:`r_0 = ${chordTex(pr[0])},\\;\\; r_1 = ${chordTex(pr[1])},\\;\\; y_{15} \\in r_1`}},
  arp(pr){
    const shapes={up:[0,1,2,3],down:[3,2,1,0],'up-down':[0,1,2,3,2,1],broken:[0,2,1,3],pendulum:[0,2,1,2]};
    const name=pick(Object.keys(shapes)),sh=shapes[name],n=[];
    for(let b=0;b<2;b++){const r=fitOct(pr[b],0,4),T=[r,r+2,r+4,r+7];for(let k=0;k<8;k++)n.push({s:b*16+k*2,d:2,deg:T[sh[(b*8+k)%sh.length]]})}
    return{n,m1:`\\text{arp}_{\\text{${name}}}:\\;\\; ${chordTex(pr[0])}\\to ${chordTex(pr[1])}`,
      m2:`\\text{chord tones only: } 1,\\,3,\\,5,\\,8`,cap:"only chord tones: it can't sound wrong",
      e1:`\\text{only the chord's notes: } 1,\\,3,\\,5,\\,8`,e2:`${chordTex(pr[0])}\\text{ then }${chordTex(pr[1])}`,
      h1:`y_n = c_{\\lfloor n/8\\rfloor} + T_{\\sigma(n \\bmod ${sh.length})},\\quad T=(0,2,4,7)`,h2:`\\sigma = (${sh.join(',')})`}},
  pedal(pr){
    const n=[];let l=null;
    for(let b=0;b<2;b++){const r=fitOct(pr[b],-1,3);l=l===null?r+4:fitOct(l,r+2,r+8);
      for(let k=0;k<8;k++){if(k%2===0)n.push({s:b*16+k*2,d:2,deg:r});else{n.push({s:b*16+k*2,d:2,deg:l});l+=pick([-1,1,1,2,-2]);l=Math.max(r+2,Math.min(r+9,l))}}}
    return{n,m1:`y_{2k} = ${chordTex(pr[0]).replace('m','')},\\qquad y_{2k+1} = y_{2k-1}\\pm 1`,
      m2:`\\text{a pedal note under a moving line}`,cap:'one note keeps coming back: the pedal',
      e1:`\\text{one note, another note, the first one again}`,e2:`\\text{the low note keeps coming back}`,
      h1:`y_{2k}=r,\\quad y_{2k+1}=y_{2k-1}+\\epsilon_k,\\;\\; \\epsilon_k\\in\\{\\pm1,\\pm2\\}`,h2:`r \\in \\{${chordTex(pr[0])},\\,${chordTex(pr[1])}\\}`}},
  run(pr){
    const up=R()<.6,n=[];
    for(let b=0;b<2;b++){const r=fitOct(pr[b],0,4);const shape=up?[0,1,2,3,4,3,2,1]:[7,6,5,4,3,4,5,6];
      for(let k=0;k<8;k++)n.push({s:b*16+k*2,d:2,deg:r+shape[k]})}
    n[15].deg=fitOct(pr[1],0,4)+(up?0:4);
    return{n,m1:`y_{n+1} = y_n ${up?'+':'-'} 1\\quad\\text{(one scale step)}`,
      m2:`\\text{${up?'up':'down'} the scale of }${chordTex(pr[0])},\\text{ then }${chordTex(pr[1])}`,cap:'walk the scale, one step at a time',
      e1:`\\text{${up?'up':'down'} the scale, one step at a time}`,e2:`${chordTex(pr[0])}\\text{ then }${chordTex(pr[1])}`,
      h1:`y_n = r + ${up?'4-':'3+'}\\lvert (n \\bmod 8) - 4\\rvert`,h2:`r \\in \\{${chordTex(pr[0])},\\,${chordTex(pr[1])}\\}`}},
  sync(pr){
    const pats=[{h:[0,3,6,8,11,14],t:'3+3+2+3+3+2',c:'3 + 3 + 2: the groove under half of pop music'},
                {h:[0,3,6,10,12],t:'3+3+4+2+4',c:'off the grid on purpose: syncopation'},
                {h:[0,2,3,6,8,11,12,14],t:'2+1+3+2+3+1+2+2',c:'hits between the beats pull you forward'}];
    const P=pick(pats),n=[];
    for(let b=0;b<2;b++){const r=fitOct(pr[b],0,4),pool=[r,r+7,r+4,r+2,r+4];
      P.h.forEach((h,i)=>{const nx=P.h[i+1]??16;n.push({s:b*16+h,d:Math.min(nx-h,2)*.8,deg:i===0?r:pick(pool)})})}
    return{n,dash:1,m1:`\\text{hits} = \\{${P.h.join(',')}\\}\\subset\\mathbb{Z}_{16}`,m2:`${P.t} = 16\\text{ sixteenths}`,cap:P.c,
      e1:`\\text{notes between the beats}`,e2:`${P.h.length}\\text{ hits per bar}`,
      h1:`y_k = \\mathbf{1}[\\,k \\bmod 16 \\in H\\,]\\cdot c_k,\\quad \\lvert H\\rvert = ${P.h.length}`,h2:`H=\\{${P.h.join(',')}\\}`}},
  call(pr){
    const r=fitOct(pr[0],0,4),r2=fitOct(pr[1],0,4),top=pick([5,6,7]);
    const n=[{s:0,d:2,deg:r},{s:2,d:2,deg:r+2},{s:4,d:2,deg:r+4},{s:6,d:6,deg:r+top},{s:12,d:2,deg:r+4},{s:14,d:2,deg:r+2},
             {s:16,d:2,deg:r2+4},{s:18,d:2,deg:r2+3},{s:20,d:2,deg:r2+2},{s:22,d:6,deg:r2+1},{s:28,d:4,deg:r2}];
    return{n,m1:`\\text{bar 2} = \\text{answer}(\\text{bar 1})`,m2:`\\text{rises on }${chordTex(pr[0])}\\text{, lands on }${chordTex(pr[1])}`,cap:'question, then answer',
      e1:`\\text{bar 1 asks, bar 2 answers}`,e2:`\\text{up on }${chordTex(pr[0])}\\text{, down to }${chordTex(pr[1])}`,
      h1:`y^{(2)}_n = r_2 + 4 - n,\\;\\; n = 0..4`,h2:`y^{(1)} \\nearrow\\;\\; y^{(2)} \\searrow ${chordTex(pr[1])}`}},
  long(pr){
    const r=fitOct(pr[0],0,4),r2=fitOct(pr[1],0,4),df=(1+rnd(30)/10).toFixed(1);
    const n=[{s:0,d:12,deg:r},{s:13,d:3,deg:r+pick([1,2])},{s:16,d:10,deg:r2},{s:27,d:5,deg:r2+pick([1,2,4])}];
    return{n,reese:1,m1:`y=\\text{saw}(ft)+\\text{saw}\\big((f+${df})\\,t\\big)`,m2:`\\text{long notes: }${chordTex(pr[0])}\\to ${chordTex(pr[1])}`,cap:'two saws a few Hz apart beat against each other',
      e1:`\\text{two long notes that wobble}`,e2:`${chordTex(pr[0])}\\to ${chordTex(pr[1])}`,
      h1:`y=\\text{saw}(ft)+\\text{saw}\\big((f+${df})\\,t\\big)`,h2:`\\text{envelope} \\propto \\lvert\\cos(\\pi\\cdot ${df}\\, t)\\rvert`}},
};
function finishRiff(r){
  r.n.forEach(x=>{x.p=semis(x.deg);x.lab=((x.deg%7)+7)%7+1});
  const lo=Math.min(...r.n.map(x=>x.p)),hi=Math.max(...r.n.map(x=>x.p));
  const sh=hi>16?-12:lo<-3?12:0;r.n.forEach(x=>x.p+=sh);
  return r;
}
// a magazine of n shells (L live): n-1 riffs from a style bag, then the boss.
// opts: sc (scale entry, default random), key (semitones), tau (tell probability), tellAll
function newGame(n=8,L=4,opts={}){
  const sc=opts.sc||pick(SCALES),key=opts.key||0;
  G={scale:sc.s,scaleTex:NAMES[key]+'\\ '+sc.tex,key,shells:[],mag:null};
  let bag=[],last=null,prev=null;
  for(let i=0;i<n-1;i++){
    if(!bag.length){bag=shuffle(Object.keys(GEN));if(bag[0]===last)[bag[0],bag[1]]=[bag[1],bag[0]]}
    const style=last=bag.shift();
    let pr;do pr=progression();while(prev&&pr+''===prev+'');prev=pr;
    G.shells.push({style,pr,...finishRiff(GEN[style](pr))})}
  const pr=progression();G.shells.push({style:'boss',pr,n:[],m1:'',m2:'1 = 808\\text{ hit}\\quad +\\text{ saw wall} + \\text{riff \\#1 as bells}',cap:'the final boss plays the magazine: live = 1'});
  G.mag=shuffle(Array.from({length:n},(_,j)=>j<L?1:0));
  for(const sh of G.shells)sh.tell=sh.style!=='boss'&&!!(opts.tellAll||opts.tau>0&&R()<opts.tau);
}

