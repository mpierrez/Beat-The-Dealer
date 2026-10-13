// Beat The Dealer: note layers shared by picture and sound, scheduling, drums, KaTeX helpers
"use strict";
// ---------- layers: one note list drives both the picture and the sound ----------
function layers(i,phase,res,who='you'){
  const sh=G.shells[i],a=phase==='pre'?0:PRE,L=[],dl=who==='dlr',n=G.mag.length;
  if(sh.style==='boss'){
    const hits=[],top=[],cyc=[0,4,7,2],sp=Math.floor(32/n);let h=0;
    for(let k=0;k<n;k++){const s=a+k*sp;top.push({s,d:sp-1,p:15});if(G.mag[k])hits.push({s,d:sp-1,p:semis(fitOct(sh.pr[k<n/2?0:1],0,5)+cyc[h++%4])})}
    const riff1=G.shells[0].n.map(n=>({...n,s:n.s+a,lab:null}));
    if(phase==='pre')L.push({mode:'dash',voice:dl?'dlead':'lead',col:dl?'v':'y',notes:hits},{mode:'dash',voice:null,col:dl?'v':'y',notes:top,thin:1});
    else if(res)L.push({mode:'spike',voice:'k808',col:'r',notes:hits.map(n=>({...n,p:n.p-24}))},
      {mode:'flat',voice:'sawwall',col:'y',deg:sh.pr[0],notes:[{s:a,d:POST,p:-12}]},
      {mode:'step',voice:'bell',col:'y',notes:riff1.map(n=>({...n,p:n.p+12}))});
    else L.push({mode:'dash',voice:'bell',col:'c',notes:hits.map(n=>({...n,p:n.p+12}))},
      {mode:'none',voice:'pad',notes:[{s:a,d:16,deg:sh.pr[0]},{s:a+16,d:16,deg:sh.pr[1]}]},
      {mode:'step',voice:'bell',col:'c',notes:riff1.map(n=>({...n,p:n.p+12}))});
    return L;
  }
  const notes=sh.n.map(n=>({...n,s:n.s+a})),mode=sh.reese?'reese':sh.dash?'dash':'step';
  if(phase==='pre')L.push({mode,voice:sh.reese?'reese':dl?'dlead':'lead',col:dl?'v':'y',notes});
  else if(res){
    if(sh.reese)L.push({mode:'reese',voice:'reese',col:'r',notes:notes.map(n=>({...n,p:n.p-24})),wide:1},
                       {mode:'none',voice:'k808',notes:notes.map(n=>({...n,d:Math.min(n.d,4),p:n.p-24}))});
    else L.push({mode:'spike',voice:'k808',col:'r',notes:notes.map(n=>({...n,p:n.p-24}))});
  }else{
    L.push({mode,voice:'bell',col:'c',notes:notes.map(n=>({...n,p:n.p+12}))},
           {mode:'none',voice:'pad',notes:[{s:a,d:16,deg:sh.pr[0]},{s:a+16,d:16,deg:sh.pr[1]}]});
  }
  return L;
}
function schedule(Ls,t0){
  for(const l of Ls){if(!l.voice)continue;
    const gn=l.gn||1;
    for(const n of l.notes){const t=t0+n.s*SD,d=n.d*SD;
      if(l.voice==='reese')V.reese(t,n.p,d,gn,1+5*(n.s%32)/32+(l.wide?4:0));
      else if(l.voice==='sawwall')V.sawwall(t,d,l.deg||0);
      else if(l.voice==='pad')V.pad(t,n.deg,d,gn);
      else V[l.voice](t,n.p,d,gn);
    }}
}
function drums(t0,phase,res){
  if(phase==='pre'){
    for(let s=0;s<PRE;s+=4)V.kick(t0+s*SD,s===0||s===16?.9:.75);
    for(let s=24;s<PRE;s++)V.hat(t0+s*SD,.35+(s-24)*.06);
    V.riser(t0+20*SD,12*SD);
  }else if(res){
    for(let s=PRE;s<PRE+POST;s+=2){const t=t0+s*SD;
      if(s%4===0)V.kick(t,.85);if(s%8===4)V.clap(t,.7);V.hat(t,s%4===2?.55:.35)}
  }else{
    for(let s=PRE;s<PRE+POST;s+=8)V.kick(t0+s*SD,.65);
    for(let s=PRE;s<PRE+POST;s+=2)if(s%8===6)V.hat(t0+s*SD,.35);
  }
}

// math lines: KaTeX when available, plain-text fallback otherwise (file:// offline); cached; auto-fit to 680 px
const TEXSYM={heartsuit:'♥',Sigma:'Σ',Delta:'Δ',omega:'ω',gamma:'γ',beta:'β',times:'×',cdot:'·',to:'→',Rightarrow:'⇒',varnothing:'∅',infty:'∞',
  flat:'♭',pm:'±',mid:'|',mapsto:'↦',subset:'⊂',kappa:'κ',lambda:'λ',tau:'τ',le:'≤',ge:'≥',lim:'lim ',oplus:'⊕',lfloor:'⌊',rfloor:'⌋',in:'∈',bmod:'mod',lvert:'|',rvert:'|',dots:'...'};
function texToPlain(s){let o;
  // \x01 marks unwrapped groups so "\mid\text{ghost}" can't fuse into the unknown macro "\midghost"
  do{o=s;s=s.replace(/\\[td]?frac\{([^{}]*)\}\{([^{}]*)\}/g,'\x01$1/$2').replace(/\\(?:text|mathrm|boxed|mathbb)\{([^{}]*)\}/g,'\x01$1')
    .replace(/\\textcolor\{[^{}]*\}\{([^{}]*)\}/g,'\x01$1')}while(s!==o);
  return s.replace(/\\([a-zA-Z]+)/g,(m,w)=>TEXSYM[w]??m).replace(/\x01/g,'').replace(/\\qquad/g,'    ').replace(/\\quad/g,'  ').replace(/\\[,;: ]/g,' ').replace(/\\!/g,'')
    .replace(/\\[a-zA-Z]+/g,'').replace(/\\(.)/g,'$1').replace(/[{}]/g,'')}
function setTex(el,s){if(el._s===s)return;el._s=s;
  if(!s)el.textContent='';
  else if(window.katex)try{katex.render(s,el,{throwOnError:false})}catch(e){el.textContent=texToPlain(s)}
  else el.textContent=texToPlain(s);
  el.style.transform='';const w=el.scrollWidth;if(w>680)el.style.transform=`scale(${680/w})`}
