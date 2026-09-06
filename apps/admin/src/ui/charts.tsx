import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { count, countShort, money, moneyShort } from '@/lib/format';

/**
 * Every chart in the console, in plain inline SVG.
 *
 * No chart library. The console draws five shapes — a sparkline, a multi-line
 * time series, a stacked column, a single-series area and a meter — and a
 * library would be more bytes and less control than four hundred lines of SVG.
 *
 * ── The rules these follow, and why ──────────────────────────────────────────
 *
 * **One axis, always.** There is no dual-axis chart here and there must never
 * be. Impressions and clicks differ by two orders of magnitude, so they are two
 * charts side by side rather than two scales on one plot — a second y-axis
 * invents a correlation the data does not contain.
 *
 * **Colour follows the entity.** A series' hue comes from its fixed slot, never
 * from its position in the current list, so hiding one does not repaint the
 * others.
 *
 * **Separation is negative space, not strokes.** A 2px gap in the surface colour
 * between stacked segments and adjacent columns; a 2px surface ring on markers.
 * No mark is ever outlined to tell it from its neighbour.
 *
 * **Every chart has a table twin.** Two of the light-mode series hues sit below
 * 3:1 against the surface, which the palette validator flags as a WARN with an
 * obligation attached: the values must also be reachable without colour. The
 * "Table" toggle on every chart here is that relief, and it is not optional
 * decoration — do not add a chart to this file without one.
 *
 * **Text never wears the data colour.** Labels, values and legends use the ink
 * tokens; identity comes from the coloured swatch beside them.
 */

// ─── Plumbing ───────────────────────────────────────────────────────────────

/** Width from the DOM rather than a prop, so charts fill whatever card holds them. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // Never below a floor: a card that is briefly 0px wide during layout
      // would otherwise produce NaN paths and a blank chart that never recovers.
      setWidth(Math.max(240, Math.round(entry!.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** Axis ticks at 1/2/5 × a power of ten, so labels read 0 / 500 / 1,000. */
function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  return ticks;
}

export const SERIES_VARS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
] as const;

export interface Series {
  key: string;
  label: string;
  /** Fixed slot index. Assigned by the caller and never derived from order. */
  slot: 0 | 1 | 2 | 3;
}

function Legend({ series }: { series: Series[] }): React.JSX.Element | null {
  // One series needs no legend: the card's own title already names it, and a
  // box with a single swatch just restates the heading.
  if (series.length < 2) return null;
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.key}>
          <i style={{ background: SERIES_VARS[s.slot] }} aria-hidden="true" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * The chart shell: legend, a Chart/Table switch, and the table twin itself.
 *
 * The toggle is here rather than on each chart so no chart can be added without
 * one — the accessible fallback is part of the frame, not a per-chart choice.
 */
