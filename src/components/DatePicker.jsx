import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDateStr = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// 6 full weeks (42 cells) every time, so the grid never changes height between months —
// leading/trailing days from the neighboring months fill the gaps, grayed out and unselectable.
function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - firstWeekday + 1;
    const date = new Date(year, month, dayNum);
    cells.push({ date, inMonth: dayNum >= 1 && dayNum <= daysInMonth });
  }
  return cells;
}

// Our own calendar popover — replaces the native <input type="date"> picker (browser-styled,
// looks completely out of place next to the rest of this app's design). Value/onChange are
// plain "YYYY-MM-DD" strings, same shape BookTruck.jsx's scheduledDateTime split already used,
// so nothing downstream needed to change.
export default function DatePicker({ value, onChange, min, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const selected = parseDateStr(value);
  const minDate = parseDateStr(min);
  const [viewDate, setViewDate] = useState(() => selected || minDate || new Date());
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setViewDate(selected || minDate || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = new Date();
  const todayStr = toDateStr(today);
  const cells = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth());

  const isDisabled = (date) => minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());

  const changeMonth = (delta) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const pick = (date) => {
    if (isDisabled(date)) return;
    onChange(toDateStr(date));
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all"
      >
        <Calendar className="w-4 h-4 text-neutral-300 flex-shrink-0" />
        <span className={selected ? "text-neutral-700" : "text-neutral-300"}>
          {selected
            ? selected.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-dropdown border border-neutral-100 p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-neutral-800">
              {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-primary transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((w) => (
              <p key={w} className="text-[10px] font-semibold text-neutral-300 text-center py-1">{w}</p>
            ))}
            {cells.map(({ date, inMonth }, i) => {
              const dateStr = toDateStr(date);
              const disabled = isDisabled(date);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(date)}
                  className={`w-9 h-9 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-white font-semibold"
                      : !inMonth || disabled
                      ? "text-neutral-200 cursor-not-allowed"
                      : isToday
                      ? "text-primary border border-primary/40 font-semibold"
                      : "text-neutral-700 hover:bg-primary-50 hover:text-primary"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 px-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={isDisabled(today)}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
