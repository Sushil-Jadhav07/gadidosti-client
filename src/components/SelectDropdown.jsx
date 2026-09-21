import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

// The one dropdown design used across the admin dashboard, broker panel and client app (each app
// carries an identical copy of this file — they're separate codebases with no shared package, so
// keep the three in sync). Replaces the native <select>, whose option popup is drawn by the
// browser/OS and looks different everywhere. Same look as the broker's TruckDropdown (rounded
// trigger, rotating chevron, check on the selected row). Uses slate-* only, not neutral-*, since
// the admin and client Tailwind configs override `neutral` but none of them touch `slate` — so it
// renders identically in all three.
//
// The option panel is portaled to document.body and positioned from getBoundingClientRect, so
// inside a scrollable modal its height never counts toward the modal's own scroll area.
export default function SelectDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const updatePos = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const move = (delta) => {
    if (!options.length) return;
    const idx = options.findIndex((o) => o.value === value);
    const next = options[(idx + delta + options.length) % options.length];
    onChange(next.value);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };

  return (
    <div className={`relative w-full ${className}`} ref={wrapRef}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2 text-sm outline-none transition-all ${
          disabled
            ? "opacity-60 cursor-not-allowed border-slate-200"
            : open
            ? "border-primary ring-2 ring-primary/15 cursor-pointer"
            : "border-slate-200 hover:border-slate-300 cursor-pointer focus:border-primary focus:ring-2 focus:ring-primary/15"
        }`}
      >
        <span className={`truncate ${selected ? "text-slate-800 font-medium" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </div>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="fixed z-[10000] bg-white border border-slate-100 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(option.value); setOpen(false); }}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                  isSelected ? "bg-primary/10 text-primary font-medium" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={3} />}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
