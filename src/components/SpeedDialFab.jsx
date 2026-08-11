import { useState } from "react";
import { Plus } from "lucide-react";

// A fixed "+" pinned to the bottom-right of the viewport — stays in the same spot while the
// page scrolls, like a normal mobile-app FAB, instead of scrolling away with the content below
// it. Fans its actions out along a quarter-circle arc (straight up to straight left) on hover
// (desktop) or tap (touch, since hover never fires there). The "+" rotates 45° into an "×"
// while open instead of swapping icons.
//
// bottom-20 (mobile) clears BottomNav.jsx's 64px sticky bar plus a small margin so the FAB
// never overlaps it; md:bottom-4 hugs the true corner once BottomNav no longer renders.
const RADIUS = 92;
const ARC_DEGREES = 90; // straight-up (0°) to straight-left (90°)

export default function SpeedDialFab({ actions, className = "" }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`fixed bottom-20 right-4 md:bottom-4 md:right-4 z-40 w-14 h-14 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Tap-outside-to-close, mainly for touch devices where there's no hover to leave. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20"
        />
      )}

      {actions.map((action, i) => {
        const angle = (ARC_DEGREES / (actions.length - 1)) * i; // 0deg = up, 90deg = left
        const rad = (angle * Math.PI) / 180;
        const dx = -Math.sin(rad) * RADIUS;
        const dy = -Math.cos(rad) * RADIUS;
        return (
          <button
            key={action.label}
            onClick={() => { setOpen(false); action.onClick(); }}
            aria-label={action.label}
            className="group absolute bottom-0 right-0 w-11 h-11 rounded-full bg-white shadow-card-hover flex items-center justify-center text-primary border border-neutral-100 hover:bg-primary hover:text-white z-30"
            style={{
              transform: open ? `translate(${dx}px, ${dy}px) scale(1)` : "translate(0, 0) scale(0.4)",
              opacity: open ? 1 : 0,
              transition: `transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1) ${open ? i * 40 : 0}ms, opacity 200ms ${open ? i * 40 : 0}ms`,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            <action.icon size={18} />
            {/* Name tooltip — instant on hover, unlike the native title attribute's ~1s delay. */}
            <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2.5 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {action.label}
            </span>
          </button>
        );
      })}

      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close" : "Quick actions"}
        className="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-primary text-white shadow-card-hover flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all z-30"
      >
        <Plus className="w-6 h-6 transition-transform duration-300" style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }} />
      </button>
    </div>
  );
}
