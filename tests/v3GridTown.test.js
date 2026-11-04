// tests/v3GridTown.test.js
// The daily goal as a little power grid: ten buildings, each exactly 10% of today's target, lit floor by floor; lamps
// at the target; gold windows and stars past it. Unknown or missing target: nothing lit, never a false "0%".
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { BUILDINGS, BUILDINGS_N, BUS_END, BUS_START, box, frontierX, pulseRoute, townState } from '../src/v3/overview/gridTown.js';
import { TodayTile } from '../src/v3/overview/TodayTile.jsx';

describe('town geometry', () => {
  it('a box has a front, a side and a top, the back set off up and to the right', () => {
    const b = box(10, 20, 30, 100);
    expect(b.front).toBe('M10 70 H30 V100 H10 Z');
    expect(b.side).toBe('M30 70 L40 63 V93 L30 100 Z');
    expect(b.top).toBe('M10 70 L20 63 H40 L30 70 Z');
  });
  it('ten buildings, left to right, each with its windows', () => {
    expect(BUILDINGS).toHaveLength(BUILDINGS_N);
    expect(BUILDINGS.every((b, i) => i === 0 || b.x > BUILDINGS[i - 1].x)).toBe(true);
    expect(BUILDINGS.every((b) => b.windows.length >= 6)).toBe(true);
  });
});

describe('town state', () => {
  it('each building is 10%: 81% powers 8 buildings and part of the 9th', () => {
    const s = townState(0.81);
    expect(s.powered).toBe(8);
    expect(s.lit.slice(0, 8).every((n, i) => n === BUILDINGS[i].windows.length)).toBe(true);
    expect(s.lit[8]).toBe(Math.round(BUILDINGS[8].windows.length * 0.1));
    expect(s.lit[9]).toBe(0);
    expect(s.lampsOn).toBe(false);
    expect(s.gold).toBe(0);
    expect(s.stars).toBe(0);
  });
  it('at the target every building is lit and the lamps come on; past it, gold windows and stars', () => {
    expect(townState(1)).toMatchObject({ powered: 10, lampsOn: true, gold: 0, stars: 0 });
    const big = townState(1.1);
    expect(big.gold).toBe(5); // one building per 2% over
    expect(big.stars).toBe(9);
    expect(townState(1.4).gold).toBe(10); // capped
  });
  it('nothing lit for unknown energy, and the street cable ends where the town is powered to', () => {
    expect(townState(null)).toMatchObject({ powered: 0, lampsOn: false });
    expect(townState(null).lit.every((n) => n === 0)).toBe(true);
    expect(frontierX(0)).toBe(Math.round(BUS_START * 10) / 10);
    expect(frontierX(1)).toBe(Math.round(BUS_END * 10) / 10);
    expect(frontierX(3)).toBe(Math.round(BUS_END * 10) / 10);
    expect(pulseRoute(0.5)).toMatch(/^M[\d. ]+( L[\d. ]+)+$/);
  });
});

describe('daily goal tile', () => {
  const live = { status: 'online', todayKwh: 113.4, currentPowerKw: 22.2, dataTimestamp: 1000, stale: false };
  it('leads with today\'s kWh, then the percentage of the target, then the target and what is left', () => {
    const html = renderToString(h(TodayTile, { live, targetKwh: 140, now: 1000 }));
    const text = html.slice(html.indexOf('v3-today-text')); // the words beside the town, in reading order
    const kwhAt = text.indexOf('113.4'), pctAt = text.search(/81(<!-- -->)?%/), targetAt = text.indexOf('140 kWh target · 26.6 to go');
    expect(text).toMatch(/v3-kpi-value">(<!-- -->)?113\.4/); // today's kWh is the headline
    expect(pctAt).toBeGreaterThan(kwhAt); // then the percentage
    expect(targetAt).toBeGreaterThan(pctAt); // then the target details
    expect(html).toContain('of today&#x27;s target');
    expect(html).not.toContain('>8 of 10 buildings powered<'); // the town shows it; no line of text for it
    expect(html).toContain('aria-label="81% of today&#x27;s target: 8 of 10 buildings powered"'); // still told to screen readers
    expect(html).toContain('class="v3-town-pulse"'); // energy flowing while live
  });
  it('over the target: the whole town, and how much over', () => {
    const html = renderToString(h(TodayTile, { live: { ...live, todayKwh: 154 }, targetKwh: 140, now: 1000 }));
    expect(html).toContain('the whole town is powered'); // in the town's label
    expect(html).toContain('140 kWh target · 14.0 over');
  });
  it('stale or asleep: no energy flowing; no target: kWh only and a hint', () => {
    const stale = renderToString(h(TodayTile, { live: { ...live, stale: true }, targetKwh: 140, now: 1000 }));
    expect(stale).not.toContain('v3-town-pulse');
    const night = renderToString(h(TodayTile, { live: { ...live, status: 'offline' }, targetKwh: 140, now: 1000 }));
    expect(night).not.toContain('v3-town-pulse');
    const none = renderToString(h(TodayTile, { live, targetKwh: null, now: 1000 }));
    expect(none).toContain('Set a daily target in Settings');
    expect(none).not.toContain('buildings powered');
    expect(none).not.toContain('data-on="true" x'); // no window lit without a target
  });
});
