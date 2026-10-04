import { useEffect, useId, useRef, useState } from 'react';

/**
 * A hint that works on hover, keyboard focus AND tap (the design boards only had hover). Wrap any
 * readout: <Tip text="..."><span>...</span></Tip>. The bubble is aria-describedby, so screen readers get it.
 */
export function Tip({ text, children, side }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!text) return children;
  return (
    <span
      ref={ref}
      className="v3-tip"
      data-open={open}
      data-side={side}
      aria-describedby={id}
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ cursor: 'default' }}
    >
      {children}
      <span id={id} role="tooltip" className="v3-tip-bubble">{text}</span>
    </span>
  );
}
