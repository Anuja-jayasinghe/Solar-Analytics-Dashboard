// src/v3/ui/useMotion.js
//
// Motion when data arrives, so a refresh or a revisit fills in instead of popping in all at once:
//   - numbers count up from 0 the first time they arrive (each time the view mounts), then glide to a new value on a
//     live refresh; they never replay from 0 on an update, which would look like the data reset
//   - sections below the first screen fade and rise once as they scroll into view; charts inside a section draw
//     (bars grow, lines wipe in) when the section is revealed (styles: base.css, "reveal")
// The server render and the first paint carry the real final value; nothing waits on the animation.
// With prefers-reduced-motion, values are shown at once and nothing moves.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const easeOut = (t) => 1 - (1 - t) ** 3;

export function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const NUMBER = /-?\d[\d,]*(\.\d+)?/;

/**
 * The number inside a formatted text, to count up while keeping the rest: 'LKR 3.07' ->
 * { before: 'LKR ', value: 3.07, dp: 2, after: '' }. Null when there is no number (a dash).
 */
export function numberIn(text) {
  const m = typeof text === 'string' ? text.match(NUMBER) : null;
  if (!m) return null;
  const value = Number(m[0].replace(/,/g, ''));
  if (!isNum(value)) return null;
  return { before: text.slice(0, m.index), value, dp: m[1] ? m[1].length - 1 : 0, after: text.slice(m.index + m[0].length) };
}

/** Where a count is at `t` (0..1) of its run: eased out, so it slows into the real value. */
export function countAt(from, to, t) {
  if (t >= 1) return to;
  return from + (to - from) * easeOut(Math.max(0, t));
}

/**
 * The value to draw for `target`: counts up from 0 over `duration` when a number first arrives (after `delay`), and
 * glides from what is on screen over `glide` when it changes later. Unknown (null) shows as is, never as 0.
 */
export function useCountUp(target, opts) {
  return useCount(target, opts).shown;
}

/**
 * useCountUp plus `waiting`: true while a first count waits for its turn (`delay`). A number shown during that wait would
 * read as a real 0, so CountUp keeps it hidden until it starts.
 */
export function useCount(target, { duration = 700, glide = 450, delay = 0 } = {}) {
  const [shown, setShown] = useState(target);
  const [waiting, setWaiting] = useState(false);
  const shownRef = useRef(null); // what is on screen now (null = no number shown yet)
  const raf = useRef(0);

  useIso(() => {
    cancelAnimationFrame(raf.current);
    if (!isNum(target)) { shownRef.current = null; setShown(target); setWaiting(false); return undefined; }
    const first = shownRef.current === null;
    const from = first ? 0 : shownRef.current;
    // A tab opened in the background shows the real value: there is nothing to watch, and frames do not run there.
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (reducedMotion() || hidden || from === target) { shownRef.current = target; setShown(target); setWaiting(false); return undefined; }
    const dur = first ? duration : glide;
    // Timed from now, not from the first frame: if frames are held back (a busy page), the count picks up where it
    // should be instead of sitting on its starting value.
    const start = performance.now() + (first ? delay : 0);
    const paint = (v) => { shownRef.current = v; setShown(v); };
    paint(from);
    setWaiting(first && delay > 0);
    const step = (ts) => {
      if (ts >= start) setWaiting(false);
      const t = Math.min(1, Math.max(0, (ts - start) / dur));
      paint(countAt(from, target, t));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]); // durations are fixed per call site

  return { shown, waiting };
}

/**
 * Sections on screen at load start one after another, top to bottom, this far apart, so the eye can follow one thing
 * at a time: the headline figures, then the live row, then the CEB chart. (A section revealed by scrolling starts at once.)
 */
export const STAGE_MS = 550;

/**
 * Scroll reveal for the direct children of `ref` (the page's sections): one already on screen is marked "in" at once
 * with a staged start (its charts draw in turn), one further down is "pending" (hidden) until about a tenth of it
 * scrolls into view. Once per mount.
 */
export function useRevealChildren(ref) {
  useIso(() => {
    const root = ref.current;
    if (!root) return undefined;
    const kids = [...root.children];
    if (typeof IntersectionObserver !== 'function' || reducedMotion()) {
      for (const k of kids) k.dataset.reveal = 'in';
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.dataset.reveal = 'in'; io.unobserve(e.target); }
    }, { threshold: 0.1 });
    let stage = 0;
    for (const k of kids) {
      if (k.getBoundingClientRect().top < window.innerHeight) {
        k.style.setProperty('--reveal-delay', `${stage * STAGE_MS}ms`); // CSS adds it to every animation inside
        stage += 1;
        k.dataset.reveal = 'in';
      } else { k.dataset.reveal = 'pending'; io.observe(k); }
    }
    return () => io.disconnect();
  }, []);
}
