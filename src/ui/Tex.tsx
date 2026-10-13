/** A math line rendered with KaTeX, shrunk to fit 680 px (legacy setTex). */
import katex from 'katex';
import { useLayoutEffect, useRef } from 'react';

export function Tex({ id, tex, className }: { id?: string; tex: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    if (!tex) el.textContent = '';
    else try { katex.render(tex, el, { throwOnError: false }); } catch { el.textContent = tex; }
    el.style.transform = '';
    const w = el.scrollWidth;
    if (w > 680) el.style.transform = `scale(${680 / w})`;
  }, [tex]);
  return <div id={id} ref={ref} className={className} />;
}