function ChartFrame({
  series,
  rows,
  columns,
  children,
}: {
  series: Series[];
  /** The same numbers the chart draws, as text. */
  rows: (string | number)[][];
  columns: string[];
  children: ReactNode;
}): React.JSX.Element {
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <Legend series={series} />
        <span style={{ flex: 1 }} />
        <button
          className="btn ghost sm"
          onClick={() => setMode(mode === 'chart' ? 'table' : 'chart')}
          aria-pressed={mode === 'table'}
        >
          {mode === 'chart' ? 'Table' : 'Chart'}
        </button>
      </div>

      {mode === 'chart' ? (
        children
      ) : (
        <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                {columns.map((column, i) => (
                  <th key={column} className={i === 0 ? undefined : 'num'}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? undefined : 'num'}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; slot?: number }[];
}

function Tooltip({ state, width }: { state: TooltipState; width: number }): React.JSX.Element {
  // Flip to the left of the cursor near the right edge, so the panel never
  // hangs off the card and gets clipped.
  const flip = state.x > width - 170;
  return (
    <div
      className="tooltip"
      style={{
        left: flip ? undefined : state.x + 12,
        right: flip ? width - state.x + 12 : undefined,
        top: Math.max(0, state.y - 12),
      }}
    >
      <b>{state.title}</b>
      {state.rows.map((row) => (
        <div className="row" key={row.label}>
          <em>
            {row.slot !== undefined && (
              <i style={{ background: SERIES_VARS[row.slot] }} aria-hidden="true" />
            )}
            {row.label}
          </em>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Stat tile ──────────────────────────────────────────────────────────────

/**
 * A single number is a stat tile, never a one-bar bar chart.
 *
 * The value uses proportional figures on purpose — `tabular-nums` at 26px makes
 * a number like 121 look gappy, and nothing is aligning vertically here.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  spark,
  tone,
}: {
  label: string;
  value: string;
  /** Percentage change. `null` means there was nothing to compare against. */
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  spark?: number[];
  /** `down` when a *rising* number is bad — overdue money, no-shows. */
  tone?: 'up-good' | 'down-good';
}): React.JSX.Element {
  const direction =
    delta === null || delta === undefined || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const good = tone === 'down-good' ? direction === 'down' : direction === 'up';
  const className = direction === 'flat' ? 'flat' : good ? 'up' : 'down';

  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta !== undefined && delta !== null && (
          <span className={`delta ${className}`}>
            {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}
            {Math.abs(delta)}%
          </span>
        )}
        <span>{deltaLabel ?? hint ?? ''}</span>
        {spark && spark.length > 1 && (
          <span style={{ marginLeft: 'auto' }}>
            <Sparkline values={spark} />
          </span>
        )}
      </div>
    </div>
  );
}

/** A 2px line, no axis, no labels. Shape only — the tile carries the number. */
export function Sparkline({
  values,
  width = 76,
  height = 22,
}: {
  values: number[];
  width?: number;
  height?: number;
}): React.JSX.Element {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);

  const points = values.map((value, i) => {
    const x = i * step;
    const y = height - ((value - min) / span) * (height - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--series-1)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Multi-line time series ─────────────────────────────────────────────────

export interface LinePoint {
  label: string;
  values: Record<string, number>;
}

/**
 * Up to four series over time, with a crosshair and one tooltip for the whole
 * column — reading four lines means comparing them at the same instant, which a
 * per-point tooltip cannot do.
 *
 * The hit layer is the full plot height at each x, so the pointer never has to
 * find a 4px dot.
 */
export function LineChart({
  points,
  series,
  height = 220,
  format = count,
}: {
  points: LinePoint[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
}): React.JSX.Element {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 10, right: 12, bottom: 22, left: 44 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  const x = (i: number) =>
    padding.left + (points.length < 2 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / top) * plotHeight;

  const path = (key: string) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.values[key] ?? 0).toFixed(1)}`)
      .join(' ');

  const onMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - box.left - padding.left) / plotWidth;
      const index = Math.round(ratio * (points.length - 1));
      setHover(index >= 0 && index < points.length ? index : null);
    },
    [plotWidth, points.length, padding.left],
  );

  const active = hover !== null ? points[hover] : undefined;

  return (
    <ChartFrame
      series={series}
      columns={['Day', ...series.map((s) => s.label)]}
      rows={points.map((p) => [p.label, ...series.map((s) => format(p.values[s.key] ?? 0))])}
    >
      <div className="chart" ref={ref}>
        <svg
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${series.map((s) => s.label).join(', ')} over ${points.length} days`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="gridline"
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="axis-label" x={padding.left - 8} y={y(tick) + 3.5} textAnchor="end">
                {countShort(tick)}
              </text>
            </g>
          ))}

          {/* Three x labels — first, middle, last. A tick per day is unreadable
              at this width and adds nothing the tooltip does not answer. */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((i, index, all) => points[i] && all.indexOf(i) === index)
            .map((i) => (
              <text
                key={i}
                className="axis-label"
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              >
                {points[i]!.label}
              </text>
            ))}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="var(--line-strong)"
              strokeWidth={1}
            />
          )}

          {series.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              stroke={SERIES_VARS[s.slot]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Markers only on the hovered column, each with a 2px surface ring so
              it stays legible where two series cross. */}
          {hover !== null &&
            series.map((s) => (
              <circle
                key={s.key}
                cx={x(hover)}
                cy={y(points[hover]!.values[s.key] ?? 0)}
                r={4}
                fill={SERIES_VARS[s.slot]}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
        </svg>

        {active && hover !== null && (
          <Tooltip
            width={width}
            state={{
              x: x(hover),
              y: 8,
              title: active.label,
              rows: series.map((s) => ({
                label: s.label,
                value: format(active.values[s.key] ?? 0),
                slot: s.slot,
              })),
            }}
          />
        )}
      </div>
    </ChartFrame>
  );
}

// ─── Single-series area ─────────────────────────────────────────────────────

/**
 * One measure over time. The fill is the series hue at 10% — a wash that says
 * "this is the area under the line", not a saturated block.
 *
 * Used for impressions and for clicks as **two separate charts**. They differ by
 * two orders of magnitude, and putting them on one plot with two scales would
 * draw a relationship that is not in the numbers.
 */
export function AreaChart({
  points,
  label,
  slot = 0,
  height = 170,
  format = count,
}: {
  points: { label: string; value: number }[];
  label: string;
  slot?: 0 | 1 | 2 | 3;
  height?: number;
  format?: (n: number) => string;
}): React.JSX.Element {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 10, right: 12, bottom: 22, left: 44 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  const x = (i: number) =>
    padding.left + (points.length < 2 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / top) * plotHeight;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)} ${padding.top + plotHeight} L${x(0).toFixed(1)} ${padding.top + plotHeight} Z`
    : '';

  const series: Series[] = [{ key: 'value', label, slot }];

  return (
    <ChartFrame
      series={series}
      columns={['Day', label]}
      rows={points.map((p) => [p.label, format(p.value)])}
    >
      <div className="chart" ref={ref}>
        <svg
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - box.left - padding.left) / plotWidth;
            const index = Math.round(ratio * (points.length - 1));
            setHover(index >= 0 && index < points.length ? index : null);
          }}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${label} over ${points.length} days`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="gridline"
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="axis-label" x={padding.left - 8} y={y(tick) + 3.5} textAnchor="end">
                {countShort(tick)}
              </text>
            </g>
          ))}

          <path d={area} fill={SERIES_VARS[slot]} fillOpacity={0.1} />
          <path
            d={line}
            fill="none"
            stroke={SERIES_VARS[slot]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {[0, points.length - 1]
            .filter((i, index, all) => points[i] && all.indexOf(i) === index)
            .map((i) => (
              <text
                key={i}
                className="axis-label"
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : 'end'}
              >
                {points[i]!.label}
              </text>
            ))}

          {hover !== null && points[hover] && (
            <circle
              cx={x(hover)}
              cy={y(points[hover]!.value)}
              r={4}
              fill={SERIES_VARS[slot]}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}
        </svg>

        {hover !== null && points[hover] && (
          <Tooltip
            width={width}
            state={{
              x: x(hover),
              y: 8,
              title: points[hover]!.label,
              rows: [{ label, value: format(points[hover]!.value), slot }],
            }}
          />
        )}
      </div>
    </ChartFrame>
  );
}

