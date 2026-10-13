/**
 * The 720 x 1280 stage (the reel's 9:16 frame), scaled to fit the window like legacy fit():
 * owns the canvas, the animation loop, the CRT overlays and the screen effects.
 */
import { ReactNode, useEffect, useRef } from 'react';
import { frame, setCanvas } from '../engine/render';

const fitScale = () => {
  const vw = window.innerWidth, vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  return Math.min(vw / 720, vh / 1280);
};

export function Stage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), grain = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null), vig = useRef<HTMLDivElement>(null), rgbR = useRef<SVGFEOffsetElement>(null), rgbC = useRef<SVGFEOffsetElement>(null);

  useEffect(() => {
    setCanvas(cv.current!);
    let scale = fitScale();
    const onResize = () => { scale = fitScale(); };
    addEventListener('resize', onResize); addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize); window.visualViewport?.addEventListener('scroll', onResize);
    const gc = grain.current!.getContext('2d')!, gimg = gc.createImageData(180, 320);
    let raf = 0, gf = 0, lastVig = '', lastFilter = '';
    const loop = () => {
      const fx = frame(scale), s = stage.current!;
      s.style.transform = fx.transform;
      if (fx.split > 0) { const d = (3 + 11 * fx.split).toFixed(1); rgbR.current!.setAttribute('dx', d); rgbC.current!.setAttribute('dx', '-' + d); rgbR.current!.setAttribute('dy', (fx.split * 2).toFixed(1)); }
      if (fx.filter !== lastFilter) { s.style.filter = fx.filter; lastFilter = fx.filter; }
      flash.current!.style.background = fx.flash; flash.current!.style.opacity = String(fx.flashOpacity);
      if (fx.vignette !== lastVig) { vig.current!.style.background = fx.vignette; lastVig = fx.vignette; }
      if (fx.logoPulse) { const l = document.getElementById('logo'); if (l) { l.classList.remove('pulse'); void l.offsetWidth; l.classList.add('pulse'); } }
      if (gf++ % 2 === 0) { const d = gimg.data; for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } gc.putImageData(gimg, 0, 0); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('orientationchange', onResize); };
  }, []);

  return (
    <div id="stage" ref={stage}>
      <canvas id="cv" ref={cv} width={720} height={1280} />
      {children}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="rgbx" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r" />
          <feOffset ref={rgbR} in="r" dx="0" dy="0" result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="c" />
          <feOffset ref={rgbC} in="c" dx="0" dy="0" result="c2" />
          <feBlend in="r2" in2="c2" mode="screen" />
        </filter>
      </svg>
      <canvas id="grain" ref={grain} width={180} height={320} />
      <div id="scan" /><div id="vig" ref={vig} /><div id="flash" ref={flash} />
    </div>
  );
}
