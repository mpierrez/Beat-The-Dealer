// Beat The Dealer: Web Audio master chain, routing, synthesizer voices
"use strict";
// ---------- audio ----------
let ctx,bus,rev,revSend,dly,dlySend,noiseBuf,curveHard,curveSoft,MASTER,UI,ROUTE,menuLP;
function mkCurve(k){const c=new Float32Array(2048);for(let i=0;i<2048;i++){const x=i/1024-1;c[i]=Math.tanh(x*k)/Math.tanh(k)}return c}
function initAudio(){
  if(ctx)return;
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  curveHard=mkCurve(IS_MOBILE?2.5:5);curveSoft=mkCurve(IS_MOBILE?1.0:1.3);
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=IS_MOBILE?-18:-14;
  comp.knee.value=12;
  comp.ratio.value=IS_MOBILE?4:5;
  comp.attack.value=.003;
  comp.release.value=.14;
  const clip=ctx.createWaveShaper();clip.curve=curveSoft;
  const out=ctx.createGain();out.gain.value=VOLS[opt.vol]??.9;MASTER=out;
  bus=ctx.createGain();bus.gain.value=IS_MOBILE?.38:.65;
  if(IS_MOBILE){
    const hp=filt('highpass',65,.7);
    bus.connect(hp);hp.connect(comp);comp.connect(out);
  }else{
    bus.connect(clip);clip.connect(comp);comp.connect(out);
  }
  out.connect(ctx.destination);
  // hall reverb
  rev=ctx.createConvolver();
  const revLen=Math.round(ctx.sampleRate*(IS_MOBILE?0.8:2.4)),irCh=IS_MOBILE?1:2;
  const ir=ctx.createBuffer(irCh,revLen,ctx.sampleRate);
  for(let c=0;c<irCh;c++){const d=ir.getChannelData(c);for(let i=0;i<revLen;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/revLen,2.6)*(i<ctx.sampleRate*.01?i/(ctx.sampleRate*.01):1)}
  rev.buffer=ir;revSend=ctx.createGain();revSend.gain.value=IS_MOBILE?.35:.5;const rlp=ctx.createBiquadFilter();rlp.type='lowpass';rlp.frequency.value=IS_MOBILE?5000:6000;
  revSend.connect(rlp);rlp.connect(rev);rev.connect(bus);
  // dotted-eighth echo
  dly=ctx.createDelay(1);dly.delayTime.value=SD*3;const fb=ctx.createGain();fb.gain.value=.32;const dlp=ctx.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=2800;
  dlySend=ctx.createGain();dlySend.gain.value=1;dlySend.connect(dly);dly.connect(dlp);dlp.connect(fb);fb.connect(dly);dlp.connect(bus);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  menuLP=filt('lowpass',18000,.7);menuLP.connect(bus);
  UI=mkRoute(bus);ROUTE=UI;
}
// routes: {d,r,e} gains feeding dest / reverb / echo, so a whole run (incl. pre-scheduled notes) can be silenced at once
function mkRoute(dest=bus,gv=1){const r={d:ctx.createGain(),r:ctx.createGain(),e:ctx.createGain()};
  r.d.gain.value=gv;r.d.connect(dest);r.r.connect(revSend);r.e.connect(dlySend);return r}
function routeTo(rt,fn){const old=ROUTE;ROUTE=rt||UI;try{return fn()}finally{ROUTE=old}}
function killRoute(rt,t=now()){if(!rt||rt.dead)return;rt.dead=1;
  for(const k of'dre'){const p=rt[k].gain;
    if(ctx.state!=='running'){p.cancelScheduledValues(0);p.value=0}
    else{p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(0,t+.06)}}
  setTimeout(()=>{for(const k of'dre')try{rt[k].disconnect()}catch(e){}},300)}
function env(node,t,a,peak,dec){const p=node.gain;p.setValueAtTime(0,t);p.linearRampToValueAtTime(peak,t+a);p.exponentialRampToValueAtTime(1e-4,t+a+dec)}
function osc(type,f,t,dur){const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.start(t);o.stop(t+dur+.05);return o}
function noise(t,dur,off=0){const n=ctx.createBufferSource();n.buffer=noiseBuf;n.loop=true;n.start(t,off||Math.random());n.stop(t+dur);return n}
function out(node,wet=0,echo=0){node.connect(ROUTE.d);
  if(wet){const s=ctx.createGain();s.gain.value=wet;node.connect(s);s.connect(ROUTE.r)}
  if(echo){const s=ctx.createGain();s.gain.value=echo;node.connect(s);s.connect(ROUTE.e)}}
function filt(type,f,q=.7){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b}

