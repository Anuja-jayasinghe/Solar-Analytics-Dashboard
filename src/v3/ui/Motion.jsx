// src/v3/ui/Motion.jsx
//
// Numbers that count up when data arrives (the hooks and the rules are in useMotion.js).

import { fmtNum } from '../overview/format.js';
import { numberIn, useCountUp } from './useMotion.js';

/** A number with `dp` decimals that counts up (see useCountUp). Null shows the dash. */
export function CountUp({ value, dp = 0, delay = 0, duration }) {
  return fmtNum(useCountUp(value, { delay, duration }), dp);
}

/** Counts up the number inside a formatted text ('LKR 3.07', '78.6', '1,562'), keeping the rest; a dash stays a dash. */
export function CountText({ text, delay = 0, duration }) {
  const n = numberIn(text);
  const shown = useCountUp(n ? n.value : null, { delay, duration });
  return n ? `${n.before}${fmtNum(shown, n.dp)}${n.after}` : text;
}
