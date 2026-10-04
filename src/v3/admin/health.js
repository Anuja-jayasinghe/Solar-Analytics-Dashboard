// src/v3/admin/health.js
//
// Data health for the admin, derived only from what the read API already returns: how fresh the daily
// totals are, whether days are missing, and whether a bill is overdue. Nothing is invented: a figure with no
// source says so. (The nightly collector's own run log is private and not exposed yet.)

import { diffDays } from '../../../shared/domain/time.js';

export const REPO_URL = 'https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard';

/** Workflows an admin may need, each opening its GitHub Actions page. Always a dry run first. */
export const MAINTENANCE = Object.freeze([
  { id: 'db-snapshot.yml', label: 'Take a DB snapshot', note: 'Read-only export of the tables. Do this before anything that writes.' },
  { id: 'backfill-telemetry.yml', label: 'Backfill telemetry', note: 'Re-reads a date range from SolisCloud. Dry run by default.' },
  { id: 'backfill-daily-summaries.yml', label: 'Backfill daily summaries', note: 'Rebuilds missing daily totals from the Solis month API. Dry run by default.' },
  { id: 'data-freshness-check.yml', label: 'Run the freshness check', note: 'Opens an issue if data has stopped arriving.' }
]);

export const workflowUrl = (id) => `${REPO_URL}/actions/workflows/${id}`;

const BILL_OVERDUE_DAYS = 40; // bills arrive about monthly; later than this deserves a look

/**
 * @param {{totals:object|null, todayKey:string|null}} input
 * @returns {{label:string, value:string, tone:'good'|'warn'|'bad'|'neutral', tip:string}[]}
 */
export function freshnessItems({ totals, todayKey }) {
  const gen = totals?.generation ?? null;
  const earn = totals?.earnings ?? null;
  const items = [];

  if (!gen || !gen.lastDay || !todayKey) {
    items.push({ label: 'Latest daily total', value: 'unknown', tone: 'neutral', tip: 'No daily totals have been read yet.' });
  } else {
    const age = diffDays(gen.lastDay, todayKey); // 1 = yesterday, which is normal
    items.push({
      label: 'Latest daily total',
      value: gen.lastDay,
      tone: age <= 1 ? 'good' : age <= 3 ? 'warn' : 'bad',
      tip: age <= 1 ? 'Yesterday is in: collection is current.' : `${age} days ago. If this keeps growing, collection has stopped: check the freshness check and the collector workflows.`
    });
    items.push({
      label: 'Days without a reading',
      value: String(gen.missingDays),
      tone: gen.missingDays === 0 ? 'good' : 'warn',
      tip: `${gen.missingDays} day${gen.missingDays === 1 ? '' : 's'} between ${gen.firstDay} and ${gen.lastDay} have no daily total. They are shown as unknown, never as zero.`
    });
  }

  if (!earn || !earn.lastBillDate || !todayKey) {
    items.push({ label: 'Latest bill', value: 'none yet', tone: 'neutral', tip: 'No approved bill yet.' });
  } else {
    const age = diffDays(earn.lastBillDate, todayKey);
    items.push({
      label: 'Latest bill',
      value: earn.lastBillDate,
      tone: age <= BILL_OVERDUE_DAYS ? 'good' : 'warn',
      tip: age <= BILL_OVERDUE_DAYS ? `${age} days ago.` : `${age} days ago: a newer bill may be waiting to be uploaded.`
    });
    if (earn.billsWithoutEarnings) {
      items.push({ label: 'Bills without earnings', value: String(earn.billsWithoutEarnings), tone: 'warn', tip: 'These bills are left out of the earnings total and the money gap until an earnings figure is added.' });
    }
  }
  return items;
}
