// src/v3/data/today.js
//
// Which day it is, for a page. Always the SERVER's answer — the browser's clock and timezone may
// differ, and the demo has its own fixed date (shared/data/resources.js, `live`).
//
// `live` carries the date, but `live` waits on SolisCloud and fails when SolisCloud does. Pages used
// to read the date from `live` alone, so one slow or failed SolisCloud call left the Pro page and
// the Overview's CEB comparison waiting forever, even though everything they show comes from the
// database. `totals` carries the same server date and never touches SolisCloud.

/**
 * @param {{ data?: { todayKey?: string } }} live    the `live` resource state
 * @param {{ data?: { todayKey?: string } }} totals  the `totals` resource state
 * @returns {string | null} 'YYYY-MM-DD', or null while neither has answered
 */
export function pageTodayKey(live, totals) {
  return live?.data?.todayKey ?? totals?.data?.todayKey ?? null;
}
