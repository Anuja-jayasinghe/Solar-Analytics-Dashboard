// scripts/check_missing_bill.js
// Fails when the monthly CEB (EDL) bill is overdue: LR-005 rule 9 (shared/domain/billSchedule.js).
//
// Once bills arrive by email, a broken Gmail filter or a changed sender address stops them silently.
// The Data Freshness Check workflow runs this daily and opens a `missing-bill` issue (which emails the
// owner) when it fails. It reads only: the recent bill dates, and how many uploads still wait for review.
//
// Usage:
//   node scripts/check_missing_bill.js
//
// Exit codes:
//   0  the next bill is not overdue (or a bill is waiting for review, or there is too little history)
//   1  the bill is overdue, or the check could not run

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { exitOnServiceKeyProblem } from '../api/_lib/serviceKeyGuard.js';
import { evaluateBillArrival, BILL_GAPS_USED } from '../shared/domain/billSchedule.js';
import { localDateKey } from '../shared/domain/time.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase env vars SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
exitOnServiceKeyProblem(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const bills = await supabase
    .from('ceb_data')
    .select('bill_date')
    .order('bill_date', { ascending: false })
    .limit(BILL_GAPS_USED + 1);
  if (bills.error) throw new Error(`ceb_data query failed: ${bills.error.message}`);

  const billDates = (bills.data ?? []).map((r) => r.bill_date);
  const latest = billDates[0] ?? null;

  // Uploads received since the latest bill that are not approved yet: the bill arrived, a person
  // just has not approved it. That is not a missing bill.
  let pendingIngestions = 0;
  if (latest) {
    const pending = await supabase
      .from('ceb_bill_ingestions')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'approved')
      .gte('received_at', `${latest}T00:00:00+05:30`);
    if (pending.error) throw new Error(`ceb_bill_ingestions query failed: ${pending.error.message}`);
    pendingIngestions = pending.count ?? 0;
  }

  const r = evaluateBillArrival({ billDates, pendingIngestions, todayKey: localDateKey(Date.now()) });

  console.log('CEB BILL ARRIVAL CHECK');
  console.log(`${r.skipped ? '⏸️ ' : r.ok ? '✅' : '❌'} ${r.name}${r.skipped ? '  (skipped)' : ''}`);
  if (r.latest) console.log(`   Latest bill  : ${r.latest}`);
  if (r.intervalDays) console.log(`   Interval     : ~${r.intervalDays} days (median of recent gaps)`);
  if (r.expected) console.log(`   Expected     : ${r.expected}`);
  if (r.alertAfter) console.log(`   Alert after  : ${r.alertAfter}`);
  if (r.reason) console.log(`   ${r.ok ? 'Note' : 'Problem'}      : ${r.reason}`);

  if (!r.ok) {
    console.log('');
    console.log('Check, in this order:');
    console.log('  1. Did the bill email arrive in Gmail at all (from eBill@edl.lk)? If not, EDL is late: wait, or ask EDL.');
    console.log('  2. Was it forwarded? Gmail → Settings → Forwarding: the forward can be paused if the address bounced.');
    console.log('  3. Did the filter match? The subject should end with the solar account number.');
    console.log('  4. Did the sender change? If so, update the Gmail filter and BILL_SENDER_DOMAINS.');
    console.log('  5. Meanwhile, upload the bill by hand on the Admin page.');
  }
  process.exit(r.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('💥 Bill arrival check crashed:', err?.message || err);
  process.exit(1);
});