const V={
  // bright detuned saw lead + octave-down sub, plucked short (the reel's pre-trigger riff)
  lead(t,p,d,gn=1){const f=fq(p),len=Math.min(d,.2),gg=ctx.createGain(),lp=filt('lowpass',7000,.8);
    lp.frequency.setValueAtTime(14000,t);lp.frequency.exponentialRampToValueAtTime(6500,t+len+.08);
    if(IS_MOBILE){
      const o=osc('sawtooth',f,t,len+.12);o.connect(lp);
      const sub=osc('square',f/2,t,len+.12),sg=ctx.createGain();sg.gain.value=.25;sub.connect(sg);sg.connect(lp);
    }else{
      for(const det of[-9,0,9]){const o=osc('sawtooth',f,t,len+.15);o.detune.value=det;o.connect(lp)}
      const hi=osc('sawtooth',f*2,t,len+.15),hg=ctx.createGain();hg.gain.value=.22;hi.connect(hg);hg.connect(lp);
      const sub=osc('square',f/2,t,len+.15),sg=ctx.createGain();sg.gain.value=.3;sub.connect(sg);sg.connect(lp);
    }
    lp.connect(gg);const p_=gg.gain;p_.setValueAtTime(0,t);p_.linearRampToValueAtTime(.09*gn,t+.003);
    p_.setTargetAtTime(.06*gn,t+.01,.06);p_.setValueAtTime(.06*gn,t+len);p_.linearRampToValueAtTime(0,t+len+.04);
    out(gg,IS_MOBILE?.08:.12,IS_MOBILE?.08:.16)},
  // distorted 808 bass: pitch-dropping sine into hard saturation
  k808(t,p,d,gn=1){const f=fq(p),len=Math.max(.18,d),o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(f*2.2,t);o.frequency.exponentialRampToValueAtTime(f,t+.045);o.start(t);o.stop(t+len+.1);
    const drive=ctx.createGain();drive.gain.value=IS_MOBILE?1.8:3.0;const ws=ctx.createWaveShaper();ws.curve=curveHard;ws.oversample='none';
    const lp=filt('lowpass',6500,.7),gg=ctx.createGain();o.connect(drive);drive.connect(ws);ws.connect(lp);lp.connect(gg);
    const fz=filt('highpass',1400,.7),fzg=ctx.createGain();fzg.gain.value=.6;ws.connect(fz);fz.connect(fzg);fzg.connect(gg);
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.18*gn,t+.004);gg.gain.setTargetAtTime(.13*gn,t+.02,.15);
    gg.gain.setValueAtTime(.13*gn,t+len-.03);gg.gain.linearRampToValueAtTime(0,t+len+.02);out(gg,.04);
    const clean=osc('sine',f,t,len),cg=ctx.createGain();clean.connect(cg);cg.gain.setValueAtTime(.14*gn,t);cg.gain.setValueAtTime(.14*gn,t+len-.03);cg.gain.linearRampToValueAtTime(0,t+len+.02);out(cg)},
  // glass bell: FM with a slightly inharmonic partial, long ring, reverb + echo
  bell(t,p,d,gn=1){const f=fq(p),ring=1.6,c=osc('sine',f,t,ring),m=osc('sine',f*3.01,t,ring),mg=ctx.createGain();
    mg.gain.setValueAtTime(f*2.2,t);mg.gain.exponentialRampToValueAtTime(f*.08,t+.9);m.connect(mg);mg.connect(c.frequency);
    const gg=ctx.createGain();c.connect(gg);
    const p2=osc('sine',f*4.2,t,.6),g2=ctx.createGain();p2.connect(g2);env(g2,t,.001,.06*gn,.5);g2.connect(gg);
    const p3=osc('sine',f*2,t,ring),g3=ctx.createGain();p3.connect(g3);env(g3,t,.002,.07*gn,1.2);g3.connect(gg);
    env(gg,t,.002,.24*gn,ring);out(gg,.55,.22)},
  reese(t,p,d,gn=1,df=2){const f=fq(p),lp=filt('lowpass',1600,2.5);
    lp.frequency.setValueAtTime(2200,t);lp.frequency.linearRampToValueAtTime(700,t+d);
    for(const [ff,det] of [[f,0],[f+df,0],[f/2,5]]){const o=osc('sawtooth',ff,t,d);o.detune.value=det;o.connect(lp)}
    const gg=ctx.createGain();lp.connect(gg);gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.075*gn,t+.02);
    gg.gain.setValueAtTime(.075*gn,t+d-.04);gg.gain.linearRampToValueAtTime(0,t+d);out(gg,.12,.1)},
  // warm supersaw pad chord + sub bass on the root (the reel's blank section: Fm → G♭)
  pad(t,deg,d,gn=1){const lp=filt('lowpass',1500,.6),gg=ctx.createGain();lp.connect(gg);
    lp.frequency.setValueAtTime(1800,t);lp.frequency.linearRampToValueAtTime(3200,t+d*.6);
    const root=semis(fitOct(deg,0,6));
    if(IS_MOBILE){
      for(const iv of[0,semis(deg+2)-semis(deg),semis(deg+4)-semis(deg)]){const o=osc('sawtooth',fq(root+iv),t,d+.35);o.connect(lp)}
    }else{
      for(const iv of[0,semis(deg+2)-semis(deg),semis(deg+4)-semis(deg)])for(const det of[-14,0,14]){const o=osc('sawtooth',fq(root+iv),t,d+.4);o.detune.value=det;o.connect(lp)}
    }
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.06*gn,t+.06);gg.gain.setValueAtTime(.06*gn,t+d-.05);gg.gain.linearRampToValueAtTime(0,t+d+.3);out(gg,.35);
    const sb=osc('sine',fq(root-24),t,d+.1),sg=ctx.createGain();sb.connect(sg);
    sg.gain.setValueAtTime(0,t);sg.gain.linearRampToValueAtTime(.18*gn,t+.03);sg.gain.setValueAtTime(.18*gn,t+d-.04);sg.gain.linearRampToValueAtTime(0,t+d+.05);out(sg)},
  sawwall(t,d,deg=0){const lp=filt('lowpass',300,1);lp.frequency.setValueAtTime(300,t);lp.frequency.exponentialRampToValueAtTime(3000,t+d);
    const gg=ctx.createGain();lp.connect(gg);gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.045,t+.3);gg.gain.setValueAtTime(.045,t+d-.2);gg.gain.linearRampToValueAtTime(0,t+d);out(gg,.3);
    const r=semis(fitOct(deg,0,6));for(const iv of[-24,-12,-5,0,semis(deg+2)-semis(deg),7])for(const det of[-12,0,12]){const o=osc('sawtooth',fq(r+iv),t,d);o.detune.value=det;o.connect(lp)}},
  // thunder kick: long pitch sweep from the top down to A1, measured on the reel
  kick(t,v=1){const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(105,t+.04);o.frequency.exponentialRampToValueAtTime(50,t+.26);
    const gg=ctx.createGain();
    if(IS_MOBILE){o.connect(gg)}else{const sh=ctx.createWaveShaper();sh.curve=curveSoft;o.connect(sh);sh.connect(gg)}
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.65*v,t+.002);gg.gain.setTargetAtTime(.45*v,t+.05,.18);gg.gain.exponentialRampToValueAtTime(1e-4,t+.72);
    out(gg,.03);o.start(t);o.stop(t+.7);
    const n=noise(t,.02),hp=filt('highpass',3500),ng=ctx.createGain();n.connect(hp);hp.connect(ng);env(ng,t,.0005,.12*v,.012);out(ng)},
  clap(t,v=1){const bp=filt('highpass',900,.5),gg=ctx.createGain();bp.connect(gg);out(gg,.35);
    const n=noise(t,.35);n.connect(bp);const p=gg.gain;p.setValueAtTime(0,t);
    for(const o of[0,.011,.022]){p.setValueAtTime(.8*v,t+o);p.exponentialRampToValueAtTime(.1*v,t+o+.009)}
    p.setValueAtTime(.55*v,t+.031);p.exponentialRampToValueAtTime(1e-4,t+.34)},
  hat(t,v=1){const n=noise(t,.06),hp=filt('highpass',8000),gg=ctx.createGain();n.connect(hp);hp.connect(gg);env(gg,t,.001,.12*v,.045);out(gg,.05)},
  tick(t,v=1){const o=osc('square',1520,t,.03),gg=ctx.createGain(),hp=filt('highpass',900);o.connect(hp);hp.connect(gg);env(gg,t,.001,.045*v,.025);out(gg,.2)},
  riser(t,d){const n=noise(t,d+.05),bp=filt('bandpass',400,3),gg=ctx.createGain();
    bp.frequency.setValueAtTime(400,t);bp.frequency.exponentialRampToValueAtTime(9000,t+d);
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.14,t+d);gg.gain.linearRampToValueAtTime(0,t+d+.02);n.connect(bp);bp.connect(gg);out(gg,.25)},
  // the shot: crack + boom + rolling thunder tail
  gunshot(t){
    const c=noise(t,.05),chp=filt('highpass',1800),cg=ctx.createGain();c.connect(chp);chp.connect(cg);env(cg,t,.0005,.4,.03);out(cg,.5);
    const n=noise(t,1.4),lp=filt('lowpass',7000,.5),ng=ctx.createGain();
    lp.frequency.setValueAtTime(7000,t);lp.frequency.exponentialRampToValueAtTime(160,t+1.0);
    n.connect(lp);lp.connect(ng);env(ng,t,.001,.22,1.2);out(ng,.5);
    const b=ctx.createOscillator();b.frequency.setValueAtTime(140,t);b.frequency.exponentialRampToValueAtTime(32,t+.5);
    const bg=ctx.createGain();b.connect(bg);env(bg,t,.002,.6,1.0);out(bg,.2);b.start(t);b.stop(t+1.2);
    const r=noise(t,1.8),rlp=filt('lowpass',140,.8),rg=ctx.createGain();r.connect(rlp);rlp.connect(rg);
    rg.gain.setValueAtTime(0,t);rg.gain.linearRampToValueAtTime(.5,t+.1);rg.gain.exponentialRampToValueAtTime(1e-4,t+1.8);out(rg,.25)},
  dryfire(t){const n=noise(t,.05),hp=filt('highpass',2500),gg=ctx.createGain();n.connect(hp);hp.connect(gg);env(gg,t,.0005,.35,.035);out(gg,.4);
    for(const [f,a] of [[2637,.07],[3951,.04],[5274,.025]]){const o=osc('sine',f,t+.004,1.5),og=ctx.createGain();o.connect(og);env(og,t+.004,.001,a,1.3);out(og,.8,.3)}},
  // the Dealer's lead (VS): square stack, no 2f partial, darker fixed low-pass
  dlead(t,p,d,gn=1){const f=fq(p),len=Math.min(d,.2),gg=ctx.createGain(),lp=filt('lowpass',2400,.8),k=.85*gn;
    for(const det of[-9,0,9]){const o=osc('square',f,t,len+.15);o.detune.value=det;o.connect(lp)}
    const sub=osc('square',f/2,t,len+.15),sg=ctx.createGain();sg.gain.value=.3;sub.connect(sg);sg.connect(lp);
    lp.connect(gg);const p_=gg.gain;p_.setValueAtTime(0,t);p_.linearRampToValueAtTime(.09*k,t+.003);
    p_.setTargetAtTime(.06*k,t+.01,.06);p_.setValueAtTime(.06*k,t+len);p_.linearRampToValueAtTime(0,t+len+.04);out(gg,.12,.16)},
  // arcade coin blip
  coin(t){const o=osc('square',988,t,.16),hp=filt('highpass',300),gg=ctx.createGain();o.frequency.setValueAtTime(1319,t+.06);o.connect(hp);hp.connect(gg);
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.07,t+.002);gg.gain.setValueAtTime(.07,t+.14);gg.gain.linearRampToValueAtTime(0,t+.16);out(gg,.1)},
  // pump-action rack: two clacks + a low thump
  rack(t){const gg=ctx.createGain();out(gg,.15);
    for(const o of[0,.09]){const n=noise(t+o,.04),bp=filt('bandpass',1200,2),ng=ctx.createGain();n.connect(bp);bp.connect(ng);env(ng,t+o,.001,.5,.04);ng.connect(gg)}
    const s=osc('sine',90,t+.09,.06),sg=ctx.createGain();s.connect(sg);env(sg,t+.09,.001,.4,.05);sg.connect(gg)},
  // rimshot (on-beat lock)
  rim(t){const gg=ctx.createGain();out(gg,.15);
    const n=noise(t,.03),bp=filt('bandpass',1800,4),ng=ctx.createGain();n.connect(bp);bp.connect(ng);env(ng,t,.001,.35,.03);ng.connect(gg);
    const o=osc('sine',820,t,.025),og=ctx.createGain();o.connect(og);env(og,t,.001,.2,.025);og.connect(gg)},
  // shell placed in the row: G#6 ping (minor third of F), ~100 ms ring, measured on the reel
  place(t){const f=fq(39),gg=ctx.createGain();out(gg,.25,.08);
    const o=osc('sine',f,t,.2),og=ctx.createGain();o.connect(og);env(og,t,.001,.16,.13);og.connect(gg);
    const o2=osc('triangle',f*2,t,.08),o2g=ctx.createGain();o2.connect(o2g);env(o2g,t,.001,.035,.05);o2g.connect(gg);
    const n=noise(t,.02),hp=filt('highpass',6000),ng=ctx.createGain();n.connect(hp);hp.connect(ng);env(ng,t,.0005,.07,.012);ng.connect(gg)},
  // brass shell clink on every reveal
  clink(t){const gg=ctx.createGain();out(gg,.3);
    for(const [f,a] of[[3150,.05],[4730,.03]]){const o=osc('sine',f,t,.2),og=ctx.createGain();o.connect(og);env(og,t,.001,a,.18);og.connect(gg)}},
  // flatline
  flat(t,d){const o=osc('sine',880,t,d),lp=filt('lowpass',2000),gg=ctx.createGain();o.connect(lp);lp.connect(gg);
    gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.1,t+.02);gg.gain.setValueAtTime(.1,t+Math.max(.02,d-.05));gg.gain.linearRampToValueAtTime(0,t+d);out(gg,.1)},
};
