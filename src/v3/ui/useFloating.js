import { useLayoutEffect, useState } from 'react';
import { placeFloating } from './floating.js';

/**
 * Keeps a floating element (ref) placed next to its anchor (ref) while `open`, following scroll and resize.
 * Returns { top, left, placement, arrowX, arrowY }; the arrow offsets point back at the anchor's centre.
 */
/**
 * The box to place against: the anchor itself, or, with `selector`, the union of the matching visible elements inside
 * it (a chart column's bars and their value labels), so a tooltip sits just above what is drawn, not above the
 * whole column. Falls back to the anchor when nothing matches.
 */
export function anchorRect(el, selector) {
  const own = el.getBoundingClientRect();
  if (!selector) return own;
  const rects = [...el.querySelectorAll(selector)].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
  if (!rects.length) return own;
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

export function useFloating(anchorRef, floatRef, open, prefer = 'top', gap = 8, align = 'center', selector = null) {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const a = anchorRef.current;
      const f = floatRef.current;
      if (!a || !f) return;
      const r = anchorRect(a, selector);
      const p = placeFloating(r, { width: f.offsetWidth, height: f.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, prefer, gap, align);
      // Where the anchor's centre falls along the floating element, for a pointer arrow; kept off the rounded corners.
      const arrowX = Math.max(12, Math.min(r.left + r.width / 2 - p.left, f.offsetWidth - 12));
      const arrowY = Math.max(12, Math.min(r.top + r.height / 2 - p.top, f.offsetHeight - 12));
      setPos({ ...p, arrowX, arrowY });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open, anchorRef, floatRef, prefer, gap, align, selector]);
  return pos;
}
