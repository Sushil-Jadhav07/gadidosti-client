import { Truck as TruckIcon, MapPin } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { bookingRef, TIMELINE_STEPS } from "../utils";

// One row in the "Routes in Transit" panel — pickup -> (progress) -> drop, same rail language
// used elsewhere in this app (BookTruck's location step, TrackShipment's route rail), just
// compact enough to stack several in a sidebar. Progress comes from the booking's own
// currentStep (already computed by adaptBooking) against the fixed TIMELINE_STEPS length —
// no separate live-location call needed just to draw this.
export default function RouteProgressCard({ booking, highlighted = false, onClick }) {
  const progress = Math.min(100, Math.max(0, (booking.currentStep / (TIMELINE_STEPS.length - 1)) * 100));

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 transition-colors ${
        highlighted ? "bg-secondary" : "bg-white border border-neutral-100 hover:border-primary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <span className={`text-sm font-poppins font-semibold truncate ${highlighted ? "text-white" : "text-neutral-800"}`}>
          {bookingRef(booking)}
        </span>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex items-center mb-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${highlighted ? "bg-white" : "bg-primary"}`} />
        <div className={`flex-1 h-0.5 mx-1.5 relative ${highlighted ? "bg-white/20" : "bg-neutral-100"}`}>
          <div className={`absolute inset-y-0 left-0 ${highlighted ? "bg-white" : "bg-primary"}`} style={{ width: `${progress}%` }} />
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              highlighted ? "bg-white text-secondary" : "bg-primary text-white"
            }`}
            style={{ left: `${progress}%` }}
          >
            <TruckIcon size={11} />
          </div>
        </div>
        <MapPin size={14} className={`flex-shrink-0 ${highlighted ? "text-white" : "text-success"}`} fill="currentColor" fillOpacity={0.15} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs truncate min-w-0 ${highlighted ? "text-white/80" : "text-neutral-500"}`} title={booking.pickup}>
          {booking.pickup || "—"}
        </p>
        <p className={`text-xs truncate min-w-0 text-right ${highlighted ? "text-white/80" : "text-neutral-500"}`} title={booking.drop}>
          {booking.drop || "—"}
        </p>
      </div>
    </button>
  );
}
