// tests/v3SunMeter.test.js
// The live power gauge, a rising sun: 40 rays from 0 kW (left) to the maximum (right), lit to the live reading, with
// today's peak marked on the scale. Unknown power lights nothing (never shown as 0); at night the sun rests.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { RAYS, RED_FROM, at, rays, rayLevels, peakAngle, scaleLabels } from '../src/v3/overview/sunMeter.js';
import { LiveGauge } from '../src/v3/overview/LiveGauge.jsx';

describe('rising sun geometry', () => {
  it('40 rays fan from the left horizon to the right, the last five the red zone', () => {
    const r = rays();
    expect(r).toHaveLength(RAYS);
    expect(r[0].outer.x).toBeLessThan(0); // starts on the left
    expect(r[39].outer.x).toBeGreaterThan(0); // ends on the right
    expect(r.every((x) => x.outer.y < 0)).toBe(true); // all above the horizon
    expect(r.filter((x) => x.red).map((x) => x.i)).toEqual([35, 36, 37, 38, 39]);
    expect(RED_FROM).toBe(35);
    expect(at(0.5, 100)).toEqual({ x: 0, y: -100 }); // half the maximum points straight up
  });
  it('lights rays up to the reading, the next one partly, and nothing when power is unknown', () => {
    const half = rayLevels(0.5);
    expect(half.filter((v) => v === 1)).toHaveLength(20);
    expect(half[20]).toBe(0);
    const between = rayLevels(21.4 / 45);
    expect(between.filter((v) => v === 1)).toHaveLength(19);
    expect(between[19]).toBeGreaterThan(0);
    expect(between[19]).toBeLessThan(1);
    expect(rayLevels(null).every((v) => v === 0)).toBe(true);
    expect(rayLevels(1.4).every((v) => v === 1)).toBe(true); // over the rating: capped, all lit
  });
  it('the peak marker turns from -90 deg (0 kW) to +90 deg (the maximum)', () => {
    expect(peakAngle(0)).toBe(-90);
    expect(peakAngle(0.5)).toBe(0);
    expect(peakAngle(31.7 / 40)).toBeCloseTo(52.65, 2);
    expect(peakAngle(null)).toBeNull();
  });
  it('the scale is labelled on round steps and always ends on the maximum', () => {
    expect(scaleLabels(40).map((l) => l.text)).toEqual(['0', '10', '20', '30', '40 kW']);
    expect(scaleLabels(45).map((l) => l.text)).toEqual(['0', '10', '20', '30', '40', '45 kW']);
    expect(scaleLabels(41.76).map((l) => l.text)).toEqual(['0', '10', '20', '30', '41.8 kW']);
    expect(scaleLabels(null)).toEqual([]);
  });
});

describe('rising sun gauge', () => {
  const live = { status: 'online', currentPowerKw: 22.2, peakTodayKw: 31.7, peakTodayAt: '11:28' };
  it('lights rays for the reading and marks today\'s peak with a line and an arrow', () => {
    const html = renderToString(h(LiveGauge, { live, maxKw: 40 }));
    expect((html.match(/class="v3-sun-ray" data-lit="true"/g) ?? []).length).toBe(23); // 22.2 of 40 kW: 22 full + 1 partial
    expect(html).toContain('class="v3-sun-peak" transform="rotate(52.65)"');
    expect(html).toContain('Peak 31.7 kW at 11:28');
    expect(html).toContain("22.2 kilowatts; today&#x27;s peak 31.7 kw at 11:28");
    expect(html).not.toContain('data-resting');
  });
  it('prefers the day chart\'s peak, so the tile and the chart agree', () => {
    const html = renderToString(h(LiveGauge, { live, maxKw: 40, peak: { kw: 32.4, at: '11:40' } }));
    expect(html).toContain('Peak 32.4 kW at 11:40');
  });
  it('rests at night and with unknown power: grey sun, no lit ray, a dash not a 0', () => {
    const night = renderToString(h(LiveGauge, { live: { status: 'offline', currentPowerKw: 0 }, maxKw: 40 }));
    expect(night).toContain('data-resting="true"');
    expect(night).toContain('Asleep');
    expect(night).not.toContain('data-lit');
    const unknown = renderToString(h(LiveGauge, { live: { status: 'online', currentPowerKw: null }, maxKw: 40 }));
    expect(unknown).toContain('data-resting="true"');
    expect(unknown).toMatch(/v3-gauge-kw">—</);
    expect(unknown).not.toContain('v3-sun-peak'); // no peak known: no marker
  });
});
