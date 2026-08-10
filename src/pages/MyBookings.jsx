import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertTriangle, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef } from "../utils";

const FILTER_TABS = ["All", "Active", "In Transit", "Delivered", "Cancelled"];

// List-only — tapping a row/card navigates to /bookings/:id (BookingDetail.jsx) instead of
// opening an in-page modal, so there's room for a real map and the booking gets a shareable URL.
export default function MyBookings() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const token = getToken();

  const loadBookings = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get("/api/bookings?limit=100", token);
      if (!response?.success) throw new Error(response?.message || "Failed to load bookings");
      setBookings((response.data?.bookings || response.data || []).map(adaptBooking));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBookings = useMemo(() => {
    if (activeFilter === "All") return bookings;
    if (activeFilter === "Active")
      return bookings.filter((b) => ["Assigned", "Confirmed", "En Route", "Picked Up", "In Transit"].includes(b.status));
    return bookings.filter((b) => b.status === activeFilter);
  }, [activeFilter, bookings]);

  const openBooking = (booking) => navigate(`/bookings/${booking.id}`);

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

      {loading ? (
        <div className="bg-white rounded-xl shadow-card flex flex-col items-center justify-center py-24">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-400">Loading your bookings...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-card flex flex-col items-center justify-center py-24">
          <AlertTriangle className="w-12 h-12 text-danger/40 mb-3" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">Couldn't load bookings</h3>
          <p className="text-sm text-neutral-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={loadBookings}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : filteredBookings.length === 0 ? (
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
                    onClick={() => openBooking(booking)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono font-medium text-neutral-500">{bookingRef(booking)}</p>
                      {booking.driver?.name && (
                        <p className="text-[11px] text-neutral-400 mt-0.5">{booking.driver.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-[260px]">
                      <p
                        className="text-sm font-semibold text-neutral-700 truncate"
                        title={`${booking.pickup} → ${booking.drop}`}
                      >
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
                          openBooking(booking);
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
                onClick={() => openBooking(booking)}
                className="bg-white rounded-xl shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 mr-3">
                    <p className="text-[10px] font-mono text-neutral-400">{bookingRef(booking)}</p>
                    <p className="text-sm font-semibold text-neutral-700 mt-0.5">
                      {booking.pickup} → {booking.drop}
                    </p>
                    {booking.driver?.name && (
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
    </div>
  );
}
