// scripts/migrate-roles.mjs
//
// One-off: move users from the legacy `publicMetadata.dashboardAccess === 'real'` flag to
// `publicMetadata.role = 'viewer'` (decision D-3, issue #158). Plan logic is
// shared/domain/access.js planRoleMigration (tested).
//
//   node scripts/migrate-roles.mjs           DRY RUN: lists what would change, writes nothing
//   node scripts/migrate-roles.mjs --write   applies the plan to Clerk
//
// Safe by construction:
//   * dry run is the default;
//   * only users with NO role who hold the legacy "real" flag are changed;
//   * the legacy flag is left in place, so the change is reversible with one PATCH;
//   * emails are masked in output (this log may end up in CI or a terminal recording).
//
// Needs CLERK_SECRET_KEY.

import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';
import { planRoleMigration } from '../shared/domain/access.js';

const WRITE = process.argv.includes('--write');
const key = process.env.CLERK_SECRET_KEY;
if (!key) {
  console.error('CLERK_SECRET_KEY is required');
  process.exit(1);
}

const mask = (email) => {
  if (!email) return '(no email)';
  const [u, d] = email.split('@');
  return `${u.slice(0, 1)}***@${d ?? '?'}`;
};

const clerk = createClerkClient({ secretKey: key });

async function listAllUsers() {
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const page = await clerk.users.getUserList({ limit: 100, offset, orderBy: '-created_at' });
    all.push(...page.data);
    if (page.data.length < 100) return all;
    if (offset > 5000) throw new Error('refusing to page past 5000 users');
  }
}

const users = await listAllUsers();
const plan = planRoleMigration(users);
const byId = new Map(users.map((u) => [u.id, u]));

const tally = users.reduce((m, u) => {
  const r = u.publicMetadata?.role ?? '(none)';
  m[r] = (m[r] ?? 0) + 1;
  return m;
}, {});
console.log(`mode=${WRITE ? 'WRITE' : 'DRY RUN'} users=${users.length} roles=${JSON.stringify(tally)}`);
console.log(`users with the legacy "real" flag and no role: ${plan.length}`);
for (const c of plan) {
  const u = byId.get(c.id);
  console.log(`  ${c.id}  ${mask(u.emailAddresses?.[0]?.emailAddress)}  role ${c.from ?? '(none)'} → ${c.to}`);
}

if (!WRITE) {
  console.log('\nDry run: nothing was changed. Re-run with --write to apply.');
  process.exit(0);
}

let ok = 0;
for (const c of plan) {
  const u = byId.get(c.id);
  await clerk.users.updateUser(c.id, { publicMetadata: { ...u.publicMetadata, role: c.to } });
  ok++;
}
console.log(`\nApplied ${ok}/${plan.length} changes.`);
if (ok !== plan.length) process.exit(1);
