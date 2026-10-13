// Beat The Dealer: layout, persistence, timing, seeded RNG, music theory, riff generators
"use strict";
// ---------- layout ----------
const stage=document.getElementById('stage');
function fit(){
  const vw=window.innerWidth;
  const vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
  const s=Math.min(vw/720,vh/1280);
  stage.style.transform=`translate(-50%,-50%) scale(${s})`;
  stage.dataset.s=s;
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',fit);
  window.visualViewport.addEventListener('scroll',fit);
}
addEventListener('resize',fit);
addEventListener('orientationchange',fit);
fit();
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
const IS_MOBILE=(()=>{try{return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&matchMedia('(pointer: coarse) and (max-width: 1024px)').matches)}catch(e){return false}})();
const opt=Object.assign({vol:3,shake:RM?0:1,flash:RM?0:1,hints:0,off:0},store.get('opt',{}));
const VOLS=[0,.45,.7,.9];

// ---------- timing (measured on the reel: 120 BPM, 2 bars before the trigger, 2 after) ----------
const BPM=120, SD=60/BPM/4;            // one sixteenth
const F3=174.614;                       // the riff sits on F3, like the reel
const PRE=32, POST=32;                  // sixteenths before / after the trigger
const INTRO=6;                          // 3 bars
const now=()=>(ctx&&ctx.state==='running')?ctx.currentTime:performance.now()/1000;
const fq=p=>F3*Math.pow(2,(p+G.key)/12);   // G.key: transposition in semitones (Survival key change)

// graph geometry
const CX=360, GX0=75, GXT=355, GX1=635, GY0=488, GY1=806;
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
// ---------- procedural mathematical riff generators (matching @the.lab67) ----------
function noteNamesForDegrees(degs){
  const names=['C','D\\flat','D','E\\flat','E','F','G\\flat','G','A\\flat','A','B\\flat','B'];
  const res=[];
  for(const d of degs){
    const semi=(G.scale[((d%7)+7)%7]+12*Math.floor(d/7)+G.key)%12;
    res.push(names[(semi+12)%12]);
  }
  return res.join(',\\ ');
}

// Procedural mathematical riff generator
function generateProceduralRiff(forceFamily=null){
  const families={
    quad: ()=>{
      const m=pick([6,7,8]), a=pick([1,2,3,5]), b=pick([0,0,1,2,3]), c=pick([0,1,2,3,4]);
      const fn=n=>((a*n*n+b*n+c)%m+m)%m;
      let expr='';
      if(a===1&&b===0&&c===0)expr=`n^2 \\bmod ${m}`;
      else if(a===1&&b===0)expr=`(n^2 + ${c}) \\bmod ${m}`;
      else if(b===0&&c===0)expr=`${a}n^2 \\bmod ${m}`;
      else if(b===0)expr=`(${a}n^2 + ${c}) \\bmod ${m}`;
      else{
        const aP=a===1?'n^2':`${a}n^2`, bP=b===1?'n':`${b}n`, cP=c===0?'':` + ${c}`;
        expr=`(${aP} + ${bP}${cP}) \\bmod ${m}`;
      }
      return {fn,expr,family:'quad'};
    },
    lcg: ()=>{
      const m=pick([6,7,8]), a=pick([2,3,5,7]), b=pick([0,1,2,3,5]);
      const fn=n=>((a*n+b)%m+m)%m;
      return {fn,expr:b===0?`${a}n \\bmod ${m}`:`(${a}n + ${b}) \\bmod ${m}`,family:'lcg'};
    },
    tri: ()=>{
      const m=pick([6,7,8]), a=pick([1,2,3]), b=pick([0,0,1,2]);
      const fn=n=>(Math.floor(n*(n+a)/2)+b)%m;
      const frac=a===1?'\\tfrac{n(n+1)}{2}':`\\tfrac{n(n+${a})}{2}`;
      return {fn,expr:b===0?`${frac} \\bmod ${m}`:`\\left(${frac} + ${b}\\right) \\bmod ${m}`,family:'tri'};
    },
    zig: ()=>{
      const m=pick([6,8,10]), c=Math.floor(m/2), s=pick([0,0,1,2,3]);
      const fn=n=>Math.abs(((n+s)%m)-c);
      return {fn,expr:s===0?`\\lvert (n \\bmod ${m}) - ${c}\\rvert`:`\\lvert ((n + ${s}) \\bmod ${m}) - ${c}\\rvert`,family:'zig'};
    },
    bitwise: ()=>{
      if(R()<.5){
        const m=pick([7,8]);
        return {fn:n=>((n^(n>>1))%m),expr:`(n \\oplus \\lfloor n/2 \\rfloor) \\bmod ${m}`,family:'bitwise'};
      }
      const m=pick([6,7,8]), mask=pick([1,3,5,6]);
      return {fn:n=>((n^mask)%m),expr:`(n \\oplus ${mask}) \\bmod ${m}`,family:'bitwise'};
    },
    pulse: ()=>{
      const m=pick([6,7,8]), a=pick([1,2,3,4]), b=pick([1,2,3,5]);
      const aP=a===1?'(n \\bmod 2)':`${a}\\,(n \\bmod 2)`;
      const bP=b===1?'(n \\bmod 4)':`${b}\\,(n \\bmod 4)`;
      return {fn:n=>(a*(n%2)+b*(n%4))%m,expr:`(${aP} + ${bP}) \\bmod ${m}`,family:'pulse'};
    },
    fib: ()=>{
      const m=pick([6,7,8]), s=pick([0,1,2,3]);
      const F=[0,1];for(let i=2;i<=32;i++)F[i]=(F[i-1]+F[i-2])%m;
      return {fn:n=>F[(n+s)%F.length],expr:s===0?`F_n \\bmod ${m}`:`F_{n+${s}} \\bmod ${m}`,family:'fib'};
    },
    sync: ()=>{
      const m=pick([7,8]), p=pick([[0,2,4,7],[0,1,4,5],[0,3,5,7],[0,2,3,6],[0,0,3,5,5,7,5,3]]);
      const name=p.length===4?'\\text{arp}_4':'\\text{sync}_8';
      return {fn:n=>p[n%p.length]%m,expr:`${name}(n) \\bmod ${m}`,family:'sync'};
    }
  };

  const famKeys=Object.keys(families);
  for(let att=0;att<50;att++){
    const k=forceFamily&&families[forceFamily]?forceFamily:pick(famKeys);
    const gen=families[k]();
    const vals=[];
    for(let i=0;i<16;i++)vals.push(gen.fn(i));
    if(vals.some(v=>!Number.isInteger(v)||v<0||v>7))continue;
    const uniq=Array.from(new Set(vals));
    if(uniq.length<2||uniq.length>6)continue;
    let period=8;
    for(const p of [2,3,4,6,8]){
      let ok=true;
      for(let i=0;i<16-p;i++){if(vals[i]!==vals[i+p]){ok=false;break;}}
      if(ok){period=p;break;}
    }
    const cycle=vals.slice(0,Math.min(8,period));
    const uniqSorted=[...uniq].sort((a,b)=>a-b);
    const setStr=uniqSorted.join(',\\ ');
    const formula=`d_n = ${gen.expr} \\in \\{${setStr}\\}`;
    return {fn:gen.fn,formula,cycle,family:gen.family,vals};
  }
  return {fn:k=>((k*k)%8),formula:`d_n = n^2 \\bmod 8 \\in \\{0,\\ 1,\\ 4\\}`,cycle:[0,1,4,1],family:'quad',vals:[0,1,4,1,0,1,4,1,0,1,4,1,0,1,4,1]};
}

