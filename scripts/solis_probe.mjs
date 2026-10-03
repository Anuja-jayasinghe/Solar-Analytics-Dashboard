// scripts/solis_probe.mjs
//
// READ-ONLY SolisCloud probe used for docs/SOLIS_API_FIELD_CATALOG.md (issue #153).
//
//   node scripts/solis_probe.mjs <output-dir-OUTSIDE-the-repo>
//
// Needs SOLIS_API_URL / SOLIS_API_ID / SOLIS_API_SECRET in .env. A hard allowlist below makes
// it impossible to call a write endpoint (addStation, stationUpdate, delCollector, ...).
// Responses contain owner, address, GPS and device identifiers: write them OUTSIDE the repo
// and never commit them.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').split(path.sep).join('/');
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node scripts/solis_probe.mjs <output-dir>'); process.exit(2); }
if (path.resolve(OUT).startsWith(path.resolve(ROOT))) { console.error('refusing to write responses inside the repo'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
for (const l of fs.readFileSync(`${ROOT}/.env`, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^(SOLIS_API_[A-Z]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const { solisFetch } = await import(`file:///${ROOT}/api/_lib/solisAuth.js`);
const READ_ONLY = new Set(['inverterList','inverterDetail','inverterDetailList','inverterDay','inverterMonth','inverterYear','inverterAll','inverter/shelfTime','alarmList','collectorList','collectorDetail','collector/day','epmList','epmDetail','epm/day','epm/month','epm/year','epm/all','weatherList','weatherDetail','ammeterList','ammeterDetail','userStationList','stationDetail','stationDetailList','stationDayEnergyList','stationMonthEnergyList','stationYearEnergyList','stationDay','stationMonth','stationYear','stationAll']);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = [];
async function call(name, body, tag = name) {
  if (!READ_ONLY.has(name)) throw new Error('BLOCKED non-read-only endpoint: ' + name);
  await sleep(700);
  let res, err;
  try { res = await solisFetch(`/v1/api/${name}`, body); } catch (e) { err = e.message; }
  const data = res?.data;
  const arr = Array.isArray(data) ? data : data?.records || data?.page?.records || data?.data || null;
  const entry = { tag, name, body: { ...body, sn: body.sn ? 'SN' : undefined }, code: res?.code, msg: res?.msg ?? err, shape: data == null ? null : Array.isArray(data) ? `array[${data.length}]` : Object.keys(data).slice(0, 12), n: Array.isArray(arr) ? arr.length : null };
  log.push(entry);
  fs.writeFileSync(`${OUT}/${tag.replace(/[^\w.-]/g, '_')}.json`, JSON.stringify(res ?? { error: err }, null, 1));
  console.log(`${tag.padEnd(34)} code=${entry.code} n=${entry.n} ${entry.code === '0' ? '' : String(entry.msg).slice(0, 80)}`);
  return res;
}
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() - n); return d; };

const list = await call('inverterList', { pageNo: 1, pageSize: 100 });
const inv = (list?.data?.page?.records || list?.data?.records || [])[0];
if (!inv) { console.log('no inverter found'); process.exit(1); }
const sn = inv.sn, id = inv.id, stationId = inv.stationId, collectorSn = inv.collectorSn;
await call('userStationList', { pageNo: 1, pageSize: 100 });
await call('stationDetail', { id: stationId });
await call('stationDetailList', { pageNo: 1, pageSize: 100 });
await call('inverterDetail', { sn });
await call('inverterDetailList', { pageNo: 1, pageSize: 100 });
const today = ymd(daysAgo(0)), yday = ymd(daysAgo(1));
for (const tz of [5, 5.5, 6, 8]) await call('inverterDay', { sn, money: 'LKR', time: yday, timeZone: tz }, `inverterDay_tz${tz}`);
await call('inverterDay', { sn, money: 'LKR', time: today, timeZone: 8 }, 'inverterDay_today_tz8');
await call('inverterMonth', { sn, money: 'LKR', month: yday.slice(0, 7), timeZone: 8 });
await call('inverterYear', { sn, money: 'LKR', year: yday.slice(0, 4) });
await call('inverterAll', { sn, money: 'LKR' });
await call('inverter/shelfTime', { sn });
await call('alarmList', { pageNo: 1, pageSize: 100, stationId, alarmDeviceSn: sn, alarmBeginTime: ymd(daysAgo(365)), alarmEndTime: today }, 'alarmList_365d');
await call('collectorList', { pageNo: 1, pageSize: 100 });
await call('collectorDetail', { sn: collectorSn });
await call('collector/day', { sn: collectorSn, time: yday, timeZone: 8 });
await call('epmList', { pageNo: 1, pageSize: 100 });
await call('weatherList', { pageNo: 1, pageSize: 100 });
await call('ammeterList', { pageNo: 1, pageSize: 100 });
await call('stationDay', { id: stationId, money: 'LKR', time: yday, timeZone: 8 });
await call('stationMonth', { id: stationId, money: 'LKR', month: yday.slice(0, 7) });
await call('stationYear', { id: stationId, money: 'LKR', year: yday.slice(0, 4) });
await call('stationAll', { id: stationId, money: 'LKR' });
await call('stationDayEnergyList', { pageNo: 1, pageSize: 100, money: 'LKR', time: yday, timeZone: 8 });
await call('stationMonthEnergyList', { pageNo: 1, pageSize: 100, money: 'LKR', month: yday.slice(0, 7) });
await call('stationYearEnergyList', { pageNo: 1, pageSize: 100, money: 'LKR', year: yday.slice(0, 4) });
// retention: how far back does inverterDay return points?
for (const n of [7, 30, 90, 180, 365, 540, 730]) await call('inverterDay', { sn, money: 'LKR', time: ymd(daysAgo(n)), timeZone: 8 }, `retention_${n}d_${ymd(daysAgo(n))}`);
fs.writeFileSync(`${OUT}/_summary.json`, JSON.stringify(log, null, 1));
console.log('done', log.length, 'calls');
