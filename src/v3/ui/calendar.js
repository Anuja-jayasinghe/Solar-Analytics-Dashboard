// src/v3/ui/calendar.js
//
// Pure calendar maths for the date pickers. Works on 'YYYY-MM-DD' keys only (never Date objects in local
// time), so a timezone can never shift a day. Weeks start on Monday.

import { addDays } from '../../../shared/domain/time.js';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n) => String(n).padStart(2, '0');
export const monthOf = (key) => key.slice(0, 7); // 'YYYY-MM'

/** 'YYYY-MM' moved by n months. */
export function addMonths(ym, n) {
  const idx = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function daysInMonth(ym) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 0 = Monday ... 6 = Sunday, for a date key (Zeller-free: from a known Monday, 2024-01-01). */
export function weekdayOf(key) {
  const days = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse('2024-01-01T00:00:00Z')) / 86400000);
  return ((days % 7) + 7) % 7;
}

/** Six weeks of seven days covering `ym`, each { key, inMonth }. Always 42 cells so the grid never jumps. */
export function monthGrid(ym) {
  const first = `${ym}-01`;
  const start = addDays(first, -weekdayOf(first));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const key = addDays(start, i);
    cells.push({ key, inMonth: monthOf(key) === ym });
  }
  return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function outOfBounds(key, min, max) {
  return (min && key < min) || (max && key > max) || false;
}

/** Keep a key inside [min, max]. */
export function clampKey(key, min, max) {
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}

export function monthTitle(ym) {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

/** '2036-08-16' -> '16 Aug 2036' */
export function shortLabel(key) {
  if (!key) return '';
  return `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${key.slice(0, 4)}`;
}

/** Ordered range from two picks, whichever was first. */
export function orderRange(a, b) {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Where keyboard focus goes for an arrow / page key, or null if the key is not a navigation key. */
export function moveFocus(key, code) {
  switch (code) {
    case 'ArrowLeft': return addDays(key, -1);
    case 'ArrowRight': return addDays(key, 1);
    case 'ArrowUp': return addDays(key, -7);
    case 'ArrowDown': return addDays(key, 7);
    case 'PageUp': return `${addMonths(monthOf(key), -1)}-${pad(Math.min(Number(key.slice(8, 10)), daysInMonth(addMonths(monthOf(key), -1))))}`;
    case 'PageDown': return `${addMonths(monthOf(key), 1)}-${pad(Math.min(Number(key.slice(8, 10)), daysInMonth(addMonths(monthOf(key), 1))))}`;
    default: return null;
  }
}
