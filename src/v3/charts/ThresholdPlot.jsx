import { useEffect, useRef, useState } from 'react';
import { valueFromPointer, clamp } from './scale.js';

/** True on mouse/trackpad devices. On touch, dragging inside the plot would block page scrolling, so only the handle drags. */
function useFinePointer() {
  const [fine, setFine] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(pointer: fine)');
    const on = () => setFine(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return fine;
}

/**
 * A plot area (0..max on the vertical axis) with the "Mark above" line. The line can be set three ways:
 * type a number elsewhere, drag the handle (any device), or click/drag anywhere in the plot (mouse only).
 * The handle is a keyboard slider too. Children are drawn inside the plot, under the line.
 */
export function ThresholdPlot({ max, value, step = 1, unit = '', label = 'Mark above', height, onChange, children }) {
  const fine = useFinePointer();
  const plotRef = useRef(null);
  const dragging = useRef(false);

  const fromEvent = (e, el) => {
    const r = el.getBoundingClientRect();
    return valueFromPointer(e.clientY, r.top, r.height, max, step);
  };
  const set = (v) => { if (v !== null && v !== undefined) onChange(v); };

  const plotHandlers = fine
    ? {
        onPointerDown: (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); set(fromEvent(e, e.currentTarget)); },
        onPointerMove: (e) => { if (dragging.current) set(fromEvent(e, e.currentTarget)); },
        onPointerUp: () => { dragging.current = false; },
        onPointerCancel: () => { dragging.current = false; }
      }
    : {};

  const handleHandlers = {
    onPointerDown: (e) => { e.stopPropagation(); dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); },
    onPointerMove: (e) => { if (dragging.current) set(fromEvent(e, plotRef.current)); },
    onPointerUp: (e) => { e.stopPropagation(); dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; },
    onKeyDown: (e) => {
      const big = step * 5;
      const delta = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? step : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -step : e.key === 'PageUp' ? big : e.key === 'PageDown' ? -big : 0;
      if (delta) { e.preventDefault(); set(clamp(value + delta, 0, max)); }
    }
  };

  const pct = clamp((value / max) * 100, 0, 100);
  return (
    <div ref={plotRef} className="v3-plot" style={{ height, cursor: fine ? 'ns-resize' : undefined, touchAction: fine ? 'none' : undefined }} {...plotHandlers}>
      {children}
      <div className="v3-thr-line" style={{ bottom: `${pct}%` }} aria-hidden="true" />
      <div
        className="v3-thr-handle"
        style={{ bottom: `${pct}%` }}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
        {...handleHandlers}
      >
        {value.toLocaleString('en-US')} {unit}
      </div>
    </div>
  );
}
