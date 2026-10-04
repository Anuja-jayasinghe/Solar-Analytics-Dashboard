// tests/v3Floating.test.js
// Floating placement (hints, pickers never cut off) and the calendar maths behind the date pickers.
import { describe, it, expect } from 'vitest';
import { placeFloating } from '../src/v3/ui/floating.js';
import { addMonths, daysInMonth, weekdayOf, monthGrid, outOfBounds, clampKey, monthTitle, shortLabel, orderRange, moveFocus } from '../src/v3/ui/calendar.js';

const vp = { width: 1000, height: 800 };
const rect = (left, top, w = 40, h = 20) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h });

describe('floating placement keeps bubbles on screen', () => {
  it('goes above the anchor, centred, when there is room', () => {
    expect(placeFloating(rect(480, 400), { width: 100, height: 30 }, vp)).toEqual({ top: 362, left: 450, placement: 'top' });
  });
  it('flips below when there is no room above (the top edge cut-off)', () => {
    expect(placeFloating(rect(480, 10), { width: 100, height: 30 }, vp)).toMatchObject({ top: 38, placement: 'bottom' });
  });
  it('is pushed inside at the left and right edges (the side cut-offs)', () => {
    expect(placeFloating(rect(0, 400), { width: 200, height: 30 }, vp).left).toBe(8);
    expect(placeFloating(rect(990, 400, 10), { width: 200, height: 30 }, vp).left).toBe(792);
  });
  it('prefers below for pickers and falls back above near the bottom', () => {
    expect(placeFloating(rect(100, 100), { width: 280, height: 300 }, vp, 'bottom', 6)).toMatchObject({ top: 126, placement: 'bottom' });
    expect(placeFloating(rect(100, 700), { width: 280, height: 300 }, vp, 'bottom', 6)).toMatchObject({ top: 394, placement: 'top' });
  });
  it('goes to the right when asked and there is room, otherwise above', () => {
    expect(placeFloating(rect(50, 300), { width: 100, height: 30 }, vp, 'right')).toMatchObject({ left: 98, placement: 'right' });
    expect(placeFloating(rect(950, 300), { width: 100, height: 30 }, vp, 'right').placement).toBe('top');
  });
  it('pickers line up with the left edge of their button, still kept on screen', () => {
    expect(placeFloating(rect(70, 100), { width: 400, height: 300 }, vp, 'bottom', 6, 'start').left).toBe(70);
    expect(placeFloating(rect(900, 100), { width: 400, height: 300 }, vp, 'bottom', 6, 'start').left).toBe(592);
  });

  it('a bubble taller than the window still starts on screen', () => {
    expect(placeFloating(rect(480, 400), { width: 100, height: 2000 }, vp).top).toBe(8);
  });
});

describe('calendar maths', () => {
  it('moves months across years and knows month lengths, leap years included', () => {
    expect(addMonths('2036-12', 1)).toBe('2037-01');
    expect(addMonths('2036-01', -1)).toBe('2035-12');
    expect(daysInMonth('2036-02')).toBe(29);
    expect(daysInMonth('2035-02')).toBe(28);
    expect(daysInMonth('2100-02')).toBe(28);
    expect(daysInMonth('2000-02')).toBe(29);
  });
  it('weeks start on Monday and the grid is always 6 x 7', () => {
    expect(weekdayOf('2026-10-05')).toBe(0); // a Monday
    expect(weekdayOf('2026-10-04')).toBe(6); // a Sunday
    const g = monthGrid('2026-10');
    expect(g).toHaveLength(6);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0][0].key).toBe('2026-09-28');
    expect(g[0][3]).toEqual({ key: '2026-10-01', inMonth: true });
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });
  it('bounds, labels and ranges', () => {
    expect(outOfBounds('2024-08-01', '2024-08-02', '2026-10-03')).toBe(true);
    expect(outOfBounds('2026-10-03', '2024-08-02', '2026-10-03')).toBe(false);
    expect(outOfBounds('2026-10-04', null, null)).toBe(false);
    expect(clampKey('2030-01-01', null, '2026-10-03')).toBe('2026-10-03');
    expect(monthTitle('2036-08')).toBe('August 2036');
    expect(shortLabel('2036-08-16')).toBe('16 Aug 2036');
    expect(shortLabel(null)).toBe('');
    expect(orderRange('2036-08-20', '2036-08-01')).toEqual({ from: '2036-08-01', to: '2036-08-20' });
  });
  it('keyboard: arrows by day and week, page keys by month (clamped to the month length)', () => {
    expect(moveFocus('2036-08-31', 'ArrowRight')).toBe('2036-09-01');
    expect(moveFocus('2036-08-03', 'ArrowUp')).toBe('2036-07-27');
    expect(moveFocus('2036-03-31', 'PageUp')).toBe('2036-02-29');
    expect(moveFocus('2036-01-31', 'PageDown')).toBe('2036-02-29');
    expect(moveFocus('2036-01-31', 'Tab')).toBeNull();
  });
});
