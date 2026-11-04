// src/v3/ui/useMotion.js
//
// Motion when data arrives, so a refresh or a revisit fills in instead of popping in all at once:
//   - numbers count up from 0 the first time they arrive (each time the view mounts), then glide to a new value on a
//     live refresh; they never replay from 0 on an update, which would look like the data reset
//   - sections below the first screen fade and rise once as they scroll into view; charts inside a section draw
//     (bars grow, lines wipe in) when the section is revealed (styles: base.css, "reveal")
// The server render and the first paint carry the real final value; nothing waits on the animation.
// With prefers-reduced-motion, values are shown at once and nothing moves.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readPref, writePref } from '../theme/storage.js';
import { motionFor } from './motionMode.js';

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
export function useCount(target, { duration = 700, glide = 450, delay = 0, off = false } = {}) {
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
    if (off || reducedMotion() || hidden || from === target) { shownRef.current = target; setShown(target); setWaiting(false); return undefined; }
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
/** After this long the load sequence is over: a chart drawn later (scrolled to, or a new range) starts at once. */
export const LOAD_WINDOW_MS = 3000;
/** A chart draws when this share of it is on screen, not when its first pixel scrolls in. */
export const DRAW_AT = 0.4;

let pageStart = -Infinity; // when the current page's sections were staged
const lateNow = () => (typeof performance === 'undefined' ? true : performance.now() - pageStart > LOAD_WINDOW_MS);
/** Draw now, without waiting for a load-sequence turn (and without the "after the bars" offsets). */
function startNow(el) {
  el.style.setProperty('--reveal-delay', '0ms');
  el.style.setProperty('--after', '0s');
}

/**
 * Scroll reveal for the direct children of `ref` (the page's sections): one already on screen is marked "in" at once
 * with a staged start (its charts draw in turn), one further down is "pending" (hidden) until about a tenth of it
 * scrolls into view. Once per mount.
 */
export function useRevealChildren(ref, mode = 'full') {
  useIso(() => {
    const root = ref.current;
    if (!root) return undefined;
    const kids = [...root.children];
    pageStart = performance.now();
    // quick: everything is on show at once (the page fades in together; base.css), with no turns to wait for
    if (mode === 'quick' || typeof IntersectionObserver !== 'function' || reducedMotion()) {
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
    // Once the load sequence has played, nothing waits for its turn any more (a range change redraws at once).
    const done = setTimeout(() => { for (const k of kids) k.style.setProperty('--reveal-delay', '0ms'); }, LOAD_WINDOW_MS);
    return () => { io.disconnect(); clearTimeout(done); };
  }, []);
}

/**
 * Full or quick for this visit (motionMode.js), decided once when the Overview opens, and the "last on screen" time kept
 * up to date while it is shown (every minute, and when the tab is hidden or the page left).
 */
export function usePageMotion() {
  const [mode] = useState(() => (typeof window === 'undefined' ? 'full' : motionFor(Date.now(), Number(readPref('overviewSeen', '0')))));
  useEffect(() => {
    const mark = () => writePref('overviewSeen', Date.now());
    mark();
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') mark(); }, 60_000);
    document.addEventListener('visibilitychange', mark);
    window.addEventListener('pagehide', mark);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', mark);
      window.removeEventListener('pagehide', mark);
      mark();
    };
  }, []);
  return mode;
}

/**
 * A ref for a chart: it draws (data-draw="in") when DRAW_AT of it is on screen, so a chart below the first screen draws
 * as it is scrolled to, not while it is out of sight. Until then its animations are held at their start (base.css).
 * A chart on screen at load draws in its section's turn; one that appears later, or is scrolled to, starts at once.
 */
export function useDrawRef() {
  const cleanup = useRef(null);
  return useCallback((el) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    if (typeof IntersectionObserver !== 'function' || reducedMotion()) { el.dataset.draw = 'in'; return; }
    const r = el.getBoundingClientRect();
    const seen = r.height > 0 ? (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height : 0;
    if (seen >= DRAW_AT) {
      if (lateNow()) startNow(el);
      el.dataset.draw = 'in';
      return;
    }
    el.dataset.draw = 'pending';
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      startNow(el);
      el.dataset.draw = 'in';
      io.disconnect();
    }, { threshold: DRAW_AT });
    io.observe(el);
    cleanup.current = () => io.disconnect();
  }, []);
}
