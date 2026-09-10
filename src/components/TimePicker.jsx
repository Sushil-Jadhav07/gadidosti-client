import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");

const DIAL_SIZE = 220;
const CENTER = DIAL_SIZE / 2;
const RADIUS = 84;

// Position of the i-th of `total` evenly-spaced numbers around the dial, i=0 at 12 o'clock,
// going clockwise — same layout a real analog clock face uses.
const posFor = (i, total) => {
  const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
};

const HOUR_NUMBERS = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)); // 12,1,2,...,11
// 5-minute steps around the dial — a plain 60-tick face is too cramped to tap accurately, and a
// pickup time slot doesn't need to-the-minute precision anyway.
const MINUTE_NUMBERS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...,55

function to12Hour(h24) {
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, period };
}
function to24Hour(h12, period) {
  const base = h12 % 12;
  return period === "PM" ? base + 12 : base;
}

// Our own analog clock-face time picker — replaces both the native <input type="time"> picker
// and the earlier scrollable two-column list version with something that actually looks and
// feels like a clock. Value/onChange are still plain "HH:mm" 24h strings, same shape
// BookTruck.jsx's scheduledDateTime split already used, so nothing downstream changed.
export default function TimePicker({ value, onChange, placeholder = "Select time" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour"); // "hour" | "minute"
  const wrapperRef = useRef(null);
  const dialRef = useRef(null);
  const draggingRef = useRef(false);

  const [hStr, mStr] = value ? value.split(":") : ["9", "0"];
  const h24 = Number(hStr) || 0;
  const minute = Number(mStr) || 0;
  const { h12, period } = to12Hour(h24);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setMode("hour");
  }, [open]);

  const commitHour = (newH12) => {
    onChange(`${pad(to24Hour(newH12, period))}:${pad(minute)}`);
    setMode("minute");
  };
  const commitMinute = (newMinute) => {
    onChange(`${pad(h24)}:${pad(newMinute)}`);
  };
  const commitPeriod = (newPeriod) => {
    onChange(`${pad(to24Hour(h12, newPeriod))}:${pad(minute)}`);
  };

  // Lets the hand follow a drag anywhere on the dial, not just a tap directly on a number —
  // much easier to hit on a touch screen. Same angle math as posFor, inverted.
  const angleToValue = (clientX, clientY) => {
    const rect = dialRef.current.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const fraction = angle / (2 * Math.PI);
    if (mode === "hour") {
      const idx = Math.round(fraction * 12) % 12;
      return idx === 0 ? 12 : idx;
    }
    const idx = Math.round(fraction * 12) % 12;
    return idx * 5;
  };

  const handlePointer = (e) => {
    const point = e.touches?.[0] || e;
    const val = angleToValue(point.clientX, point.clientY);
    if (mode === "hour") commitHour(val);
    else commitMinute(val);
  };

  const startDrag = (e) => {
    draggingRef.current = true;
    handlePointer(e);
  };
  const moveDrag = (e) => {
    if (!draggingRef.current) return;
    handlePointer(e);
  };
  const endDrag = () => { draggingRef.current = false; };

  const selectedIndex = mode === "hour" ? (h12 === 12 ? 0 : h12) : minute / 5;
  const handPos = posFor(selectedIndex, 12);
  const numbers = mode === "hour" ? HOUR_NUMBERS : MINUTE_NUMBERS;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all"
      >
        <Clock className="w-4 h-4 text-neutral-300 flex-shrink-0" />
        <span className={value ? "text-neutral-700" : "text-neutral-300"}>
          {value ? `${pad(h12)}:${pad(minute)} ${period}` : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-[280px] bg-white rounded-2xl shadow-dropdown border border-neutral-100 p-4">
          {/* Header — big HH : MM readout, click either half to switch what the dial edits,
              AM/PM toggle alongside since a 12-number dial can't show that on its own. */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-1 font-poppins">
              <button
                type="button"
                onClick={() => setMode("hour")}
                className={`px-2 py-1 rounded-lg text-3xl font-bold tabular-nums transition-colors ${
                  mode === "hour" ? "bg-primary-50 text-primary" : "text-neutral-800 hover:text-primary"
                }`}
              >
                {pad(h12)}
              </button>
              <span className="text-3xl font-bold text-neutral-300">:</span>
              <button
                type="button"
                onClick={() => setMode("minute")}
                className={`px-2 py-1 rounded-lg text-3xl font-bold tabular-nums transition-colors ${
                  mode === "minute" ? "bg-primary-50 text-primary" : "text-neutral-800 hover:text-primary"
                }`}
              >
                {pad(minute)}
              </button>
            </div>
            <div className="flex flex-col rounded-lg border border-neutral-200 overflow-hidden flex-shrink-0">
              <button
                type="button"
                onClick={() => commitPeriod("AM")}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${period === "AM" ? "bg-primary text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => commitPeriod("PM")}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors border-t border-neutral-200 ${period === "PM" ? "bg-primary text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
              >
                PM
              </button>
            </div>
          </div>

          {/* The dial itself. */}
          <div
            ref={dialRef}
            onMouseDown={startDrag}
            onMouseMove={moveDrag}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={startDrag}
            onTouchMove={moveDrag}
            onTouchEnd={endDrag}
            className="relative mx-auto rounded-full bg-neutral-50 select-none touch-none"
            style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
          >
            {/* Hand — an SVG line from center to whichever number is currently selected. */}
            <svg width={DIAL_SIZE} height={DIAL_SIZE} className="absolute inset-0 pointer-events-none">
              <line x1={CENTER} y1={CENTER} x2={handPos.x} y2={handPos.y} stroke="#166534" strokeWidth={2} />
              <circle cx={CENTER} cy={CENTER} r={3.5} fill="#166534" />
              <circle cx={handPos.x} cy={handPos.y} r={16} fill="#166534" fillOpacity={0.15} />
            </svg>

            {numbers.map((num, i) => {
              const { x, y } = posFor(i, 12);
              const isSelected = mode === "hour" ? num === h12 : num === minute;
              return (
                <button
                  key={num}
                  type="button"
                  tabIndex={-1}
                  onClick={() => (mode === "hour" ? commitHour(num) : commitMinute(num))}
                  className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isSelected ? "bg-primary text-white" : "text-neutral-600 hover:bg-primary-50 hover:text-primary"
                  }`}
                  style={{ left: x, top: y }}
                >
                  {pad(num)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={!value}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
