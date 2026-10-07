import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { DASH, energyCompact, fmtNum, lifetimeGeneration, longDate, lkrCompact, monthsBetween, openBillPeriod, openPeriodSoFar, shortDate } from './format.js';

function Tile({ label, short, value, unit, sub, tip, loading }) {
  return (
    <Tip text={tip}>
      <Glass className="v3-kpi" aria-label={label}>
        <div className="v3-kpi-label"><span className="v3-long">{label}</span><span className="v3-short">{short ?? label}</span></div>
        {loading ? (
          <div className="v3-skeleton" style={{ height: 30, width: '70%' }} aria-busy="true" aria-label="Loading" />
        ) : (
          <div className="v3-num v3-kpi-value">{value}{unit ? <span className="v3-kpi-unit">{unit}</span> : null}</div>
        )}
        <div className="v3-kpi-sub">{loading ? ' ' : sub}</div>
      </Glass>
    </Tip>
  );
}

/**
 * The three headline tiles: the open billing period, all-time generation, all-time earnings.
 * Every figure is null-safe: while loading a skeleton, when unknown a dash, never a made-up 0.
 */
export function TotalsRow({ totals, comparison, live, todayKey, loading }) {
  const gen = totals?.generation;
  const open = openPeriodSoFar(openBillPeriod(comparison?.rows), live, gen ? gen.lastDay : undefined, todayKey);
  const start = openBillPeriod(comparison?.rows)?.startKey ?? null;
  const earn = totals?.earnings;

  const periodTip = open
    ? `Billing period ${shortDate(start)} to today${open.includesToday ? ', including today so far from the live reading' : ''}. Generation is known for ${open.daysPresent ?? DASH} of ${open.daysInPeriod ?? DASH} days; the CEB bill for this period has not been issued yet.`
    : 'There is no open billing period right now: the latest bill covers everything up to today.';
  const period = {
    value: open ? fmtNum(open.kwh) : DASH,
    sub: open ? `since ${shortDate(start)}${open.includesToday ? ' · incl. today' : ''} · awaiting bill` : 'no open period'
  };

  const life = lifetimeGeneration(live, totals);
  const energy = energyCompact(life.kwh);
  const months = gen?.firstDay ? monthsBetween(gen.firstDay, todayKey ?? gen.lastDay) : null;
  const genTip = life.kwh == null
    ? 'No generation has been recorded yet.'
    : life.source === 'counter'
      ? `${fmtNum(life.kwh)} kWh on the inverter's own lifetime counter. The daily records hold ${fmtNum(gen?.totalKwh)} kWh over ${fmtNum(gen?.dayCount)} days since ${longDate(gen?.firstDay)}; the difference is generation before records began, days with no record${gen?.missingDays ? ` (${gen.missingDays})` : ''}, and today.`
      : `${fmtNum(life.kwh)} kWh over ${fmtNum(gen.dayCount)} recorded days since ${longDate(gen.firstDay)}.${gen.missingDays ? ` ${gen.missingDays} day${gen.missingDays === 1 ? '' : 's'} in that span have no reading and are not counted as zero.` : ''}`;

  const money = lkrCompact(earn?.totalLkr ?? null);
  const avgBill = lkrCompact(earn?.billCount ? earn.totalLkr / earn.billCount : null);
  const earnTip = earn?.totalLkr == null
    ? 'No bill with an earnings figure yet.'
    : `Sum of ${earn.billCount} CEB bills (${longDate(earn.firstBillDate)} to ${longDate(earn.lastBillDate)}), about ${avgBill.value}${avgBill.unit} per bill.${earn.billsWithoutEarnings ? ` ${earn.billsWithoutEarnings} bill(s) have no earnings figure and are left out.` : ''}`;

  return (
    <section className="v3-kpis" aria-label="Totals">
      <Tile label="This billing period" short="This period" value={period.value} unit="kWh" sub={period.sub} tip={periodTip} loading={loading} />
      <Tile
        label="All-time generation"
        short="All-time gen"
        value={energy.value}
        unit={energy.unit}
        sub={life.source === 'counter' ? `inverter lifetime counter${months ? ` · ${months} months of records` : ''}` : gen?.firstDay ? `since ${longDate(gen.firstDay)}${months ? ` · ${months} months` : ''}` : 'no data yet'}
        tip={genTip}
        loading={loading}
      />
      <Tile
        label="All-time earnings"
        short="All-time earned"
        value={money.value}
        unit={money.unit}
        sub={earn?.billCount ? `from ${earn.billCount} CEB bills${months ? ` · ${monthsBetween(earn.firstBillDate, earn.lastBillDate) ?? months} months` : ''}` : 'no bills yet'}
        tip={earnTip}
        loading={loading}
      />
    </section>
  );
}
