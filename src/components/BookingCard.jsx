import React from "react";
import { ArrowRight, Truck, Calendar } from "lucide-react";
import StatusBadge from "./StatusBadge";

export default function BookingCard({ booking, onClick, showTrack = false }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-card p-4 mb-3 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-400 font-medium">{booking.id}</span>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="font-poppins font-semibold text-base text-neutral-700">{booking.pickup}</span>
        <ArrowRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />
        <span className="font-poppins font-semibold text-base text-neutral-700">{booking.drop}</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <Truck className="w-4 h-4 text-neutral-300" />
          <span className="text-xs text-neutral-400">{booking.truckType}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4 text-neutral-300" />
          <span className="text-xs text-neutral-400">{booking.date}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-poppins font-bold text-lg text-neutral-800">
          ₹{booking.amount.toLocaleString("en-IN")}
        </span>
        {showTrack && (booking.status === "In Transit" || booking.status === "Assigned") && (
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="px-4 py-1.5 bg-primary text-white text-xs font-medium rounded-full"
          >
            Track
          </button>
        )}
        {!showTrack && (
          <span className="text-xs text-primary font-medium">View Details</span>
        )}
      </div>
    </div>
  );
}
