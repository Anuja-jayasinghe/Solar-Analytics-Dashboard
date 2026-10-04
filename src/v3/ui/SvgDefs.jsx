/**
 * Gradients shared by the charts and gauges, defined once. They read theme tokens (stop-color: var(--gen)),
 * so every theme recolours them. Referenced as url(#id) from any component.
 */
export function SvgDefs() {
  const stop = (offset, color, opacity) => <stop offset={offset} style={{ stopColor: color, ...(opacity === undefined ? {} : { stopOpacity: opacity }) }} />;
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="1" x2="1" y2="0">{stop(0, 'var(--gen-hi)')}{stop(1, 'var(--gen)')}</linearGradient>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">{stop(0, 'var(--gen)', 0.4)}{stop(1, 'var(--gen)', 0.02)}</linearGradient>
        <linearGradient id="areaFillCeb" x1="0" y1="0" x2="0" y2="1">{stop(0, 'var(--ceb)', 0.35)}{stop(1, 'var(--ceb)', 0.02)}</linearGradient>
      </defs>
    </svg>
  );
}
