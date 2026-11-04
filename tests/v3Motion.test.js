// tests/v3Motion.test.js
// Data fills in instead of popping in, but the real value is never hidden or replaced: the first render (and the server
// render) carries the final figure, a count only runs between real values, and unknown stays a dash, never 0.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { numberIn, countAt } from '../src/v3/ui/useMotion.js';
import { CountUp, CountText } from '../src/v3/ui/Motion.jsx';

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
  it('charts only animate inside a revealed section, and reduced motion turns every reveal off', () => {
    expect(css).toMatch(/\[data-reveal='in'\] \.v3-bar \{[^}]*animation: v3-grow/);
    expect(css).toMatch(/\[data-reveal='in'\] \.v3-plot-svg, \[data-reveal='in'\] \.v3-spread svg \{ animation: v3-wipe/);
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.v3-bar', '.v3-gapbar', '.v3-plot-svg', '.v3-dot', '.v3-sdot']) expect(reduced).toContain(sel);
    expect(reduced).toMatch(/\.v3-page > \[data-reveal\] \{ opacity: 1 !important/);
  });
});
