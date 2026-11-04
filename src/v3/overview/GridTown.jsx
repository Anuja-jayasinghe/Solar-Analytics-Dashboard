import { BUILDINGS, BUS, BUS_END, BUS_START, G, HOME, LAMPS, PYLONS, STARS, SUBSTATION, TRUNK_PATH, VIEW_H, VIEW_W, frontierX, pulseRoute, townState } from './gridTown.js';

const PULSES = 6;
const PULSE_S = 3.6; // seconds for a pulse to travel from your roof to the frontier

/**
 * The daily goal as a little power grid (gridTown.js): your house's rooftop panels feed pylons, a substation and a
 * street of ten buildings, each worth 10% of today's target, lit floor by floor. `share` is today's kWh / target
 * (may pass 1). `flowing` runs the energy pulses (off when the reading is stale or there is nothing to send).
 */
export function GridTown({ share, flowing = true, label }) {
  const s = typeof share === 'number' && Number.isFinite(share) ? Math.max(0, share) : 0;
  const st = townState(s);
  const route = pulseRoute(s);
  const edge = frontierX(s);
  return (
    <svg className="v3-town" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label}>
      {STARS.map(([x, y], i) => <circle key={i} className="v3-town-star" cx={x} cy={y} r="1.4" data-on={i < st.stars || undefined} />)}

      {/* the street, with a little depth */}
      <path className="v3-town-ground" d={`M0 ${G} H${VIEW_W} L${VIEW_W} ${G + 26} H0 Z`} />
      <path className="v3-town-kerb" d={`M0 ${G} H${VIEW_W}`} />
      <path className="v3-town-lane" d={`M0 ${G + 17} H${VIEW_W}`} />

      {/* your home: walls, roof with panels, door, window, inverter */}
      <path className="v3-town-side" d={HOME.walls.side} />
      <path className="v3-town-front" d={HOME.walls.front} />
      <path className="v3-town-side" d={HOME.roofSide} />
      <path className="v3-town-roof" d={HOME.roof} />
      {HOME.panels.map((p, i) => (
        <g key={i}>
          <path className="v3-town-panel" d={p.d} />
          <circle className="v3-town-glint" cx={p.glint[0]} cy={p.glint[1]} r="1.6" style={{ '--i': i }} />
        </g>
      ))}
      <rect className="v3-town-line" x={HOME.door.x} y={HOME.door.y} width={HOME.door.w} height={HOME.door.h} rx="1.5" fill="none" />
      <rect className="v3-town-win" data-on={s > 0 || undefined} x={HOME.window.x} y={HOME.window.y} width={HOME.window.w} height={HOME.window.h} rx="1.5" />
      <rect className="v3-town-inverter" x={HOME.inverter.x} y={HOME.inverter.y} width={HOME.inverter.w} height={HOME.inverter.h} rx="2" />
      <circle className="v3-town-led" data-on={flowing || undefined} cx={HOME.inverter.led[0]} cy={HOME.inverter.led[1]} r="1.8" />

      {/* the grid: overhead line, pylons (with a faint back leg for depth), substation */}
      <path className="v3-town-wire" d={TRUNK_PATH} data-on={s > 0 || undefined} />
      {PYLONS.map((p, i) => (
        <g key={i}>
          <path className="v3-town-pylon back" d={p.d} transform="translate(4 -3)" />
          <path className="v3-town-pylon" d={p.d} />
        </g>
      ))}
      <path className="v3-town-side" d={SUBSTATION.side} />
      <path className="v3-town-top" d={SUBSTATION.top} />
      <path className="v3-town-front" d={SUBSTATION.front} />
      <path className="v3-town-line" d={SUBSTATION.coil} fill="none" />

      {/* the town */}
      {BUILDINGS.map((b) => (
        <g key={b.i}>
          <path className="v3-town-side" d={b.faces.side} />
          <path className="v3-town-top" d={b.faces.top} />
          <path className="v3-town-front" d={b.faces.front} />
          {b.roof && <path className="v3-town-line" d={b.roof} fill="none" />}
          {b.windows.map((w, k) => (
            <rect key={k} className="v3-town-win" data-on={k < st.lit[b.i] || undefined} data-gold={(k < st.lit[b.i] && b.i < st.gold) || undefined}
              x={w.x} y={w.y} width={w.w} height={w.h} rx="1" />
          ))}
        </g>
      ))}

      {/* the street cable, energised up to the building being powered now */}
      <path className="v3-town-bus" d={`M${BUS_START} ${BUS.y} H${BUS_END}`} />
      <path className="v3-town-bus" data-on d={`M${BUS_START} ${BUS.y} H${edge}`} />
      <path className="v3-town-wire" data-on={s > 0 || undefined} d={`M${SUBSTATION.port[0]} ${G} V${BUS.y}`} />
      {LAMPS.map((x) => (
        <g key={x}>
          <path className="v3-town-line" d={`M${x} ${G + 24} V${G + 10}`} />
          <circle className="v3-town-lamp" data-on={st.lampsOn || undefined} cx={x} cy={G + 9} r="2.6" />
        </g>
      ))}

      {/* energy leaving your roof for the town */}
      {flowing && s > 0 && Array.from({ length: PULSES }, (_, i) => (
        <circle key={`${i}:${route}`} className="v3-town-pulse" r="2.6">
          <animateMotion dur={`${PULSE_S}s`} repeatCount="indefinite" begin={`${(-i * PULSE_S) / PULSES}s`} path={route} />
        </circle>
      ))}
    </svg>
  );
}
