import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Portal } from './Portal.jsx';
import { useFloating } from './useFloating.js';
import { WEEKDAYS, addMonths, clampKey, monthGrid, monthOf, monthTitle, moveFocus, orderRange, outOfBounds, shortLabel } from './calendar.js';

/** One month of days. `isSelected`/`inRange` decide the look; picking calls onPick(key). Arrow keys move, Enter picks. */
function Month({ ym, onMonth, min, max, focusKey, setFocusKey, onPick, isSelected, inRange, onHover }) {
  const gridRef = useRef(null);
  useEffect(() => {
    const el = gridRef.current?.querySelector(`[data-key="${focusKey}"]`);
    if (el && gridRef.current.contains(document.activeElement)) el.focus();
  }, [focusKey]);
  const onKeyDown = (e) => {
    const next = moveFocus(focusKey, e.key);
    if (!next) return;
    e.preventDefault();
    const k = clampKey(next, min, max);
    setFocusKey(k);
    if (monthOf(k) !== ym) onMonth(monthOf(k));
  };
  const canBack = !min || addMonths(ym, -1) >= monthOf(min);
  const canFwd = !max || addMonths(ym, 1) <= monthOf(max);
  return (
    <div className="v3-cal-month">
      <div className="v3-cal-head">
        <button type="button" className="v3-iconbtn sm" disabled={!canBack} onClick={() => onMonth(addMonths(ym, -1))} aria-label="Previous month"><ChevronLeft size={15} /></button>
        <b aria-live="polite">{monthTitle(ym)}</b>
        <button type="button" className="v3-iconbtn sm" disabled={!canFwd} onClick={() => onMonth(addMonths(ym, 1))} aria-label="Next month"><ChevronRight size={15} /></button>
      </div>
      <div className="v3-cal-grid" role="grid" aria-label={monthTitle(ym)} ref={gridRef} onKeyDown={onKeyDown} onPointerLeave={() => onHover?.(null)}>
        <div className="v3-cal-row" role="row">{WEEKDAYS.map((d) => <span key={d} role="columnheader" className="v3-cal-wd">{d}</span>)}</div>
        {monthGrid(ym).map((week) => (
          <div className="v3-cal-row" role="row" key={week[0].key}>
            {week.map((c) => {
              const off = outOfBounds(c.key, min, max);
              const sel = isSelected(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  role="gridcell"
                  data-key={c.key}
                  className="v3-cal-day"
                  data-out={!c.inMonth}
                  data-selected={sel}
                  data-range={inRange(c.key)}
                  disabled={off}
                  tabIndex={c.key === focusKey ? 0 : -1}
                  aria-selected={sel}
                  aria-label={shortLabel(c.key)}
                  onPointerEnter={() => onHover?.(c.key)}
                  onClick={() => { setFocusKey(c.key); onPick(c.key); }}
                >
                  {Number(c.key.slice(8, 10))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const floatRef = useRef(null);
  const pos = useFloating(anchorRef, floatRef, open, 'bottom', 6, 'start');
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (anchorRef.current?.contains(e.target) || floatRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); anchorRef.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, anchorRef, floatRef, pos };
}

const floatStyle = (pos) => (pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 });

/** A single day. */
export function DatePicker({ value, min, max, onChange, label = 'Day' }) {
  const p = usePopover();
  const [ym, setYm] = useState(monthOf(value ?? max ?? '2026-01-01'));
  const [focusKey, setFocusKey] = useState(value);
  useEffect(() => { if (value) { setYm(monthOf(value)); setFocusKey(value); } }, [value, p.open]);
  return (
    <>
      <button ref={p.anchorRef} type="button" className="v3-datebtn" aria-haspopup="dialog" aria-expanded={p.open} aria-label={`${label}: ${shortLabel(value)}`} onClick={() => p.setOpen((v) => !v)}>
        <CalendarDays size={15} aria-hidden="true" />
        <span>{value ? shortLabel(value) : 'Pick a day'}</span>
      </button>
      {p.open && (
        <Portal>
          <div ref={p.floatRef} className="v3-cal" role="dialog" aria-label={`Choose ${label.toLowerCase()}`} style={floatStyle(p.pos)}>
            <Month ym={ym} onMonth={setYm} min={min} max={max} focusKey={focusKey} setFocusKey={setFocusKey}
              isSelected={(k) => k === value} inRange={() => false}
              onPick={(k) => { onChange(k); p.setOpen(false); }} />
          </div>
        </Portal>
      )}
    </>
  );
}

/**
 * A range: first click picks the start, the second the end (with a live preview in between). Presets cover
 * the common cases. `maxDays` caps the range length (the caller also clamps).
 */
export function DateRangePicker({ from, to, min, max, onChange, presets = [] }) {
  const p = usePopover();
  const [ym, setYm] = useState(monthOf(to ?? max ?? '2026-01-01'));
  const [focusKey, setFocusKey] = useState(to);
  const [start, setStart] = useState(null); // set after the first click
  const [hover, setHover] = useState(null);
  useEffect(() => { if (p.open) { setYm(monthOf(to ?? max)); setFocusKey(to); setStart(null); setHover(null); } }, [p.open, to, max]);

  const preview = start ? orderRange(start, hover ?? start) : { from, to };
  const pick = (k) => {
    if (!start) { setStart(k); return; }
    const r = orderRange(start, k);
    onChange(r.from, r.to);
    p.setOpen(false);
  };
  return (
    <>
      <button ref={p.anchorRef} type="button" className="v3-datebtn" aria-haspopup="dialog" aria-expanded={p.open} aria-label={`Date range: ${shortLabel(from)} to ${shortLabel(to)}`} onClick={() => p.setOpen((v) => !v)}>
        <CalendarDays size={15} aria-hidden="true" />
        <span>{shortLabel(from)} – {shortLabel(to)}</span>
      </button>
      {p.open && (
        <Portal>
          <div ref={p.floatRef} className="v3-cal v3-cal-range" role="dialog" aria-label="Choose a date range" style={floatStyle(p.pos)}>
            {presets.length > 0 && (
              <div className="v3-cal-presets">
                {presets.map((pr) => (
                  <button key={pr.label} type="button" className="v3-cal-preset" onClick={() => { const r = pr.range(); onChange(r.from, r.to); p.setOpen(false); }}>{pr.label}</button>
                ))}
              </div>
            )}
            <div>
              <div className="v3-cal-hint" role="status">{start ? `From ${shortLabel(start)}: now pick the last day` : 'Pick the first day'}</div>
              <Month ym={ym} onMonth={setYm} min={min} max={max} focusKey={focusKey} setFocusKey={setFocusKey}
                isSelected={(k) => k === preview.from || k === preview.to}
                inRange={(k) => k > preview.from && k < preview.to}
                onHover={start ? setHover : undefined}
                onPick={pick} />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
