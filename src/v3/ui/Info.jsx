import { useEffect, useId, useRef, useState } from 'react';
import { Info as InfoGlyph } from 'lucide-react';
import { Bubble } from './Bubble.jsx';

const OPEN_DELAY_MS = 200; // passing the mouse over the icon on the way elsewhere opens nothing
const CLOSE_DELAY_MS = 120;

/**
 * An explanation behind a small ⓘ: what a figure means or how it is worked out. Only for things the screen does
 * not already say; obvious labels get no icon.
 *
 * Opens on hover (after a short delay), on keyboard focus, or on a tap; a click keeps it open until a click
 * elsewhere, Escape, or a scroll. With `children` the children become the trigger and the icon follows them
 * (for example a status pill); without, it is the icon alone, named by `label`.
 *
 * @param {object} p
 * @param {string} [p.title]  one short line, in bold
 * @param {string} [p.text]   the detail, if any
 * @param {string} [p.label]  accessible name of an icon-only trigger, e.g. "About this billing period"
 */
export function Info({ title, text, label, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const anchorRef = useRef(null);
  const timer = useRef(null);

  const close = () => { clearTimeout(timer.current); setOpen(false); setPinned(false); };

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) close(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!title && !text) return children ?? null;

  const later = (fn, ms) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms); };
  const handlers = {
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') later(() => setOpen(true), OPEN_DELAY_MS); },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse' && !pinned) later(() => setOpen(false), CLOSE_DELAY_MS); },
    onClick: () => {
      clearTimeout(timer.current);
      const next = !(open && pinned);
      setOpen(next);
      setPinned(next);
    },
    onFocus: (e) => {
      let keyboard = true;
      try { keyboard = e.currentTarget.matches(':focus-visible'); } catch { /* older browsers: treat as keyboard */ }
      if (keyboard) setOpen(true);
    },
    onBlur: () => { if (!pinned) close(); }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`v3-info${children ? ' v3-info-with' : ''}${className ? ` ${className}` : ''}`}
        aria-label={children ? undefined : (label ?? 'What this means')}
        aria-expanded={open}
        aria-describedby={id}
        {...handlers}
      >
        {children}
        <InfoGlyph size={children ? 12 : 14} strokeWidth={2} aria-hidden="true" focusable="false" />
      </button>
      <span id={id} className="v3-sr">{[title, text].filter(Boolean).join(' ')}</span>
      <Bubble anchorRef={anchorRef} open={open} kind="info">
        {title && <strong className="v3-pop-title">{title}</strong>}
        {text && <span className="v3-pop-text">{text}</span>}
      </Bubble>
    </>
  );
}
