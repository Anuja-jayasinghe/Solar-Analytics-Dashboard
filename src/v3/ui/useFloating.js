import { useLayoutEffect, useState } from 'react';
import { placeFloating } from './floating.js';

/** Keeps a floating element (ref) placed next to its anchor (ref) while `open`, following scroll and resize. */
export function useFloating(anchorRef, floatRef, open, prefer = 'top', gap = 8, align = 'center') {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const a = anchorRef.current;
      const f = floatRef.current;
      if (!a || !f) return;
      const r = a.getBoundingClientRect();
      setPos(placeFloating(r, { width: f.offsetWidth, height: f.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, prefer, gap, align));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open, anchorRef, floatRef, prefer, gap, align]);
  return pos;
}
