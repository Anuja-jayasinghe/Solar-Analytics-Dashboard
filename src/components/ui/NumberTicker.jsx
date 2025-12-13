import React, { useEffect, useRef, useState } from 'react';

export default function NumberTicker({ value = 0, format = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 3 }), duration = 500 }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef();

  useEffect(() => {
    const start = performance.now();
    const from = prevRef.current;
    const to = value;
    cancelAnimationFrame(rafRef.current);
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    prevRef.current = value;
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span>{format(display)}</span>;
}
