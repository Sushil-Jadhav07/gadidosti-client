import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

// Kebab menu for a table row — panel is portaled to document.body and positioned via
// getBoundingClientRect, same fix already used in gadidosti-broker-driver's Trucks.jsx: a
// plain `absolute`-positioned dropdown inside a horizontally-scrollable table (overflow-x-auto)
// gets its own overflow-y forced to `auto` by the browser (a CSS overflow-spec quirk — setting
// only overflow-x doesn't leave overflow-y at `visible`), so the dropdown was getting clipped/
// scrolled instead of floating freely above the table. Portaling out of that container sidesteps
// the whole problem.
export default function RowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (btnRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 192) });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[10000] w-48 bg-white border border-neutral-100 rounded-lg shadow-modal py-1.5 overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((item) => (
            item.disabledLabel ? (
              <p key={item.disabledLabel} className="px-3.5 py-2 text-[11px] text-neutral-300 italic">{item.disabledLabel}</p>
            ) : (
              <button
                key={item.label}
                onClick={() => { setOpen(false); item.onClick(); }}
                disabled={item.disabled}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" /> {item.disabled ? item.pendingLabel || item.label : item.label}
              </button>
            )
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
