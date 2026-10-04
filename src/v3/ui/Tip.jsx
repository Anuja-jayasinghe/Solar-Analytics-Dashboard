import { useEffect, useId, useRef, useState } from 'react';
import { usePrefs } from '../prefs/context.js';

/**
 * A hint on hover, keyboard focus and tap. Wrap any readout: <Tip text="..."><span>...</span></Tip>.
 * Hints are OFF by default (they distract); the sidebar switches them on. `always` is for labels that
 * must stay reachable regardless, such as the names of icon-only navigation items.
 * When hints are off the wrapper still renders (with its class and style, which some charts use for
 * positioning) but shows nothing extra and takes no focus.
 */
export function Tip({ text, children, side, className = '', style, always = false }) {
  const { hints } = usePrefs();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);
  const active = !!text && (hints || always);

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

  const cls = `v3-tip${className ? ` ${className}` : ''}`;
  if (!text) return children;
  // Same wrapper either way, so layouts that size `.v3-tip` (chart columns, tile grids) do not change.
  if (!active) return <span className={cls} style={style}>{children}</span>;
  return (
    <span
      ref={ref}
      className={cls}
      data-open={open}
      data-side={side}
      aria-describedby={id}
      tabIndex={always ? undefined : 0}
      onClick={() => setOpen((v) => !v)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ cursor: 'default', ...style }}
    >
      {children}
      <span id={id} role="tooltip" className="v3-tip-bubble">{text}</span>
    </span>
  );
}
