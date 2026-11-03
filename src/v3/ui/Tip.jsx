import { useEffect, useId, useRef, useState } from 'react';
import { Bubble } from './Bubble.jsx';

/**
 * A chart detail on hover: the period and figures behind a bar, a cell or a point ("Aug 2036 · 6 Aug to 3 Sep ·
 * Inverter 4,100 kWh"). Always on: it appears at once under the mouse and goes when the mouse leaves. On touch a
 * tap shows it until the next tap elsewhere. It closes when the page scrolls, so it never stays stuck on a bar
 * that has moved away. Explanations of what a figure means are not tooltips: they are info icons (Info.jsx).
 * `value` is accepted as a synonym of `text` for older call sites.
 */
export function Tip({ text, value, children, side, className = '', style }) {
  const content = value || text;
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const away = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!content) return children;

  const handlers = {
    onPointerEnter: (e) => { if (e.pointerType !== 'touch') setOpen(true); },
    onPointerLeave: (e) => { if (e.pointerType !== 'touch') setOpen(false); },
    onPointerDown: (e) => { if (e.pointerType === 'touch') setOpen((v) => !v); }
  };

  return (
    <span ref={anchorRef} className={`v3-tip${className ? ` ${className}` : ''}`} style={style} aria-describedby={id} {...handlers}>
      {children}
      <span id={id} role="tooltip" className="v3-sr">{content}</span>
      <Bubble anchorRef={anchorRef} open={open} prefer={side === 'right' ? 'right' : 'top'} kind="data">{content}</Bubble>
    </span>
  );
}
