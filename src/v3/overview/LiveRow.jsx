import { TodayTile } from './TodayTile.jsx';
import { LiveGauge } from './LiveGauge.jsx';

export function LiveRow({ live, liveError = null, peak = null, targetKwh, maxKw, now, loading }) {
  return (
    <section className="v3-liverow" aria-label="Today and live">
      <TodayTile live={live} peak={peak} targetKwh={targetKwh} now={now} loading={loading} />
      <LiveGauge live={live} error={liveError} maxKw={maxKw} peak={peak} loading={loading} />
    </section>
  );
}
