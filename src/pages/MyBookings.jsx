import React, { useState, useMemo } from "react";
import { MapPin, ArrowRight, Phone, Check, Package, Download, XCircle, Truck } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import StatusBadge from "../components/StatusBadge";
import { BOOKINGS, TIMELINE_STEPS } from "../data/mockData";
import { useToast } from "../context/ToastContext";

const FILTER_TABS = ["All", "Active", "In Transit", "Delivered", "Cancelled"];

export default function MyBookings() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const toast = useToast();

  const filteredBookings = useMemo(() => {
    if (activeFilter === "All") return BOOKINGS;
    if (activeFilter === "Active")
      return BOOKINGS.filter((b) => b.status === "Assigned" || b.status === "Accepted");
    return BOOKINGS.filter((b) => b.status === activeFilter);
  }, [activeFilter]);

  const handleCancel = () => {
    toast.info("Booking cancellation request submitted");
    setSelectedBooking(null);
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      {/* Filter Tabs — horizontally scrollable on mobile */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 md:px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 ${
              activeFilter === tab
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-white border border-neutral-100 text-neutral-500 hover:text-neutral-700 hover:border-neutral-200"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-2">
          <span className="text-sm text-neutral-400 whitespace-nowrap">
            {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card flex flex-col items-center justify-center py-24">
          <Package className="w-14 h-14 text-neutral-200 mb-4" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">No bookings found</h3>
          <p className="text-sm text-neutral-400">No bookings match the selected filter</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  {["Booking ID", "Route", "Truck Type", "Date", "Amount", "Payment", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors duration-100"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono font-medium text-neutral-500">{booking.id}</p>
                      {booking.driver && (
                        <p className="text-[11px] text-neutral-400 mt-0.5">{booking.driver.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-neutral-700">
                        {booking.pickup} → {booking.drop}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5 capitalize">
                        {booking.transportType === "intra" ? "Intra-City" : "Inter-City"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">{booking.truckType}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">{booking.date}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-poppins font-bold text-neutral-800">
                        ₹{booking.amount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          booking.paymentStatus === "Paid"
                            ? "bg-green-50 text-success"
                            : booking.paymentStatus === "Pending"
                            ? "bg-orange-50 text-warning"
                            : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        {booking.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBooking(booking);
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="bg-white rounded-xl shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 mr-3">
                    <p className="text-[10px] font-mono text-neutral-400">{booking.id}</p>
                    <p className="text-sm font-semibold text-neutral-700 mt-0.5">
                      {booking.pickup} → {booking.drop}
                    </p>
                    {booking.driver && (
                      <p className="text-xs text-neutral-400 mt-0.5">{booking.driver.name}</p>
                    )}
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-50">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{booking.truckType}</span>
                    <span>·</span>
                    <span>{booking.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        booking.paymentStatus === "Paid"
                          ? "bg-green-50 text-success"
                          : booking.paymentStatus === "Pending"
                          ? "bg-orange-50 text-warning"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {booking.paymentStatus}
                    </span>
                    <span className="font-poppins font-bold text-sm text-neutral-800">
                      ₹{booking.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Booking Detail Modal */}
      <BottomSheet isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)}>
        {selectedBooking && (
          <BookingDetailSheet booking={selectedBooking} onCancel={handleCancel} />
        )}
      </BottomSheet>
    </div>
  );
}

function BookingDetailSheet({ booking, onCancel }) {
  return (
    <div className="pr-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 pr-6">
        <div>
          <h3 className="font-poppins font-semibold text-lg text-neutral-800">{booking.id}</h3>
          <p className="text-sm text-neutral-400 mt-0.5">{booking.pickup} → {booking.drop}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Status Timeline */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Status Timeline</p>
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, index) => {
            const isCompleted = index < booking.currentStep;
            const isCurrent = index === booking.currentStep;
            const isVisible = index <= Math.min(booking.currentStep + 1, TIMELINE_STEPS.length - 1);
            if (!isVisible) return null;

            return (
              <div key={step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? "bg-success"
                        : isCurrent
                        ? "bg-primary"
                        : "border-2 border-neutral-200 bg-white"
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && index <= booking.currentStep && (
                    <div className={`w-0.5 h-6 ${isCompleted ? "bg-success" : "bg-neutral-200"}`} />
                  )}
                </div>
                <span
                  className={`text-xs pt-0.5 ${
                    isCompleted ? "text-success font-medium" : isCurrent ? "text-primary font-semibold" : "text-neutral-300"
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Route Map Placeholder */}
      <div className="relative bg-neutral-100 rounded-xl h-[120px] mb-4 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid2" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />
          </svg>
        </div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="text-center">
            <MapPin className="w-5 h-5 text-primary mx-auto" />
            <span className="text-xs font-medium text-neutral-600 mt-1 block">{booking.pickup}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-12 h-0.5 bg-neutral-300" />
            <div className="w-2.5 h-2.5 bg-primary rounded-full" />
            <div className="w-12 h-0.5 bg-neutral-300" />
          </div>
          <div className="text-center">
            <MapPin className="w-5 h-5 text-success mx-auto" />
            <span className="text-xs font-medium text-neutral-600 mt-1 block">{booking.drop}</span>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Client</p>
          <p className="text-sm font-medium text-neutral-700">Rajesh Kumar</p>
          <p className="text-xs text-neutral-400">+91 98765 43210</p>
        </div>
        {booking.broker && (
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-[10px] text-neutral-400 mb-1">Broker</p>
            <p className="text-sm font-medium text-neutral-700">{booking.broker}</p>
          </div>
        )}
        {booking.driver && (
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-[10px] text-neutral-400 mb-1">Driver</p>
            <p className="text-sm font-medium text-neutral-700">{booking.driver.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-neutral-400">{booking.driver.phone}</span>
              <a
                href={`tel:${booking.driver.phone}`}
                className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3 h-3 text-success" />
              </a>
            </div>
          </div>
        )}
        {booking.truckReg && (
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-[10px] text-neutral-400 mb-1">Truck</p>
            <p className="text-sm font-medium text-neutral-700">{booking.truckReg}</p>
            <p className="text-xs text-neutral-400">{booking.truckType}</p>
          </div>
        )}
      </div>

      {/* Load Info */}
      <div className="bg-neutral-50 rounded-lg p-3 mb-4">
        <p className="text-[10px] text-neutral-400 mb-2">Load Details</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-neutral-400">Weight</p>
            <p className="text-sm font-medium text-neutral-700">
              {booking.weight} {booking.weightUnit}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Material</p>
            <p className="text-sm font-medium text-neutral-700">{booking.material}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Quantity</p>
            <p className="text-sm font-medium text-neutral-700">{booking.quantity} items</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-neutral-50 rounded-lg p-3 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-neutral-400">Total Amount</span>
          <span className="font-poppins font-bold text-lg text-primary">
            ₹{booking.amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-neutral-400">Payment Status</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              booking.paymentStatus === "Paid"
                ? "bg-green-50 text-success"
                : booking.paymentStatus === "Pending"
                ? "bg-orange-50 text-warning"
                : "bg-neutral-100 text-neutral-400"
            }`}
          >
            {booking.paymentStatus}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <Download className="w-4 h-4" />
          Download Invoice
        </button>
        {booking.status === "Requested" && (
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
