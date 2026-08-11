import { BarChart3 } from "lucide-react";

// Dependency-free companion to MiniAreaChart — see that file's comment for why this isn't
// built on a charting library.
export default function MiniBarChart({ data, height = 180, color = "#1976FF", emptyLabel = "No data yet" }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const allZero = data.length > 0 && data.every((d) => !d.value);

  if (!data.length || allZero) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
        <BarChart3 className="w-6 h-6 text-neutral-200" />
        <p className="text-sm text-neutral-300">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max((d.value / max) * 100, 3)}%`, backgroundColor: color, opacity: d.value ? 1 : 0.15 }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[10px] text-neutral-300 mt-1.5">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
