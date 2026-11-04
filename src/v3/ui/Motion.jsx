// src/v3/ui/Motion.jsx
//
// Numbers that count up when data arrives (the hooks and the rules are in useMotion.js).

import { fmtNum } from '../overview/format.js';
import { numberIn, useCount } from './useMotion.js';

/** Hidden while it waits for its turn, so a not-yet-counted 0 is never read as a real figure. */
const wrap = (text, waiting) => (waiting ? <span className="v3-countwait">{text}</span> : text);

/** A number with `dp` decimals (and an optional suffix such as '%') that counts up (see useCountUp). Null shows the dash. */
export function CountUp({ value, dp = 0, delay = 0, duration, suffix = '', animate = true }) {
  const { shown, waiting } = useCount(value, { delay, duration, off: !animate });
  return wrap(`${fmtNum(shown, dp)}${isFinite(shown) && shown !== null ? suffix : ''}`, waiting);
}

/** Counts up the number inside a formatted text ('LKR 3.07', '78.6', '1,562'), keeping the rest; a dash stays a dash. */
export function CountText({ text, delay = 0, duration, animate = true }) {
  const n = numberIn(text);
  const { shown, waiting } = useCount(n ? n.value : null, { delay, duration, off: !animate });
  return n ? wrap(`${n.before}${fmtNum(shown, n.dp)}${n.after}`, waiting) : text;
}
