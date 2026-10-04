// src/v3/ui/floating.js
//
// Where to put a floating element (hint bubble, date picker) next to its anchor so it is always fully on
// screen. Floating elements are drawn in a layer above the cards (see Portal.jsx): cards use backdrop-filter,
// which in every browser traps fixed/absolute descendants inside the card and clipped them.

const MARGIN = 8; // keep this far from the window edges

/**
 * @param {{top:number,left:number,right:number,bottom:number,width:number,height:number}} anchor  getBoundingClientRect()
 * @param {{width:number,height:number}} size   the floating element's size
 * @param {{width:number,height:number}} viewport
 * @param {'top'|'bottom'|'right'} prefer
 * @param {number} gap  distance from the anchor
 * @param {'center'|'start'} align  centred on the anchor (hints) or lined up with its left edge (pickers)
 * @returns {{top:number,left:number,placement:'top'|'bottom'|'right'}}
 */
export function placeFloating(anchor, size, viewport, prefer = 'top', gap = 8, align = 'center') {
  const clampX = (x) => Math.max(MARGIN, Math.min(x, viewport.width - size.width - MARGIN));
  const clampY = (y) => Math.max(MARGIN, Math.min(y, viewport.height - size.height - MARGIN));

  if (prefer === 'right') {
    const left = anchor.right + gap;
    if (left + size.width + MARGIN <= viewport.width) {
      return { top: clampY(anchor.top + anchor.height / 2 - size.height / 2), left, placement: 'right' };
    }
    // no room on the right: fall through to above/below
  }

  const centerX = clampX(align === 'start' ? anchor.left : anchor.left + anchor.width / 2 - size.width / 2);
  const above = anchor.top - gap - size.height;
  const below = anchor.bottom + gap;
  const fitsAbove = above >= MARGIN;
  const fitsBelow = below + size.height + MARGIN <= viewport.height;

  if (prefer === 'bottom') {
    if (fitsBelow || !fitsAbove) return { top: clampY(below), left: centerX, placement: 'bottom' };
    return { top: above, left: centerX, placement: 'top' };
  }
  if (fitsAbove || !fitsBelow) return { top: clampY(above), left: centerX, placement: 'top' };
  return { top: below, left: centerX, placement: 'bottom' };
}
