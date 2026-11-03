import { useRef } from 'react';
import { Portal } from './Portal.jsx';
import { useFloating } from './useFloating.js';

/**
 * The floating box for both tooltips (chart details) and info popovers (explanations): drawn above the cards
 * (Portal), kept fully on screen, with a small arrow pointing back at what it belongs to.
 * Hidden from assistive tech: the anchor carries the same text through aria-describedby.
 */
export function Bubble({ anchorRef, open, prefer = 'top', kind = 'data', children }) {
  const ref = useRef(null);
  const pos = useFloating(anchorRef, ref, open, prefer, 10);
  if (!open) return null;
  const style = pos
    ? { top: pos.top, left: pos.left, '--arrow-x': `${pos.arrowX}px`, '--arrow-y': `${pos.arrowY}px` }
    : { top: -9999, left: -9999 };
  return (
    <Portal>
      <span ref={ref} aria-hidden="true" className={`v3-pop v3-pop-${kind}`} data-placement={pos?.placement ?? 'top'} style={style}>
        {children}
      </span>
    </Portal>
  );
}
