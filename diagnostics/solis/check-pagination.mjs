// Compare documented minId paging with the account's observed pageNo behavior.
// Prints counts and set relationships only; no account or device identifiers.

import { readFileSync } from 'node:fs';
import { signSolisRequest } from '../../api/_lib/solisAuth.js';

const identityPath = process.argv[2];
if (!identityPath) throw new Error('Pass the private inverterList.json path.');
const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
const inverters = identity?.data?.page?.records ?? [];
if (inverters.length !== 1) throw new Error('Expected one inverter in the private identity file.');
const inverter = inverters[0];
const resource = '/v1/api/alarmList';
const baseBody = {
  stationId: inverter.stationId,
  alarmDeviceSn: inverter.sn,
  alarmBeginTime: '2026-07-01',
  alarmEndTime: '2026-10-05',
  pageSize: 2
};

async function request(extra) {
  const bodyString = JSON.stringify({ ...baseBody, ...extra });
  const headers = signSolisRequest({
    apiId: process.env.SOLIS_API_ID,
    apiSecret: process.env.SOLIS_API_SECRET,
    path: resource,
    bodyString,
    date: new Date().toUTCString()
  }).headers;
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(`https://www.soliscloud.com:13333${resource}`, {
        method: 'POST', headers: attempt ? signSolisRequest({
          apiId: process.env.SOLIS_API_ID,
          apiSecret: process.env.SOLIS_API_SECRET,
          path: resource, bodyString, date: new Date().toUTCString()
        }).headers : headers,
        body: bodyString, signal: AbortSignal.timeout(15000)
      });
      break;
    } catch (error) {
      if (attempt) throw new Error(`Transport failed twice (${error.name}).`);
    }
  }
  const parsed = await response.json();
  if (!response.ok || String(parsed.code) !== '0') throw new Error(`Paging call failed: HTTP ${response.status}, API code ${String(parsed.code)}.`);
  return parsed.data;
}

const first = await request({ pageNo: 1 });
const second = await request({ pageNo: 2 });
const a = first.records ?? [];
const b = second.records ?? [];
if (a.length < 2 || a[1].id == null) throw new Error('First page did not contain two records with IDs.');
const cursor = await request({ minId: Number(a[a.length - 1].id) + 1 });
const c = cursor.records ?? [];
const fingerprints = (records) => records.map((record) => `${record.alarmDeviceSn}|${record.alarmCode}|${record.alarmBeginTime}`);
const overlap = (left, right) => fingerprints(left).filter((key) => fingerprints(right).includes(key)).length;
console.log(JSON.stringify({
  first: { count: a.length, total: first.total, current: first.current, pages: first.pages },
  pageNo2: { count: b.length, total: second.total, current: second.current, pages: second.pages, overlapWithFirst: overlap(a, b) },
  minId: { count: c.length, total: cursor.total, current: cursor.current, pages: cursor.pages, overlapWithFirst: overlap(a, c), sameRecordsAsPageNo2: JSON.stringify(fingerprints(c)) === JSON.stringify(fingerprints(b)) },
  recordIdUniqueOnFirstPage: a[0].id !== a[1].id,
  firstPageBeginTimeDescending: Number(a[0].alarmBeginTime) > Number(a[1].alarmBeginTime)
}, null, 2));
