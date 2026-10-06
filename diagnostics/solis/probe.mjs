// Read-only, single-inverter SolisCloud contract probe.
// Raw responses stay in an explicitly chosen directory outside this checkout.

import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signSolisRequest } from '../../api/_lib/solisAuth.js';

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const BASE_URL = 'https://www.soliscloud.com:13333';
const READ_ONLY = new Set([
  'inverterList', 'inverterDetail', 'inverterDay', 'inverterMonth',
  'inverterYear', 'inverterAll', 'alarmList', 'collectorList',
  'collectorDetail', 'collector/day', 'userStationList', 'stationDetail',
  'stationMonth', 'stationYear', 'stationAll',
  'epmList', 'weatherList', 'ammeterList'
]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function options(argv) {
  const result = { mode: 'official', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') result.dryRun = true;
    else if (['--date', '--out', '--mode', '--only', '--identity-from'].includes(arg)) {
      result[arg === '--identity-from' ? 'identityFrom' : arg.slice(2)] = argv[++i];
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date ?? '') ||
      Number.isNaN(Date.parse(`${result.date}T12:00:00Z`))) {
    throw new Error('Pass --date YYYY-MM-DD (a completed local calendar day).');
  }
  if (!['official', 'repo'].includes(result.mode)) throw new Error('--mode must be official or repo.');
  if (result.only) {
    result.only = result.only.split(',').map((name) => name.trim());
    if (result.only.some((name) => !READ_ONLY.has(name))) throw new Error('--only contains an unapproved endpoint.');
  }
  if (!result.dryRun && !result.out) throw new Error('Pass --out /absolute/private/path outside the repo.');
  return result;
}

function outputDirectory(value) {
  if (!path.isAbsolute(value)) throw new Error('--out must be an absolute path.');
  const requested = path.resolve(value);
  if (requested === ROOT || requested.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error('Raw output must be outside the repository.');
  }
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  const target = fs.realpathSync(value);
  if (target === ROOT || target.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error('Raw output must be outside the repository.');
  }
  if (fs.readdirSync(target).length) throw new Error('Output directory must be empty.');
  fs.chmodSync(target, 0o700);
  return target;
}

function signedHeaders(resource, bodyString, mode) {
  const apiId = process.env.SOLIS_API_ID;
  const apiSecret = process.env.SOLIS_API_SECRET;
  if (!apiId || !apiSecret) throw new Error('SOLIS_API_ID and SOLIS_API_SECRET are required.');
  const date = new Date().toUTCString();
  const endpoint = `/v1/api/${resource}`;
  if (mode === 'repo') {
    return signSolisRequest({ apiId, apiSecret, path: endpoint, bodyString, date }).headers;
  }
  // Current Solis developer portal: MD5 of every raw JSON body, including {}, and
  // application/json;charset=UTF-8 in both the header and signature.
  const contentType = 'application/json;charset=UTF-8';
  const contentMd5 = createHash('md5').update(bodyString, 'utf8').digest('base64');
  const canonical = ['POST', contentMd5, contentType, date, endpoint].join('\n');
  const signature = createHmac('sha1', apiSecret).update(canonical, 'utf8').digest('base64');
  return {
    'Content-MD5': contentMd5,
    'Content-Type': contentType,
    Date: date,
    Authorization: `API ${apiId}:${signature}`
  };
}

function sampleFields(data) {
  const records = Array.isArray(data) ? data : data?.page?.records ?? data?.records;
  const sample = Array.isArray(records) ? records[0] : data;
  const fields = sample && typeof sample === 'object' && !Array.isArray(sample)
    ? Object.fromEntries(Object.entries(sample).map(([key, value]) => [key, value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value]))
    : {};
  return { records: Array.isArray(records) ? records.length : null, fields };
}

async function main() {
  const opts = options(process.argv.slice(2));
  const wanted = opts.only ? new Set(opts.identityFrom ? opts.only : ['inverterList', ...opts.only]) : READ_ONLY;
  const plan = [...wanted];
  if (opts.dryRun) {
    console.log(JSON.stringify({ date: opts.date, mode: opts.mode, endpoints: plan, callsMade: 0 }, null, 2));
    return;
  }
  const out = outputDirectory(opts.out);
  if (!process.env.SOLIS_API_ID || !process.env.SOLIS_API_SECRET) {
    throw new Error('Missing local Solis credentials; no API calls made.');
  }
  const summary = { date: opts.date, mode: opts.mode, checkedAt: new Date().toISOString(), calls: [] };
  let lastCall = 0;
  async function call(name, body, tag = name) {
    if (!READ_ONLY.has(name)) throw new Error(`Blocked endpoint: ${name}`);
    const wait = Math.max(0, 700 - (Date.now() - lastCall));
    if (wait) await delay(wait);
    lastCall = Date.now();
    const bodyString = JSON.stringify(body);
    const headers = signedHeaders(name, bodyString, opts.mode);
    let response;
    for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
      try {
        response = await fetch(`${BASE_URL}/v1/api/${name}`, {
          method: 'POST', headers: attemptNo === 1 ? headers : signedHeaders(name, bodyString, opts.mode),
          body: bodyString, signal: AbortSignal.timeout(15000)
        });
        break;
      } catch (error) {
        if (attemptNo === 2 || error.name !== 'TimeoutError') {
          summary.calls.push({ endpoint: name, tag, transportError: error.name });
          throw new Error(`${name}: transport failure (${error.name}).`);
        }
        await delay(1000);
      }
    }
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      summary.calls.push({ endpoint: name, tag, httpStatus: response.status, parseError: true });
      throw new Error(`${name}: non-JSON response (HTTP ${response.status}).`);
    }
    fs.writeFileSync(path.join(out, `${tag.replace(/[^\w.-]/g, '_')}.json`), JSON.stringify(parsed, null, 2), { mode: 0o600, flag: 'wx' });
    const shape = sampleFields(parsed.data);
    summary.calls.push({ endpoint: name, tag, httpStatus: response.status, code: String(parsed.code ?? ''), success: parsed.success === true, ...shape });
    console.log(`${tag}: HTTP ${response.status}, API code ${String(parsed.code ?? 'missing')}, records ${shape.records ?? 'n/a'}`);
    if (!response.ok || String(parsed.code) !== '0') throw new Error(`${name}: API call failed; inspect private output.`);
    return parsed.data;
  }
  async function attempt(name, body) {
    if (!wanted.has(name)) return null;
    try { return await call(name, body); }
    catch (error) {
      console.error(`${name}: recorded failure; continuing with independent endpoints.`);
      summary.calls.push({ endpoint: name, failure: error.message });
      return null;
    }
  }

  try {
    let inverters;
    if (opts.identityFrom) {
      const identityPath = fs.realpathSync(opts.identityFrom);
      if (identityPath === ROOT || identityPath.startsWith(`${ROOT}${path.sep}`)) {
        throw new Error('--identity-from must be a private file outside the repository.');
      }
      const previous = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      inverters = previous?.data?.page?.records ?? previous?.data?.records ?? [];
    } else {
      const list = await call('inverterList', { pageSize: 100 });
      inverters = list?.page?.records ?? list?.records ?? [];
    }
    const selected = process.env.SOLIS_INVERTER_SN
      ? inverters.find((inv) => inv.sn === process.env.SOLIS_INVERTER_SN)
      : inverters.length === 1 ? inverters[0] : null;
    if (!selected) throw new Error('Could not select exactly one inverter; set SOLIS_INVERTER_SN locally.');
    const sn = selected.sn;
    const stationId = selected.stationId;
    const collectorSn = selected.collectorSn;
    const month = opts.date.slice(0, 7);
    const year = opts.date.slice(0, 4);
    // The 2026-10-03 probe found that timeZone=8 selected the requested Sri Lanka
    // local date; Phase 3 will test this behavior explicitly.
    const daily = { sn, money: 'LKR', time: opts.date, timeZone: 8 };
    await attempt('inverterDetail', { sn });
    await attempt('inverterDay', daily);
    await attempt('inverterMonth', { sn, money: 'LKR', month, timeZone: 8 });
    await attempt('inverterYear', { sn, money: 'LKR', year });
    await attempt('inverterAll', { sn, money: 'LKR' });
    await attempt('alarmList', { stationId, alarmDeviceSn: sn, alarmBeginTime: `${month}-01`, alarmEndTime: opts.date, pageSize: 100 });
    await attempt('collectorList', { pageSize: 100 });
    if (collectorSn) {
      await attempt('collectorDetail', { sn: collectorSn });
      await attempt('collector/day', { sn: collectorSn, time: opts.date, timeZone: 8 });
    }
    await attempt('userStationList', { pageSize: 100 });
    if (stationId) await attempt('stationDetail', { id: stationId });
    if (stationId) {
      await attempt('stationMonth', { id: stationId, money: 'LKR', month, timeZone: 8 });
      await attempt('stationYear', { id: stationId, money: 'LKR', year, timeZone: 8 });
      await attempt('stationAll', { id: stationId, money: 'LKR', timeZone: 8 });
    }
    for (const name of ['epmList', 'weatherList', 'ammeterList']) await attempt(name, { pageSize: 100 });
  } finally {
    fs.writeFileSync(path.join(out, '_summary.json'), JSON.stringify(summary, null, 2), { mode: 0o600, flag: 'wx' });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
