import { useEffect, useId, useRef, useState } from 'react';
import { usePrefs } from '../prefs/context.js';
import { Portal } from './Portal.jsx';
import { useFloating } from './useFloating.js';

/**
 * Two kinds of hover label on one wrapper:
 *  - `value`: the figure under the pointer on a chart ("Aug 2036 · 4,100 kWh"). Always on, appears at once on
 *    hover and goes as soon as the pointer leaves (on touch: while pressed, then fades). Not affected by the
 *    hints switch.
 *  - `text`: an explanation. Only when hints are switched on (sidebar); also opens by keyboard focus or a tap.
 * The bubble is drawn above the cards (Portal) and kept fully on screen, so it is never cut off.
 * The wrapper renders the same either way, so layouts that size `.v3-tip` do not change.
 */
export function Tip({ text, value, children, side, className = '', style }) {
  const { hints } = usePrefs();
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchorRef = useRef(null);
  const floatRef = useRef(null);
  const touchTimer = useRef(null);
  const explain = hints && !!text;
  const content = explain ? (value ? `${value} · ${text}` : text) : value;
  const pos = useFloating(anchorRef, floatRef, open && !!content, side === 'right' ? 'right' : 'top');

  useEffect(() => {
    if (!open || !explain) return undefined;
    const away = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open, explain]);
  useEffect(() => () => clearTimeout(touchTimer.current), []);

  const cls = `v3-tip${className ? ` ${className}` : ''}`;
  if (!text && !value) return children;
  if (!content) return <span className={cls} style={style}>{children}</span>;

  const handlers = {
    onPointerEnter: (e) => { if (e.pointerType !== 'touch') setOpen(true); },
    onPointerLeave: (e) => { if (e.pointerType !== 'touch') setOpen(false); },
    onPointerDown: (e) => {
      if (e.pointerType !== 'touch') return;
      clearTimeout(touchTimer.current);
      setOpen(true);
      if (!explain) touchTimer.current = setTimeout(() => setOpen(false), 1400);
    }
  };
  const explainHandlers = explain
    ? { tabIndex: 0, onFocus: () => setOpen(true), onBlur: () => setOpen(false), onClick: () => setOpen((v) => !v) }
    : {};

  return (
    <span ref={anchorRef} className={cls} style={style} aria-describedby={id} {...handlers} {...explainHandlers}>
      {children}
      <span id={id} role="tooltip" className="v3-sr">{content}</span>
      {open && (
        <Portal>
          <span
            ref={floatRef}
            aria-hidden="true"
            className={`v3-float-tip${explain ? '' : ' value'}`}
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            {content}
          </span>
        </Portal>
      )}
    </span>
  );
}