const RIFF_MATH={
  sq: { fn: k=>((k*k)%8), cycle: [0, 1, 4, 1], formula: `d_n = n^2 \\bmod 8 \\in \\{0, 1, 4\\}` }
};

function newGame(n=8,L=4,opts={}){
  const sc=opts.sc||pick(SCALES),key=opts.key||0;
  G={scale:sc.s,scaleTex:NAMES[key]+'\\ '+sc.tex,key,shells:[],mag:null};

  let prevFam='boss';
  for(let i=0;i<n-1;i++){
    let rf;
    if(i===0 && R()<.5){
      rf={
        fn: k=>((k*k)%8),
        formula: `d_n = n^2 \\bmod 8 \\in \\{0, 1, 4\\}`,
        cycle: [0, 1, 4, 1],
        family: 'quad'
      };
    } else {
      for(let t=0;t<10;t++){
        rf=generateProceduralRiff();
        if(rf.family!==prevFam) break;
      }
    }
    prevFam=rf.family;

    const notes=[];
    for(let k=0;k<16;k++){
      const deg=rf.fn(k);
      notes.push({s:k*2,d:2,deg,lab:deg,p:semis(deg)});
    }
    const notesTex=`\\text{note} = \\text{scale}[d_n] : `+noteNamesForDegrees(rf.cycle);
    G.shells.push({
      style:rf.family,
      dash:rf.family==='sync'||rf.family==='pulse',
      pr:progression(),
      n:notes,
      formula:rf.formula,
      notesTex,
      m1:rf.formula,
      m2:notesTex
    });
  }

  const pr=[0,1];
  G.shells.push({
    style:'boss',
    pr,
    n:[],
    formula:`d_n = \\text{magazine}[n] \\in \\{0, 1\\}`,
    notesTex:`\\text{LIVE}\\mapsto -2, \\quad \\text{BLANK}\\mapsto +1`,
    m1:`d_n = \\text{magazine}[n] \\in \\{0, 1\\}`,
    m2:`\\text{LIVE}\\mapsto -2, \\quad \\text{BLANK}\\mapsto +1`
  });
  G.mag=shuffle(Array.from({length:n},(_,j)=>j<L?1:0));
  for(const sh of G.shells)sh.tell=sh.style!=='boss'&&!!(opts.tellAll||opts.tau>0&&R()<opts.tau);
}
