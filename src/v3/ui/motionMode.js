// src/v3/ui/motionMode.js
//
// How much the Overview animates when it opens, so it impresses on a visit without slowing down a quick check:
//   'full'  - the first time, or after 30 min or more away: the whole sequence (useMotion.js)
//   'quick' - a refresh or a return within 30 min: the page fades in at once; only the live parts still animate
//             (the Today tile, the live power gauge and the day's power curve)
// "Away" counts from the last time the Overview was on screen (stored in this browser; without storage it is 'full').

import { createContext, useContext } from 'react';

export const AWAY_MS = 30 * 60_000;
export const MotionContext = createContext('full');
export const useMotionMode = () => useContext(MotionContext);

/** 'quick' when the Overview was last on screen less than AWAY_MS ago, else 'full'. */
export function motionFor(nowMs, lastSeenMs) {
  const away = nowMs - lastSeenMs;
  return Number.isFinite(lastSeenMs) && lastSeenMs > 0 && away >= 0 && away < AWAY_MS ? 'quick' : 'full';
}
