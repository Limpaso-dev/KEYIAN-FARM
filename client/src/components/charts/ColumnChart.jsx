import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { cx } from "../../lib/cx";
import { compact } from "../../lib/format";

// Validated categorical order (blue, orange): passes the CVD and normal-vision
// checks in light mode. Brand green stays for the interface, not the data.
const SERIES_COLORS = ["#2a78d6", "#eb6834"];

const GRID = "#e3e7e5"; // slate-200: one step off the surface
const AXIS_TEXT = "#6c7571"; // slate-500

/** Round tick values: 0, 2K, 4K ... */
const niceTicks = (max, count = 4) => {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
};

/** Column with a 4px rounded data end and a square baseline. */
const columnPath = (x, y, w, h, round) => {
  if (h <= 0) return "";
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

/**
 * data:   [{ key, label, sublabel?, values: { [seriesKey]: number } }]
 * series: [{ key, label }]  (colours follow SERIES_COLORS in order)
 */
export const ColumnChart = ({ data, series, stacked = false, format = (v) => compact(v), height = 240, title }) => {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const descId = useId();
  const colors = series.map((s, i) => s.color || SERIES_COLORS[i % SERIES_COLORS.length]);

  const totals = data.map((d) => series.reduce((sum, s) => sum + (Number(d.values[s.key]) || 0), 0));
  const peak = stacked ? Math.max(0, ...totals) : Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d.values[s.key]) || 0)));
  const empty = peak === 0;
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1];

  const margin = { top: 8, right: 4, bottom: 26, left: Math.max(30, ...ticks.map((t) => compact(t).length * 6.6 + 10)) };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const band = data.length ? innerW / data.length : 0;
  const y = (v) => margin.top + innerH - (v / top) * innerH;

  const groupW = stacked ? Math.min(24, band * 0.62) : Math.min(28, band * 0.7);
  const barW = stacked ? groupW : Math.max(2, (groupW - 2 * (series.length - 1)) / series.length);
  const labelEvery = band < 48 ? Math.ceil(48 / band) : 1; // date labels are ~40px wide

  const onKeyDown = (event) => {
    if (!data.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setHover((h) => (h === null ? (step > 0 ? 0 : data.length - 1) : Math.min(data.length - 1, Math.max(0, h + step))));
    }
    if (event.key === "Escape") setHover(null);
  };

  const tip = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? margin.left + band * hover + band / 2 : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
            {series.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} aria-hidden />{s.label}</li>
            ))}
          </ul>
        ) : <span />}
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          {asTable ? <><BarChart3 size={13} /> Chart</> : <><Table2 size={13} /> Table</>}
        </button>
      </div>

      {asTable ? (
        <div className="scrollbar-thin overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: height }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr><th className="px-3 py-2 font-semibold">Date</th>{series.map((s) => <th key={s.key} className="px-3 py-2 text-right font-semibold">{s.label}</th>)}{series.length > 1 && <th className="px-3 py-2 text-right font-semibold">Total</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums text-slate-700">
              {[...data].reverse().map((d) => (
                <tr key={d.key}><td className="px-3 py-1.5">{d.sublabel ? `${d.sublabel} ${d.label}` : d.label}</td>{series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right">{format(d.values[s.key] || 0, true)}</td>)}{series.length > 1 && <td className="px-3 py-1.5 text-right font-medium">{format(series.reduce((t, s) => t + (Number(d.values[s.key]) || 0), 0), true)}</td>}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height }}>
          {width > 0 && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={title}
              aria-describedby={descId}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onBlur={() => setHover(null)}
              onMouseLeave={() => setHover(null)}
              className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-600/40"
            >
              <desc id={descId}>Use the left and right arrow keys to read each day. A table view is available.</desc>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" shapeRendering="crispEdges" />
                  <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>{compact(t)}</text>
                </g>
              ))}
              {hover !== null && <rect x={margin.left + band * hover} y={margin.top} width={band} height={innerH} fill="#f0f2f1" />}
              {data.map((d, i) => {
                const cx0 = margin.left + band * i + (band - groupW) / 2;
                let base = 0;
                return (
                  <g key={d.key}>
                    {series.map((s, si) => {
                      const v = Math.max(0, Number(d.values[s.key]) || 0);
                      if (stacked) {
                        const y0 = y(base);
                        const y1 = y(base + v);
                        base += v;
                        const isTop = series.slice(si + 1).every((later) => !(Number(d.values[later.key]) > 0));
                        const gap = si > 0 && v > 0 ? 2 : 0; // 2px surface gap between stacked segments
                        return <path key={s.key} d={columnPath(cx0, y1, barW, Math.max(0, y0 - y1 - gap), isTop)} fill={colors[si]} />;
                      }
                      const x = cx0 + si * (barW + 2);
                      return <path key={s.key} d={columnPath(x, y(v), barW, y(0) - y(v), true)} fill={colors[si]} />;
                    })}
                    {i % labelEvery === (data.length - 1) % labelEvery && (
                      <text x={margin.left + band * i + band / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>{d.label}</text>
                    )}
                    <rect x={margin.left + band * i} y={margin.top} width={band} height={innerH + margin.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
                  </g>
                );
              })}
              <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} stroke="#cdd3d0" strokeWidth="1" shapeRendering="crispEdges" />
            </svg>
          )}
          {empty && width > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-sm text-slate-400">No activity recorded in this period</div>
          )}
          {tip && !empty && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-raised"
              style={{ left: Math.min(Math.max(tipX - 75, 0), Math.max(0, width - 170)) }}
            >
              <p className="mb-1 font-semibold text-slate-900">{tip.sublabel ? `${tip.sublabel} ${tip.label}` : tip.label}</p>
              {series.map((s, i) => (
                <p key={s.key} className="flex items-center justify-between gap-4 text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[i] }} aria-hidden />{s.label}</span>
                  <span className="font-medium tabular-nums text-slate-900">{format(tip.values[s.key] || 0, true)}</span>
                </p>
              ))}
              {series.length > 1 && stacked && (
                <p className={cx("mt-1 flex justify-between gap-4 border-t border-slate-100 pt-1 text-slate-600")}><span>Total</span><span className="font-semibold tabular-nums text-slate-900">{format(totals[hover], true)}</span></p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
