import { TodayTile } from './TodayTile.jsx';
import { LiveGauge } from './LiveGauge.jsx';

export function LiveRow({ live, targetKwh, maxKw, now, loading }) {
  return (
    <section className="v3-liverow" aria-label="Today and live">
      <TodayTile live={live} targetKwh={targetKwh} now={now} loading={loading} />
      <LiveGauge live={live} maxKw={maxKw} loading={loading} />
    </section>
  );
}
