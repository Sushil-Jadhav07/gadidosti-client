import { useMemo } from "react";
import { LineChart } from "lucide-react";

// A small, dependency-free area/line chart — this app has no charting library installed, and
// pulling one in for two small dashboard charts (see also MiniBarChart) wasn't worth the extra
// bundle weight. Plain SVG, same visual language (brand blue, rounded stroke) as the rest of
// the app rather than a generic chart-library look.
export default function MiniAreaChart({ data, height = 180, color = "#166534", valuePrefix = "", emptyLabel = "No data yet" }) {
  const width = 600;
  const padding = 20;

  const { linePath, areaPath, points, peak } = useMemo(() => {
    if (!data.length) return { linePath: "", areaPath: "", points: [], peak: null };
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = (width - padding * 2) / Math.max(data.length - 1, 1);

    const pts = data.map((d, i) => ({
      ...d,
      x: padding + i * stepX,
      y: padding + (1 - (d.value - min) / range) * (height - padding * 2),
    }));

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${height - padding} L ${pts[0].x.toFixed(1)} ${height - padding} Z`;

    let peakIndex = 0;
    values.forEach((v, i) => { if (v > values[peakIndex]) peakIndex = i; });

    return { linePath: line, areaPath: area, points: pts, peak: values[peakIndex] > 0 ? pts[peakIndex] : null };
  }, [data, height]);

  // Every point is 0 (nothing happened in this window yet) — a flat line at the bottom of
  // the chart reads as "broken/empty" rather than "zero", so show an explicit message instead.
  const allZero = data.length > 0 && data.every((d) => !d.value);

  if (!data.length || allZero) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
        <LineChart className="w-6 h-6 text-neutral-200" />
        <p className="text-sm text-neutral-300">{emptyLabel}</p>
      </div>
    );
  }

  // Show at most ~5 x-axis labels regardless of how many points there are, so a 14-day
  // series doesn't cram 14 overlapping date labels under the chart.
  const labelStride = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full block" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="miniAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#miniAreaGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {peak && <circle cx={peak.x} cy={peak.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />}
      </svg>
      {peak && (
        <div
          className="absolute -translate-x-1/2 bg-secondary text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: `${(peak.x / width) * 100}%`, top: `${Math.max(0, (peak.y / height) * 100 - 14)}%` }}
        >
          {valuePrefix}{Math.round(peak.value).toLocaleString("en-IN")}
        </div>
      )}
      <div className="flex justify-between mt-1.5 px-0.5">
        {points.map((p, i) => (
          <span key={i} className="text-[10px] text-neutral-300" style={{ visibility: i % labelStride === 0 ? "visible" : "hidden" }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
