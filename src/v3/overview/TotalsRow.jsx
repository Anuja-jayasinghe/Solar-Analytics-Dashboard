import { Glass } from '../ui/Glass.jsx';
import { Info } from '../ui/Info.jsx';
import { CountText } from '../ui/Motion.jsx';
import { DASH, energyCompact, fmtNum, lifetimeGeneration, longDate, lkrCompact, monthsBetween, openPeriodSoFar, openPeriodView, shortDate } from './format.js';

const MONTH_NAMES = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };

function Tile({ label, short, value, unit, sub, info, loading, order = 0 }) {
  return (
    <Glass className="v3-kpi" aria-label={label}>
      <div className="v3-kpi-label"><span className="v3-long">{label}</span><span className="v3-short">{short ?? label}</span>{info && <Info label={`About ${label.toLowerCase()}`} {...info} />}</div>
      {loading ? (
        <div className="v3-skeleton" style={{ height: 30, width: '70%' }} aria-busy="true" aria-label="Loading" />
      ) : (
        <div className="v3-num v3-kpi-value"><CountText text={value} delay={order * 80} />{unit ? <span className="v3-kpi-unit">{unit}</span> : null}</div>
      )}
      <div className="v3-kpi-sub">{loading ? ' ' : sub}</div>
    </Glass>
  );
}

/**
 * The three headline tiles: the open billing period, all-time generation, all-time earnings.
 * Every figure is null-safe: while loading a skeleton, when unknown a dash, never a made-up 0.
 */
export function TotalsRow({ totals, live, todayKey, loading }) {
  const gen = totals?.generation;
  const view = openPeriodView(totals?.openPeriod);
  const open = openPeriodSoFar(view, live, gen ? gen.lastDay : undefined, todayKey);
  const start = view?.startKey ?? null;
  const reports = view?.month ? `${MONTH_NAMES[view.month] ?? view.month}${view.year ? ` ${view.year}` : ''}` : null;
  const earn = totals?.earnings;

  const lastBill = totals?.openPeriod?.lastBillDate;
  // Only what the tile does not already say: why it starts where it does, and which bill will report it.
  const periodInfo = open
    ? {
        title: 'Bill date to bill date',
        text: `Starts the day after the latest CEB bill${lastBill ? ` (${shortDate(lastBill)})` : ''}.${reports ? ` The next bill reports it as ${reports}.` : ''} ${open.daysPresent ?? DASH} of ${open.daysInPeriod ?? DASH} days have a reading${open.includesToday ? ', today from the live reading' : ''}.`
      }
    : null;
  const period = {
    value: open ? fmtNum(open.kwh) : DASH,
    sub: open ? `since ${shortDate(start)}${open.includesToday ? ' · incl. today' : ''} · awaiting bill` : 'no open period'
  };

  const life = lifetimeGeneration(live, totals);
  const energy = energyCompact(life.kwh);
  const months = gen?.firstDay ? monthsBetween(gen.firstDay, todayKey ?? gen.lastDay) : null;
  const genInfo = life.kwh == null
    ? null
    : life.source === 'counter'
      ? {
          title: "From the inverter's own counter",
          text: `The daily records hold ${fmtNum(gen?.totalKwh)} kWh over ${fmtNum(gen?.dayCount)} days since ${longDate(gen?.firstDay)}. The rest is generation before records began, days with no record${gen?.missingDays ? ` (${gen.missingDays})` : ''}, and today.`
        }
      : gen.missingDays
        ? { title: 'Recorded days only', text: `${gen.missingDays} day${gen.missingDays === 1 ? '' : 's'} since ${longDate(gen.firstDay)} have no reading and are not counted as zero.` }
        : null;

  const money = lkrCompact(earn?.totalLkr ?? null);
  const avgBill = lkrCompact(earn?.billCount ? earn.totalLkr / earn.billCount : null);
  const earnInfo = earn?.billsWithoutEarnings
    ? { title: `${earn.billsWithoutEarnings} bill${earn.billsWithoutEarnings === 1 ? '' : 's'} left out`, text: `No earnings figure yet. The total is the other ${earn.billCount} bills, about ${avgBill.value}${avgBill.unit} each.` }
    : null;

  return (
    <section className="v3-kpis" aria-label="Totals">
      <Tile label="This billing period" short="This period" value={period.value} unit="kWh" sub={period.sub} info={periodInfo} loading={loading} />
      <Tile
        label="All-time generation"
        short="All-time gen"
        value={energy.value}
        unit={energy.unit}
        order={1}
        sub={life.source === 'counter' ? `inverter lifetime counter${months ? ` · ${months} months of records` : ''}` : gen?.firstDay ? `since ${longDate(gen.firstDay)}${months ? ` · ${months} months` : ''}` : 'no data yet'}
        info={genInfo}
        loading={loading}
      />
      <Tile
        label="All-time earnings"
        short="All-time earned"
        value={money.value}
        unit={money.unit}
        order={2}
        sub={earn?.billCount ? `from ${earn.billCount} CEB bills${months ? ` · ${monthsBetween(earn.firstBillDate, earn.lastBillDate) ?? months} months` : ''}` : 'no bills yet'}
        info={earnInfo}
        loading={loading}
      />
    </section>
  );
}