// ─── Stacked columns ────────────────────────────────────────────────────────

export interface StackPoint {
  label: string;
  values: Record<string, number>;
}

/**
 * Part-to-whole over time — revenue by month, split by where it came from.
 *
 * Columns cap at 24px however wide the card gets; the leftover band is air.
 * Segments are separated by a 2px gap in the surface colour rather than a
 * stroke, and only the top segment of each column takes the 4px rounded cap —
 * the stack grows from one square baseline.
 */
export function StackedBars({
  points,
  series,
  height = 220,
  format = money,
  axisFormat = moneyShort,
}: {
  points: StackPoint[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
  axisFormat?: (n: number) => string;
}): React.JSX.Element {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 10, right: 12, bottom: 24, left: 52 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const totals = points.map((p) => series.reduce((sum, s) => sum + (p.values[s.key] ?? 0), 0));
  const ticks = niceTicks(Math.max(1, ...totals));
  const top = ticks[ticks.length - 1] || 1;

  const band = plotWidth / Math.max(1, points.length);
  const barWidth = Math.min(24, band - 6);
  const scale = (value: number) => (value / top) * plotHeight;
  const bandCenter = (i: number) => padding.left + band * i + band / 2;

  /** Rounded top, square bottom — the shape of a segment that caps a stack. */
  const capPath = (bx: number, by: number, w: number, h: number, r: number): string => {
    const radius = Math.min(r, h, w / 2);
    return [
      `M${bx} ${by + h}`,
      `L${bx} ${by + radius}`,
      `Q${bx} ${by} ${bx + radius} ${by}`,
      `L${bx + w - radius} ${by}`,
      `Q${bx + w} ${by} ${bx + w} ${by + radius}`,
      `L${bx + w} ${by + h}`,
      'Z',
    ].join(' ');
  };

  return (
    <ChartFrame
      series={series}
      columns={['Month', ...series.map((s) => s.label), 'Total']}
      rows={points.map((p, i) => [
        p.label,
        ...series.map((s) => format(p.values[s.key] ?? 0)),
        format(totals[i] ?? 0),
      ])}
    >
      <div className="chart" ref={ref}>
        <svg
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${series.map((s) => s.label).join(', ')} by month`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="gridline"
                x1={padding.left}
                x2={width - padding.right}
                y1={padding.top + plotHeight - scale(tick)}
                y2={padding.top + plotHeight - scale(tick)}
              />
              <text
                className="axis-label"
                x={padding.left - 8}
                y={padding.top + plotHeight - scale(tick) + 3.5}
                textAnchor="end"
              >
                {axisFormat(tick)}
              </text>
            </g>
          ))}

          {points.map((point, i) => {
            // Walk the stack from the baseline up, so the last non-zero segment
            // is the one that gets the rounded cap.
            const segments = series
              .map((s) => ({ s, value: point.values[s.key] ?? 0 }))
              .filter((entry) => entry.value > 0);

            let cursor = padding.top + plotHeight;
            const bx = bandCenter(i) - barWidth / 2;

            return (
              <g key={point.label}>
                {/* Hit target spans the whole band and the full plot height, so
                    a two-pixel segment is still hoverable. */}
                <rect
                  x={padding.left + band * i}
                  y={padding.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
                {segments.map((entry, index) => {
                  const raw = scale(entry.value);
                  // The 2px surface gap comes out of the segment, not out of the
                  // scale — the column's total height still reads true.
                  const gap = index === 0 ? 0 : 2;
                  const h = Math.max(1, raw - gap);
                  const by = cursor - raw;
                  cursor = by;
                  const isTop = index === segments.length - 1;
                  return isTop ? (
                    <path
                      key={entry.s.key}
                      d={capPath(bx, by, barWidth, h, 4)}
                      fill={SERIES_VARS[entry.s.slot]}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      pointerEvents="none"
                    />
                  ) : (
                    <rect
                      key={entry.s.key}
                      x={bx}
                      y={by}
                      width={barWidth}
                      height={h}
                      fill={SERIES_VARS[entry.s.slot]}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      pointerEvents="none"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Every third month, so labels never collide at a narrow width. */}
          {points.map((point, i) =>
            i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
              <text
                key={point.label}
                className="axis-label"
                x={bandCenter(i)}
                y={height - 7}
                textAnchor="middle"
              >
                {point.label}
              </text>
            ) : null,
          )}
        </svg>

        {hover !== null && points[hover] && (
          <Tooltip
            width={width}
            state={{
              x: bandCenter(hover),
              y: 8,
              title: points[hover]!.label,
              rows: [
                ...series
                  .filter((s) => (points[hover]!.values[s.key] ?? 0) > 0)
                  .map((s) => ({
                    label: s.label,
                    value: format(points[hover]!.values[s.key] ?? 0),
                    slot: s.slot,
                  })),
                { label: 'Total', value: format(totals[hover] ?? 0) },
              ],
            }}
          />
        )}
      </div>
    </ChartFrame>
  );
}

// ─── Meter ──────────────────────────────────────────────────────────────────

/**
 * One ratio against a limit — budget spent, attendance, slots filled.
 *
 * A meter rather than a two-slice pie, and the number is always beside it: the
 * bar shows the shape of the ratio, the text carries the value.
 */
export function Meter({
  value,
  max,
  label,
  format = count,
  tone,
}: {
  value: number;
  max: number;
  label?: string;
  format?: (n: number) => string;
  tone?: 'default' | 'warning' | 'critical';
}): React.JSX.Element {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const colour =
    tone === 'critical'
      ? 'var(--critical)'
      : tone === 'warning'
        ? 'var(--warning)'
        : 'var(--series-1)';

  return (
    <div>
      <div
        className="row"
        style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5, gap: 8 }}
      >
        <span className="muted">{label}</span>
        <span className="num">
          {format(value)} <span className="muted">/ {format(max)}</span>
        </span>
      </div>
      <div
        className="meter"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <i style={{ width: `${ratio * 100}%`, background: colour }} />
      </div>
    </div>
  );
}

// ─── Ordinal ramp bars ──────────────────────────────────────────────────────

/**
 * A small ranked breakdown — mosques per plan, tickets per priority.
 *
 * The ramp is used **only** where the categories genuinely have an order (free →
 * standard → pro). For unordered categories a value-ramp would double-encode bar
 * length as hue, so those get slot 1 for every bar instead.
 */
export function RampBars({
  rows,
  format = count,
  ordered = true,
}: {
  rows: { label: string; value: number; caption?: string }[];
  format?: (n: number) => string;
  ordered?: boolean;
}): React.JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const ramp = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)'];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map((row, i) => (
        <div key={row.label}>
          <div
            className="row"
            style={{ justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5, gap: 8 }}
          >
            <span>{row.label}</span>
            <span className="num">
              {format(row.value)}
              {row.caption && <span className="muted"> · {row.caption}</span>}
            </span>
          </div>
          <div className="meter">
            <i
              style={{
                width: `${(row.value / max) * 100}%`,
                background: ordered
                  ? ramp[
                      Math.min(
                        ramp.length - 1,
                        Math.round((i / Math.max(1, rows.length - 1)) * (ramp.length - 1)),
                      )
                    ]
                  : 'var(--series-1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Re-exported so pages can pass a matching formatter to a chart. */
export { count, countShort, money, moneyShort };
