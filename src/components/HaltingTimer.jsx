import React, { useEffect, useState } from "react";
import { Clock3, AlertTriangle } from "lucide-react";

// Re-render often enough that the countdown/overage readout stays roughly live without needing
// per-second precision — same "good enough" cadence philosophy as TrackShipment's own 7s poll,
// just slower since there's nothing here that actually changes faster than a minute at a time.
const HALTING_TICK_MS = 60000;
const MS_PER_HOUR = 3600000;

// "3h 42m" / "42m" — mirrors TrackShipment.jsx's own local formatEta ("Xh Ymin") closely enough
// to read consistently on the same page, just trimmed to "m" since this often sits right next
// to a bare hour count (haltingHours) elsewhere on these pages.
const formatHoursMinutes = (ms) => {
  const totalMinutes = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Matches adaptBooking's formatted status labels (see utils.js) — the same pair BookingDetail.jsx
// uses for INVOICE_READY_STATUSES.
const TERMINAL_STATUSES = ["Delivered", "Completed"];

// Live free-halting-window readout for an inter-city booking, derived entirely from fields
// already present on the booking object (tripStartedAt, haltingGraceHours, haltingHours,
// haltingCharge — see gadidosti-backend's booking projection). No extra API calls.
//
// Renders nothing at all when:
//  - haltingGraceHours is null (booking was never halting-eligible — intra-city, or inter-city
//    at/under the base distance threshold), or
//  - the trip hasn't actually started yet (tripStartedAt is null), or
//  - the trip is delivered/completed with no halting charge (haltingCharge === 0).
//
// While the trip is live it shows elapsed/remaining TIME only — deliberately never a
// live-accruing rupee estimate. Unlike the trip object (driver/broker-side), the booking object
// has no haltingRatePerHour, so the client has nothing to project a running ₹ figure from until
// the trip is actually delivered and haltingCharge is fixed.
//
// `showFinal` (default true) lets a page that already renders the final haltingHours/
// haltingCharge result elsewhere (e.g. BookingDetail's Financial Summary) opt out of this
// component's own version of that same message once delivered, while still getting the live
// countdown/overage banner for free while the trip is still running.
export default function HaltingTimer({ booking, showFinal = true, className = "" }) {
  const graceHours = booking?.haltingGraceHours;
  const tripStartedAt = booking?.tripStartedAt;
  const isTerminal = TERMINAL_STATUSES.includes(booking?.status);
  const isTicking = graceHours != null && !!tripStartedAt && !isTerminal;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTicking) return undefined;
    const interval = setInterval(() => setNow(Date.now()), HALTING_TICK_MS);
    return () => clearInterval(interval);
  }, [isTicking]);

  // Never halting-eligible at all — no halting UI of any kind for this booking, ever.
  if (graceHours == null) return null;

  if (isTerminal) {
    // Trip's over — the final result is fixed forever now. Only shown here if the page hasn't
    // already rendered its own version of this (see showFinal above), and only when there
    // actually was a charge.
    if (!showFinal || !booking.haltingCharge) return null;
    return (
      <div className={`bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
          <Clock3 className="w-4 h-4 text-amber-600" />
        </div>
        <p className="text-sm text-amber-700">
          Halting charge applied: <span className="font-semibold">₹{Number(booking.haltingCharge).toLocaleString("en-IN")}</span> for {booking.haltingHours}h over the free window.
        </p>
      </div>
    );
  }

  // Eligible, but the driver hasn't actually started the trip yet — nothing to show yet.
  if (!tripStartedAt) return null;

  const startedMs = new Date(tripStartedAt).getTime();
  if (Number.isNaN(startedMs)) return null;

  const deadlineMs = startedMs + graceHours * MS_PER_HOUR;
  const remainingMs = deadlineMs - now;

  if (remainingMs >= 0) {
    // Still within the free window — kept low-key since this is routine background operational
    // info, not a warning.
    return (
      <div className={`bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 flex items-center gap-3 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
          <Clock3 className="w-4 h-4 text-neutral-400" />
        </div>
        <p className="text-sm text-neutral-500">
          Free halting time remaining: <span className="font-medium text-neutral-700">{formatHoursMinutes(remainingMs)}</span>
        </p>
      </div>
    );
  }

  // Over the free window — a charge will be added once the trip's actually delivered, but never
  // a rupee estimate here (see the note above on why the client can't project one live).
  return (
    <div className={`bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
      </div>
      <p className="text-sm text-amber-700">
        Halting time exceeded by <span className="font-semibold">{formatHoursMinutes(remainingMs)}</span> — a charge will be added on delivery.
      </p>
    </div>
  );
}
