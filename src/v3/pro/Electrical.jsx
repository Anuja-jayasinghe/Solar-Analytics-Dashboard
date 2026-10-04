import { Glass } from '../ui/Glass.jsx';
import { Tip } from '../ui/Tip.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Note } from '../ui/Note.jsx';
import { areaPath, smoothPath, xPct } from '../charts/scale.js';
import { fmtNum, longDate } from '../overview/format.js';

/** One day of electrical health, from the producing 5-minute points. */
export function Electrical({ e, date, loading, error }) {
  const temps = e?.temperature ?? [];
  const tVals = temps.map((t) => t.max);
  const tLo = tVals.length ? Math.floor(Math.min(...tVals) / 5) * 5 - 5 : 0;
  const tHi = tVals.length ? Math.ceil(Math.max(...tVals) / 5) * 5 + 5 : 1;
  const tPts = temps.map((t, i) => [xPct(i, temps.length), 100 - ((t.max - tLo) / (tHi - tLo)) * 100]);
  const tLine = smoothPath(tPts);
  const maxA = e ? Math.max(...e.strings.map((s) => s.amps ?? 0), 0.0001) : 1;
  const freq = e?.frequency ?? [];
  const fy = (v) => 50 - (v - 50) * 68; // the panel shows 49.3 to 50.7 Hz

  return (
    <Glass card aria-label="Electrical health">
      <div className="v3-tilehead">
        <div>
          <h2 className="v3-h2">Electrical health</h2>
          <div className="v3-sub">Latest full day{date ? ` · ${longDate(date)}` : ''} · while producing</div>
        </div>
        {e && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Pill>Grid {e.gridVolts === null ? '—' : fmtNum(e.gridVolts)} V</Pill>
            <Pill>Power factor {e.powerFactor === null ? '—' : fmtNum(e.powerFactor, 2)}</Pill>
          </div>
        )}
      </div>
      {error && <Note tone="bad">Could not load telemetry ({error.code ?? 'error'}).</Note>}
      {loading && !e && <div className="v3-skeleton" style={{ height: 170 }} aria-busy="true" aria-label="Loading" />}
      {!loading && !error && !e && <Note>No producing readings were recorded on this day, so nothing is drawn.</Note>}
      {e && (
        <div className="v3-elec">
          <div className="v3-elec-col">
            <div className="v3-elec-title">String balance <span>· average current</span></div>
            {e.strings.map((s) => {
              const low = s.deviationPct !== null && s.deviationPct < -8;
              return (
                <Tip key={s.n} text={`String ${s.n}: ${s.amps === null ? 'no reading' : `${fmtNum(s.amps, 1)} A`}${s.volts === null ? '' : ` at about ${fmtNum(s.volts)} V`}${s.deviationPct === null ? '' : ` · ${s.deviationPct >= 0 ? '+' : '−'}${Math.abs(s.deviationPct).toFixed(1)}% vs the average`}`}>
                  <div className="v3-strrow">
                    <span>S{s.n}</span>
                    <div className="v3-barbg"><div style={{ width: `${s.amps === null ? 0 : (s.amps / maxA) * 100}%`, background: low ? 'var(--warn)' : 'var(--gen)' }} /></div>
                    <b className="v3-num">{s.amps === null ? '—' : `${fmtNum(s.amps, 1)} A`}</b>
                  </div>
                </Tip>
              );
            })}
            <div className="v3-sub" style={{ margin: 0 }}>{e.lowStrings.length ? `String ${e.lowStrings.join(', ')} ${e.lowStrings.length === 1 ? 'is' : 'are'} more than 8% below the average: worth a look.` : 'All strings within 8% of the average.'}</div>
          </div>

          <div className="v3-elec-col">
            <div className="v3-elec-title">Inverter temperature <span>· hourly max, °C</span></div>
            {temps.length === 0 ? <Note>No temperature readings.</Note> : (
              <>
                <div className="v3-miniplot">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d={areaPath(tPts)} fill="url(#areaFill)" />
                    <path d={tLine} fill="none" style={{ stroke: 'var(--gen)' }} strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span className="v3-mini-hi">{fmtNum(tHi)}</span><span className="v3-mini-lo">{fmtNum(tLo)}</span>
                  <div className="v3-cols">{temps.map((t, i) => <Tip key={t.hour}><div className="v3-col"><span className="v3-dot" style={{ bottom: `${100 - tPts[i][1]}%`, background: 'var(--gen)', width: 7, height: 7 }} /><span className="v3-val v3-val-pt" style={{ bottom: `calc(${100 - tPts[i][1]}% + 7px)` }}>{Math.round(t.max)}</span></div></Tip>)}</div>
                </div>
                <div className="v3-xlabels" style={{ gap: 0 }}>{temps.map((t) => <div key={t.hour} className="v3-xlabel v3-xplain">{t.hour}</div>)}</div>
              </>
            )}
          </div>

          <div className="v3-elec-col">
            <div className="v3-elec-title">Grid frequency <span>· hourly range, Hz</span></div>
            {freq.length === 0 ? <Note>No frequency readings.</Note> : (
              <>
                <div className="v3-miniplot">
                  <div className="v3-freqband" />
                  <div className="v3-freqmid" />
                  <span className="v3-freq-label" style={{ top: '16%' }}>50.5</span>
                  <span className="v3-freq-label" style={{ top: '50%' }}>50.0 nominal</span>
                  <span className="v3-freq-label" style={{ bottom: '16%', top: 'auto' }}>49.5</span>
                  <div className="v3-cols">
                    {freq.map((f) => {
                      const top = Math.max(0, fy(f.hi));
                      const h = Math.max(4, Math.min(100, fy(f.lo)) - top);
                      return (
                        <Tip key={f.hour} text={`${f.hour}:00 to ${f.hour + 1}:00 · ${fmtNum(f.lo, 2)} to ${fmtNum(f.hi, 2)} Hz`}>
                          <div className="v3-col" style={{ padding: 0 }}><div className="v3-freqbar" style={{ top: `${top}%`, height: `${h}%` }} /></div>
                        </Tip>
                      );
                    })}
                  </div>
                </div>
                <div className="v3-xlabels" style={{ gap: 0 }}>{freq.map((f) => <div key={f.hour} className="v3-xlabel v3-xplain">{f.hour}</div>)}</div>
                <div className="v3-sub" style={{ margin: 0 }}>Shaded band is 50 Hz ± 0.5 for reference.</div>
              </>
            )}
          </div>
        </div>
      )}
    </Glass>
  );
}
