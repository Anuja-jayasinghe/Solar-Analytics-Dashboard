// Read-only alarm pagination check and aggregate report. No raw records are printed.
import { readFileSync } from 'node:fs';
import { signSolisRequest } from '../../api/_lib/solisAuth.js';

const identityPath = process.argv[2];
if (!identityPath) throw new Error('Pass the private inverterList.json path.');
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
const records = identity?.data?.page?.records ?? [];
if (records.length !== 1) throw new Error('Expected one inverter.');
const inverter = records[0];
const resource = '/v1/api/alarmList';
const begin = '2026-07-01';
const end = '2026-10-05';

async function page(pageNo) {
  const bodyString = JSON.stringify({
    stationId: inverter.stationId,
    alarmDeviceSn: inverter.sn,
    alarmBeginTime: begin,
    alarmEndTime: end,
    pageSize: 100,
    pageNo
  });
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = signSolisRequest({
      apiId: process.env.SOLIS_API_ID,
      apiSecret: process.env.SOLIS_API_SECRET,
      path: resource,
      bodyString,
      date: new Date().toUTCString()
    }).headers;
    try {
      response = await fetch(`https://www.soliscloud.com:13333${resource}`, {
        method: 'POST', headers, body: bodyString, signal: AbortSignal.timeout(15000)
      });
      break;
    } catch (error) {
      if (attempt) throw new Error(`Transport failed twice (${error.name}).`);
    }
  }
  const parsed = await response.json();
  if (!response.ok || String(parsed.code) !== '0') throw new Error(`Alarm page failed: HTTP ${response.status}, API code ${String(parsed.code)}.`);
  return parsed.data;
}

const first = await page(1);
const pages = Number(first.pages);
if (!Number.isInteger(pages) || pages < 1 || pages > 10) throw new Error('Unexpected page count.');
const all = [...(first.records ?? [])];
for (let i = 2; i <= pages; i++) all.push(...((await page(i)).records ?? []));
const key = (record) => `${record.alarmDeviceSn}|${record.alarmCode}|${record.alarmBeginTime}`;
const unique = new Map(all.map((record) => [key(record), record]));
const counts = (array, f) => Object.fromEntries([...array.reduce((map, record) => {
  const k = f(record);
  map.set(k, (map.get(k) ?? 0) + 1);
  return map;
}, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b))));
const underVoltage = [...unique.values()].filter((record) => String(record.alarmCode) === '1011');
const localHour = (record) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo', hour: '2-digit', hourCycle: 'h23'
}).format(new Date(Number(record.alarmBeginTime)));
console.log(JSON.stringify({
  period: { begin, end },
  reportedTotal: first.total,
  pages,
  fetched: all.length,
  unique: unique.size,
  byCode: counts([...unique.values()], (record) => String(record.alarmCode)),
  gridUnderVoltageByLocalHour: counts(underVoltage, localHour),
  gridUnderVoltageLongerThanOneHour: underVoltage.filter((record) => Number(record.alarmLong) > 3_600_000).length,
  byMonth: counts([...unique.values()], (record) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit'
  }).format(new Date(Number(record.alarmBeginTime))))
}, null, 2));
