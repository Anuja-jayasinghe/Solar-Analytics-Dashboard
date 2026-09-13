#!/usr/bin/env node
//
// scripts/prune-orphaned-bill-files.mjs
//
// Remove objects from the `ceb_bills` bucket that no ingestion row references.
//
// ============================================================================
// WHY THIS IS NOT A ONE-LINER
// ============================================================================
// "Unreferenced" is not the same as "disposable". A file with no ingestion row
// might be a bill whose row was deleted by mistake — deleting it would destroy
// the only copy. So being unreferenced is necessary but NOT sufficient.
//
// This script deletes an object only when its SHA-256 matches the
// `file_sha256` of an ingestion we keep, i.e. the exact bytes are provably
// still held elsewhere. Anything unreferenced whose content is NOT otherwise
// held is reported and left alone, for a human to look at.
//
// The 19 files this was written for came from a single 15-minute window on
// 2026-04-23 (refs 433-452) — the same two documents uploaded repeatedly while
// the ingestion pipeline was being developed. They are real bills, carrying the
// account holder's name, address and phone number, which is why leaving them in
// storage indefinitely is not the better option.
//
// ============================================================================
// USAGE
// ============================================================================
//   node scripts/prune-orphaned-bill-files.mjs            # dry run (default)
//   node scripts/prune-orphaned-bill-files.mjs --apply    # actually delete
//
// Dry run is the default deliberately, matching the Backfill workflow. Read the
// dry-run output before passing --apply.
//
// Requires SUPABASE_URL and the service_role key in .env — listing and deleting
// storage objects is not something the anon key may do.

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const BUCKET = 'ceb_bills';
const APPLY = process.argv.includes('--apply');

function loadEnv() {
  let raw;
  try {
    raw = readFileSync('.env', 'utf8');
  } catch {
    console.error('No .env found. Run this from the repository root.');
    process.exit(1);
  }
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

// Guard against the mistake this project has made twice: an anon key where a
// service_role key belongs. Storage listing would come back empty rather than
// erroring, and an empty listing here reads as "nothing to do" — a silent no-op
// that looks exactly like success.
function roleOf(k) {
  if (k.startsWith('sb_secret_')) return 'service_role';
  if (k.startsWith('sb_publishable_')) return 'anon';
  const parts = k.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString())?.role ?? null;
  } catch {
    return null;
  }
}

const role = roleOf(key);
if (role && role !== 'service_role') {
  console.error(`Key in .env carries role "${role}", not service_role. Refusing to run:`);
  console.error('an anon key lists zero objects, which would look like "nothing to prune".');
  process.exit(1);
}

const supabase = createClient(url, key);

/** Storage list() is per-prefix and non-recursive; walk the tree. */
async function listAll(prefix = '', acc = []) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list("${prefix}") failed: ${error.message}`);
  for (const item of data) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // A null id marks a folder placeholder rather than a real object.
    if (item.id === null) await listAll(full, acc);
    else acc.push(full);
  }
  return acc;
}

const { data: kept, error: keptErr } = await supabase
  .from('ceb_bill_ingestions')
  .select('file_path, file_sha256');
if (keptErr) throw new Error(`could not read ingestions: ${keptErr.message}`);

const keptPaths = new Set(kept.map((r) => r.file_path));
const keptHashes = new Set(kept.map((r) => r.file_sha256).filter(Boolean));

const all = await listAll();
const unreferenced = all.filter((p) => !keptPaths.has(p));

console.log(`mode             : ${APPLY ? 'APPLY — will delete' : 'dry run'}`);
console.log(`ingestion rows   : ${kept.length}`);
console.log(`objects in bucket: ${all.length}`);
console.log(`unreferenced     : ${unreferenced.length}\n`);

if (unreferenced.length === 0) {
  console.log('Nothing unreferenced. Bucket and ingestion rows already agree.');
  process.exit(0);
}

const duplicates = [];
const unexplained = [];

for (const path of unreferenced) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) {
    unexplained.push({ path, why: `could not download: ${error.message}` });
    continue;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (keptHashes.has(sha)) duplicates.push({ path, sha, bytes: bytes.length });
  else unexplained.push({ path, why: 'content not held by any kept ingestion', sha });
}

console.log(`proven duplicates      : ${duplicates.length}`);
console.log(`content not held here  : ${unexplained.length}\n`);

for (const u of unexplained) console.log(`  LEAVING  ${u.path}\n           ${u.why}`);
if (unexplained.length) console.log('');

if (!APPLY) {
  console.log('Would delete:');
  for (const d of duplicates) {
    console.log(`  ${d.path.split('/').pop()}  (${(d.bytes / 1024).toFixed(1)} KB)`);
  }
  const freed = duplicates.reduce((n, d) => n + d.bytes, 0);
  console.log(`\n${duplicates.length} objects, ${(freed / 1024 / 1024).toFixed(1)} MB`);
  console.log('\nDry run — nothing deleted. Re-run with --apply to proceed.');
  process.exit(0);
}

if (duplicates.length === 0) {
  console.log('No provable duplicates. Nothing deleted.');
  process.exit(0);
}

const { data: removed, error: rmErr } = await supabase.storage
  .from(BUCKET)
  .remove(duplicates.map((d) => d.path));

if (rmErr) {
  console.error(`\nDelete failed: ${rmErr.message}`);
  process.exit(1);
}

console.log(`Deleted ${removed.length} objects.`);

const after = await listAll();
console.log(`\nbucket now holds : ${after.length} objects`);
console.log(`ingestion rows   : ${kept.length}`);
console.log(
  after.length === kept.length + unexplained.length
    ? 'Reconciled: every remaining object is either referenced or was deliberately left.'
    : `UNEXPECTED: ${after.length} objects remain; expected ${kept.length + unexplained.length}.`
);
