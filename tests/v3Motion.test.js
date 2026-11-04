// tests/v3Motion.test.js
// Data fills in instead of popping in, but the real value is never hidden or replaced: the first render (and the server
// render) carries the final figure, a count only runs between real values, and unknown stays a dash, never 0.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { numberIn, countAt } from '../src/v3/ui/useMotion.js';
import { CountUp, CountText } from '../src/v3/ui/Motion.jsx';
import { motionFor, AWAY_MS } from '../src/v3/ui/motionMode.js';

describe('counting numbers', () => {
  it('finds the number in a formatted figure and keeps what is around it', () => {
    expect(numberIn('LKR 3.07')).toEqual({ before: 'LKR ', value: 3.07, dp: 2, after: '' });
    expect(numberIn('1,562')).toEqual({ before: '', value: 1562, dp: 0, after: '' });
    expect(numberIn('78.6')).toMatchObject({ value: 78.6, dp: 1 });
    expect(numberIn('—')).toBeNull();
    expect(numberIn(null)).toBeNull();
  });
  it('eases out and lands exactly on the real value', () => {
    expect(countAt(0, 100, 0)).toBe(0);
    expect(countAt(0, 100, 0.5)).toBeGreaterThan(50); // slows into the value
    expect(countAt(0, 100, 1)).toBe(100);
    expect(countAt(40, 35.5, 2)).toBe(35.5);
  });
  it('the first render already shows the final figure; unknown is a dash', () => {
    expect(renderToString(h(CountUp, { value: 98.24, dp: 1 }))).toBe('98.2');
    expect(renderToString(h(CountUp, { value: null, dp: 1 }))).toBe('—');
    expect(renderToString(h(CountText, { text: 'LKR 3.07' }))).toBe('LKR 3.07');
    expect(renderToString(h(CountText, { text: '—' }))).toBe('—');
  });
});

describe('reveal styles', () => {
  const css = readFileSync(new URL('../src/v3/styles/base.css', import.meta.url), 'utf8');
  it('charts animate only once drawn (held at the start until on screen), and reduced motion turns every reveal off', () => {
    expect(css).toMatch(/\[data-draw\] \.v3-bar \{[^}]*animation: v3-grow/);
    expect(css).toMatch(/\[data-draw\] \.v3-plot-svg, \.v3-spread\[data-draw\] svg \{ animation: v3-wipe/);
    expect(css).toMatch(/\[data-draw='pending'\] \* \{ animation-play-state: paused !important; \}/); // never seen half drawn
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.v3-bar', '.v3-gapbar', '.v3-plot-svg', '.v3-dot', '.v3-sdot']) expect(reduced).toContain(sel);
    expect(reduced).toMatch(/\.v3-page \.v3-glass \{ opacity: 1 !important/);
  });
});

describe('full sequence or quick fade', () => {
  const now = Date.parse('2026-11-04T10:00:00Z');
  it('full on a first visit or after 30 min or more away; quick on a refresh or return within that', () => {
    expect(motionFor(now, 0)).toBe('full'); // never seen here
    expect(motionFor(now, NaN)).toBe('full'); // storage unreadable
    expect(motionFor(now, now - 5_000)).toBe('quick'); // a refresh
    expect(motionFor(now, now - (AWAY_MS - 1))).toBe('quick');
    expect(motionFor(now, now - AWAY_MS)).toBe('full');
    expect(motionFor(now, now + 60_000)).toBe('full'); // a clock that moved backwards is not trusted
  });
  it('a quick visit fades the page in together and only the live charts still draw', () => {
    const css = readFileSync(new URL('../src/v3/styles/base.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.v3-page\[data-motion='quick'\] \.v3-glass \{ animation: v3-fadein \.3s ease-out backwards; \}/);
    // never on a wrapper around glass: that turns the glass flat dark (Chrome backdrop root)
    expect(css).not.toMatch(/\.v3-page\[data-motion='quick'\] > \* \{/);
    expect(css).toMatch(/\.v3-page\[data-motion='quick'\] \[data-draw\]:not\(\[data-keep\]\) \* \{ animation: none !important; \}/);
    const day = readFileSync(new URL('../src/v3/explore/DayBody.jsx', import.meta.url), 'utf8');
    expect(day).toContain('data-keep="live"');
  });
  it('a count can be switched off (quick visit): the final value at once', () => {
    expect(renderToString(h(CountText, { text: 'LKR 3.07', animate: false }))).toBe('LKR 3.07');
    expect(renderToString(h(CountUp, { value: 12, suffix: '%', animate: false }))).toBe('12%');
  });
});
