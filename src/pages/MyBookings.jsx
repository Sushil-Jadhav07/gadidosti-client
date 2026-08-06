import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, Package, Download, XCircle, Truck, Copy, User, Building2,
  Navigation, Ruler, AlertTriangle, RefreshCw, CreditCard, Star, Camera, Handshake, Phone, Tag, Clock3,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import StatusBadge from "../components/StatusBadge";
import PaymentSheet from "../components/PaymentSheet";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef, TIMELINE_STEPS, getStoredDriverRequestId, setStoredDriverRequestId, clearStoredDriverRequestId } from "../utils";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

const FILTER_TABS = ["All", "Active", "In Transit", "Delivered", "Cancelled"];
const LIVE_STATUSES = ["Assigned", "En Route", "Picked Up", "In Transit"];

export default function MyBookings() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [showDisputeSheet, setShowDisputeSheet] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
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

  const handleCancel = async (bookingId) => {
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/cancel`, {}, token);
      if (!res?.success) throw new Error(res?.message || "This booking can no longer be cancelled");
      setBookings((current) => current.map((booking) => (
        booking.id === bookingId
          ? { ...booking, status: "Cancelled", paymentStatus: "Refunded" }
          : booking
      )));
      toast.success("Booking cancelled");
      setSelectedBooking(null);
    } catch (err) {
      toast.error(err?.message || "Failed to cancel booking");
    }
  };

  const handlePaySuccess = async () => {
    setShowPaymentSheet(false);
    if (!selectedBooking) return;
    try {
      const res = await api.patch(`/api/bookings/${selectedBooking.id}/pay`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to record payment");
      setBookings((current) => current.map((booking) => (
        booking.id === selectedBooking.id ? { ...booking, paymentStatus: "Paid" } : booking
      )));
      setSelectedBooking((current) => (current ? { ...current, paymentStatus: "Paid" } : current));
      toast.success("Payment recorded — thank you!");
    } catch (err) {
      toast.error(err?.message || "Failed to record payment");
    }
  };

  const handleRateSubmit = async ({ stars, review }) => {
    if (!selectedBooking) return;
    const res = await api.post(`/api/bookings/${selectedBooking.id}/rate`, { stars, review }, token);
    if (!res?.success) throw new Error(res?.message || "Failed to submit rating");
    const rating = res.data?.rating;
    setBookings((current) => current.map((booking) => (
      booking.id === selectedBooking.id ? { ...booking, rating } : booking
    )));
    setSelectedBooking((current) => (current ? { ...current, rating } : current));
    setShowRateSheet(false);
    toast.success("Thanks for rating your delivery!");
  };

  const handleDisputeSubmit = async ({ issueType, description }) => {
    if (!selectedBooking) return;
    const res = await api.post("/api/disputes", { booking_id: selectedBooking.id, issue_type: issueType, description }, token);
    if (!res?.success) throw new Error(res?.message || "Failed to raise dispute");
    setShowDisputeSheet(false);
    toast.success("Dispute raised — our team will review it shortly.");
  };

  // A broker's counter-offer was accepted from the offers panel — the booking is now
  // confirmed with that broker, so refresh the list and close the sheet.
  const handleOfferAccepted = async () => {
    await loadBookings();
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
                    onClick={() => setSelectedBooking(booking)}
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

      {/* Booking Detail Modal */}
      <BottomSheet isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)}>
        {selectedBooking && (
          <BookingDetailSheet
            booking={selectedBooking}
            onCancel={() => handleCancel(selectedBooking.id)}
            onPayNow={() => setShowPaymentSheet(true)}
            onRateNow={() => setShowRateSheet(true)}
            onDisputeNow={() => setShowDisputeSheet(true)}
            onOfferAccepted={handleOfferAccepted}
          />
        )}
      </BottomSheet>

      <PaymentSheet
        open={showPaymentSheet}
        amount={selectedBooking?.amount}
        phone={user?.phone}
        onClose={() => setShowPaymentSheet(false)}
        onSuccess={handlePaySuccess}
        onPayLater={() => { setShowPaymentSheet(false); toast.info("You can pay anytime from My Bookings."); }}
      />

      <BottomSheet isOpen={showRateSheet} onClose={() => setShowRateSheet(false)}>
        {selectedBooking && (
          <RateDeliverySheet booking={selectedBooking} onSubmit={handleRateSubmit} onCancel={() => setShowRateSheet(false)} />
        )}
      </BottomSheet>

      <BottomSheet isOpen={showDisputeSheet} onClose={() => setShowDisputeSheet(false)}>
        {selectedBooking && (
          <RaiseDisputeSheet booking={selectedBooking} onSubmit={handleDisputeSubmit} onCancel={() => setShowDisputeSheet(false)} />
        )}
      </BottomSheet>
    </div>
  );
}

const ISSUE_TYPES = [
  { value: "damaged_goods", label: "Damaged Goods" },
  { value: "payment_delay", label: "Payment Delay" },
  { value: "cancellation_fee", label: "Cancellation Fee" },
  { value: "route_dispute", label: "Route Dispute" },
  { value: "late_delivery", label: "Late Delivery" },
  { value: "fuel_surcharge", label: "Fuel Surcharge" },
  { value: "wrong_items", label: "Wrong Items" },
  { value: "weight_discrepancy", label: "Weight Discrepancy" },
];

function RaiseDisputeSheet({ booking, onSubmit, onCancel }) {
  const toast = useToast();
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!issueType) {
      toast.error("Please select an issue type");
      return;
    }
    if (!description.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ issueType, description: description.trim() });
    } catch (err) {
      toast.error(err?.message || "Failed to raise dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Report a Problem</h3>
      <p className="text-sm text-neutral-400 mb-5">
        {booking.pickup} → {booking.drop}
      </p>

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Issue Type</label>
      <select
        value={issueType}
        onChange={(e) => setIssueType(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
      >
        <option value="">Select an issue...</option>
        {ISSUE_TYPES.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what went wrong..."
        maxLength={2000}
        rows={4}
        className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
      />

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-danger text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Dispute"}
        </button>
      </div>
    </div>
  );
}

function RateDeliverySheet({ booking, onSubmit, onCancel }) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stars) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ stars, review: review.trim() || undefined });
    } catch (err) {
      toast.error(err?.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Rate this delivery</h3>
      <p className="text-sm text-neutral-400 mb-5">
        {booking.pickup} → {booking.drop}
      </p>

      <div className="flex items-center justify-center gap-2 mb-5">
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = value <= (hoverStars || stars);
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStars(value)}
              onMouseEnter={() => setHoverStars(value)}
              onMouseLeave={() => setHoverStars(0)}
              className="p-1"
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
            >
              <Star className={`w-9 h-9 transition-colors ${filled ? "fill-warning text-warning" : "text-neutral-200"}`} />
            </button>
          );
        })}
      </div>

      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Tell us about your experience (optional)"
        maxLength={1000}
        rows={4}
        className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
      />

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, name, sub, tint = "primary" }) {
  const tintClasses = tint === "success"
    ? "bg-success/10 text-success"
    : tint === "warning"
    ? "bg-orange-50 text-warning"
    : "bg-primary-50 text-primary";

  return (
    <div className="bg-neutral-50 rounded-lg p-3 flex items-start gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tintClasses}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-neutral-700 truncate">{name || "—"}</p>
        {sub && <p className="text-xs text-neutral-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// Negotiation panel — one entry per broker who received this booking's job request. A broker's
// turn is 'pending' (nothing for the client to do yet); once they counter, status flips to
// 'countered' and the client can accept/reject/counter back. Polled every few seconds while the
// sheet is open since offers arrive in near real time, not on a client action.
const OFFERS_POLL_INTERVAL_MS = 6000;

// Direct-driver negotiation panel — shown above the broker OffersPanel below when this booking
// has an in-flight driver negotiation. Two ways that can happen: the client requested a specific
// truck themselves (POST /api/bookings/:id/request-truck, started from BookTruck.jsx's Step 3
// truck pick — the id is stashed in localStorage the moment it's created, see utils.js's
// getStoredDriverRequestId/setStoredDriverRequestId), or a broker assigned a driver on the
// client's behalf (job.controller.js's assignDriver) — the client never created that one, so
// there's no id in localStorage yet; GET /api/driver-requests/booking/:bookingId (below) is what
// discovers it. Live updates arrive over the socket (useDriverRequestSocket) once either path has
// a request; polling stays on as a fallback. Renders nothing once there's confirmed to be no
// active request for this booking either way.
function DriverRequestPanel({ booking, onAccepted }) {
  const toast = useToast();
  const token = getToken();

  const [requestId, setRequestId] = useState(() => getStoredDriverRequestId(booking.id));
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gone, setGone] = useState(false);
  const [acting, setActing] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");

  const adopt = (found) => {
    setRequest(found);
    setRequestId(found.id);
    setStoredDriverRequestId(booking.id, found.id);
    if (found.status === "declined") clearStoredDriverRequestId(booking.id);
  };

  const load = async () => {
    try {
      const res = await api.get(`/api/driver-requests/${requestId}`, token);
      if (!res?.success || !res.data?.request) {
        clearStoredDriverRequestId(booking.id);
        setGone(true);
        return;
      }
      adopt(res.data.request);
    } catch {
      /* silent — next poll retries */
    } finally {
      setLoading(false);
    }
  };

  // No id known yet (localStorage never got one) — check whether a broker assigned a driver on
  // our behalf instead. A 404 here just means neither flow is in progress for this booking.
  const discover = async () => {
    try {
      const res = await api.get(`/api/driver-requests/booking/${booking.id}`, token);
      if (res?.success && res.data?.request) adopt(res.data.request);
      else setGone(true);
    } catch {
      setGone(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) load();
    else discover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!requestId) return undefined;
    const interval = setInterval(() => {
      if (request?.status !== "accepted" && request?.status !== "declined") load();
    }, OFFERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useDriverRequestSocket((updated) => {
    if (updated?.bookingId === booking.id) adopt(updated);
  });

  const handleAccept = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${requestId}/client-accept`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to confirm this driver");
      clearStoredDriverRequestId(booking.id);
      toast.success("Confirmed with this driver!");
      await onAccepted?.();
    } catch (err) {
      toast.error(err?.message || "Failed to confirm this driver");
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${requestId}/client-reject`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to decline");
      clearStoredDriverRequestId(booking.id);
      setGone(true);
      toast.info("Declined — see broker offers below");
    } catch (err) {
      toast.error(err?.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  };

  const submitCounter = async () => {
    const amount = Number(counterAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${requestId}/client-counter`, { amount }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send counter-offer");
      if (res.data?.request) setRequest(res.data.request);
      toast.success("Counter-offer sent");
      setCounterOpen(false);
    } catch (err) {
      toast.error(err?.message || "Failed to send counter-offer");
    } finally {
      setActing(false);
    }
  };

  if (gone || (!loading && !request) || request?.status === "accepted" || request?.status === "declined") return null;

  return (
    <div className="bg-neutral-50 rounded-lg p-3 mb-4">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" /> Direct Driver Request
      </p>

      {loading ? (
        <p className="text-xs text-neutral-400 py-2">Loading request status...</p>
      ) : (
        <div className="bg-white rounded-lg p-3 border border-neutral-100">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-700 truncate">{request.driverName || "Driver"}{request.truckReg ? ` · ${request.truckReg}` : ""}</p>
              {request.driverPhone && (
                <p className="text-[11px] text-neutral-400 flex items-center gap-1"><Phone className="w-3 h-3" />{request.driverPhone}</p>
              )}
            </div>
            <p className="font-poppins font-bold text-primary whitespace-nowrap">₹{Number(request.amount || 0).toLocaleString("en-IN")}</p>
          </div>

          {request.status === "countered" ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAccept}
                disabled={acting}
                className="flex-1 py-1.5 text-xs font-semibold bg-success text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => { setCounterOpen(true); setCounterAmount(String(request.amount || "")); }}
                disabled={acting}
                className="flex-1 py-1.5 text-xs font-semibold border border-primary/30 text-primary rounded-md hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                Counter
              </button>
              <button
                onClick={handleReject}
                disabled={acting}
                className="flex-1 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-[11px] text-neutral-400 mb-2">
                <Clock3 className="w-3 h-3 inline mr-1" />
                {request.driverTimedOut ? "No response yet — their broker has been notified" : "Waiting for the driver to respond"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="flex-1 py-1.5 text-xs font-semibold bg-success text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Confirm Now
                </button>
                <button
                  onClick={() => { setCounterOpen(true); setCounterAmount(String(request.amount || "")); }}
                  disabled={acting}
                  className="flex-1 py-1.5 text-xs font-semibold border border-primary/30 text-primary rounded-md hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  <Tag className="w-3 h-3 inline mr-1" /> Propose Price
                </button>
              </div>
            </div>
          )}

          {counterOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Your offer</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="flex-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-primary min-w-0"
                />
                <button
                  onClick={submitCounter}
                  disabled={acting}
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Send
                </button>
                <button
                  onClick={() => setCounterOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {request.offerHistory?.length > 1 && (
            <details className="mt-2">
              <summary className="text-[11px] text-neutral-400 cursor-pointer select-none">Negotiation history ({request.offerHistory.length})</summary>
              <div className="mt-1.5 space-y-1">
                {request.offerHistory.map((entry, i) => (
                  <p key={i} className="text-[11px] text-neutral-400">
                    {entry.by === "client" ? "You" : entry.by === "broker" ? "Broker" : "Driver"} offered <span className="font-medium text-neutral-600">₹{Number(entry.amount || 0).toLocaleString("en-IN")}</span>
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function OffersPanel({ booking, onAccepted }) {
  const toast = useToast();
  const token = getToken();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counterFor, setCounterFor] = useState(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const res = await api.get(`/api/bookings/${booking.id}/offers`, token);
      if (res?.success) setOffers(res.data?.offers || []);
    } catch { /* silent — next poll retries */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, OFFERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  const handleAccept = async (offerId) => {
    setBusyId(offerId);
    try {
      const res = await api.patch(`/api/jobs/requests/${offerId}/client-accept`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to accept offer");
      toast.success("Offer accepted — booking confirmed!");
      await onAccepted?.();
    } catch (err) {
      toast.error(err?.message || "Failed to accept offer");
      setBusyId(null);
    }
  };

  const handleReject = async (offerId) => {
    setBusyId(offerId);
    try {
      const res = await api.patch(`/api/jobs/requests/${offerId}/client-reject`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to decline offer");
      setOffers((current) => current.map((o) => (o.id === offerId ? { ...o, status: "declined" } : o)));
      toast.info("Offer declined");
    } catch (err) {
      toast.error(err?.message || "Failed to decline offer");
    } finally {
      setBusyId(null);
    }
  };

  const submitCounter = async () => {
    if (!counterFor) return;
    const amount = Number(counterAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusyId(counterFor.id);
    try {
      const res = await api.patch(`/api/jobs/requests/${counterFor.id}/client-counter`, { amount }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send counter-offer");
      const updated = res.data?.request;
      setOffers((current) => current.map((o) => (o.id === counterFor.id ? { ...o, amount: updated?.amount ?? amount, status: updated?.status ?? "pending", offerHistory: updated?.offerHistory ?? o.offerHistory } : o)));
      toast.success("Counter-offer sent");
      setCounterFor(null);
    } catch (err) {
      toast.error(err?.message || "Failed to send counter-offer");
    } finally {
      setBusyId(null);
    }
  };

  const activeOffers = offers.filter((o) => !["declined", "expired"].includes(o.status));
  if (!loading && activeOffers.length === 0) return null;

  return (
    <div className="bg-neutral-50 rounded-lg p-3 mb-4">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Handshake className="w-3.5 h-3.5" /> Broker Offers
      </p>

      {loading ? (
        <p className="text-xs text-neutral-400 py-2">Loading offers...</p>
      ) : (
        <div className="space-y-2">
          {activeOffers.map((offer) => (
            <div key={offer.id} className="bg-white rounded-lg p-3 border border-neutral-100">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-700 truncate">{offer.brokerName || "Broker"}</p>
                  {offer.brokerPhone && <p className="text-[11px] text-neutral-400">{offer.brokerPhone}</p>}
                </div>
                <p className="font-poppins font-bold text-primary whitespace-nowrap">₹{Number(offer.amount || 0).toLocaleString("en-IN")}</p>
              </div>

              {offer.status === "countered" ? (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handleAccept(offer.id)}
                    disabled={busyId === offer.id}
                    className="flex-1 py-1.5 text-xs font-semibold bg-success text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => { setCounterFor(offer); setCounterAmount(String(offer.amount || "")); }}
                    disabled={busyId === offer.id}
                    className="flex-1 py-1.5 text-xs font-semibold border border-primary/30 text-primary rounded-md hover:bg-primary-50 transition-colors disabled:opacity-50"
                  >
                    Counter
                  </button>
                  <button
                    onClick={() => handleReject(offer.id)}
                    disabled={busyId === offer.id}
                    className="flex-1 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 mt-1">Waiting for broker's response...</p>
              )}

              {counterFor?.id === offer.id && (
                <div className="mt-2.5 pt-2.5 border-t border-neutral-100">
                  <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">Your counter-offer</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="flex-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-primary min-w-0"
                    />
                    <button
                      onClick={submitCounter}
                      disabled={busyId === offer.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => setCounterFor(null)}
                      className="px-3 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {offer.offerHistory?.length > 1 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-neutral-400 cursor-pointer select-none">Negotiation history ({offer.offerHistory.length})</summary>
                  <div className="mt-1.5 space-y-1">
                    {offer.offerHistory.map((entry, i) => (
                      <p key={i} className="text-[11px] text-neutral-400">
                        {entry.by === "client" ? "You" : "Broker"} offered <span className="font-medium text-neutral-600">₹{Number(entry.amount || 0).toLocaleString("en-IN")}</span>
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingDetailSheet({ booking, onCancel, onPayNow, onRateNow, onDisputeNow, onOfferAccepted }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [loadingPod, setLoadingPod] = useState(false);
  // Report a Problem — available for any active or recently-completed booking; not
  // useful for one that's only just been requested (nothing has happened yet) or cancelled.
  const isDisputable = !["Requested", "Cancelled"].includes(booking.status);

  const viewProofOfDelivery = async () => {
    if (!booking.podUrl || loadingPod) return;
    setLoadingPod(true);
    try {
      const blobUrl = await api.getFileBlobUrl(booking.podUrl, getToken());
      window.open(blobUrl, "_blank");
    } catch (err) {
      toast.error(err?.message || "Failed to load proof of delivery");
    } finally {
      setLoadingPod(false);
    }
  };
  const isLive = LIVE_STATUSES.includes(booking.status);
  const isCancellable = booking.status === "Requested";
  const isPayable = booking.paymentStatus === "Pending" && booking.status !== "Cancelled";
  // Client Rating — offered once a delivery is done and not yet rated.
  const isRatable = ["Delivered", "Completed"].includes(booking.status) && !booking.rating;

  const copyId = () => {
    navigator.clipboard?.writeText(bookingRef(booking));
    toast.info("Booking ID copied");
  };

  const handleCancelClick = async () => {
    setCancelling(true);
    await onCancel();
    setCancelling(false);
  };

  // Only draw connector lines between steps that are actually rendered/visible.
  const visibleSteps = TIMELINE_STEPS.map((step, index) => ({ step, index }))
    .filter(({ index }) => index <= Math.min(booking.currentStep + 1, TIMELINE_STEPS.length - 1));

  return (
    <div>
      {/* Gradient Header Banner */}
      <div
        className="-mx-5 md:-mx-6 -mt-4 px-5 md:px-6 pt-5 pb-6 mb-5 text-white rounded-t-none"
        style={{ background: "linear-gradient(135deg, #1565C0 0%, #1976FF 100%)" }}
      >
        <div className="flex items-start justify-between mb-4 pr-6">
          <div>
            <button
              onClick={copyId}
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
            >
              <span className="font-poppins font-semibold text-base">{bookingRef(booking)}</span>
              <Copy className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-sm font-medium">{booking.pickup}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/70" />
              <span className="text-sm font-medium">{booking.drop}</span>
            </div>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm whitespace-nowrap">
            {booking.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg py-2 px-3">
            <p className="text-[10px] text-white/70 flex items-center gap-1"><Ruler className="w-3 h-3" /> Distance</p>
            <p className="text-sm font-semibold mt-0.5">{booking.distance ? `${booking.distance} km` : "—"}</p>
          </div>
          <div className="bg-white/10 rounded-lg py-2 px-3">
            <p className="text-[10px] text-white/70 flex items-center gap-1"><Truck className="w-3 h-3" /> Truck</p>
            <p className="text-sm font-semibold mt-0.5 truncate">{booking.truckType || "—"}</p>
          </div>
          <div className="bg-white/10 rounded-lg py-2 px-3">
            <p className="text-[10px] text-white/70">Amount</p>
            <p className="text-sm font-semibold mt-0.5">₹{booking.amount.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Horizontal Status Timeline */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Status Timeline</p>
        <div className="flex items-start overflow-x-auto no-scrollbar pb-1">
          {visibleSteps.map(({ step, index }, i) => {
            const isCompleted = index < booking.currentStep;
            const isCurrent = index === booking.currentStep;
            const isLast = i === visibleSteps.length - 1;

            return (
              <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"} min-w-[64px]`}>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? "bg-success" : isCurrent ? "bg-primary" : "border-2 border-neutral-200 bg-white"
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 text-center whitespace-nowrap ${
                      isCompleted ? "text-success font-medium" : isCurrent ? "text-primary font-semibold" : "text-neutral-300"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${isCompleted ? "bg-success" : "bg-neutral-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        {booking.currentStep < TIMELINE_STEPS.length && (
          <p className="text-[11px] text-neutral-400 mt-2">
            Current Status: <span className="font-medium text-primary">{TIMELINE_STEPS[booking.currentStep]}</span>
          </p>
        )}
      </div>

      {/* Direct-driver request + Broker Offers — negotiation is only live while the booking is
          still awaiting a broker/driver. The direct-driver panel renders nothing on its own
          once there's no in-flight request (or it's been declined/timed out), so brokers'
          offers surface underneath it either way. DriverRequestPanel also has to cover
          "Confirmed" (not just "Requested"): a broker-assigned driver negotiation only starts
          once a broker has already been picked, i.e. after the booking has moved past
          "Requested" — see job.controller.js's assignDriver. OffersPanel (broker-vs-client price
          negotiation) doesn't apply anymore by that point, so it stays "Requested"-only. */}
      {["Requested", "Confirmed"].includes(booking.status) && (
        <DriverRequestPanel booking={booking} onAccepted={onOfferAccepted} />
      )}
      {booking.status === "Requested" && (
        <OffersPanel booking={booking} onAccepted={onOfferAccepted} />
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoTile icon={User} label="Client" name={booking.clientName || "You"} tint="primary" />
        {booking.broker && <InfoTile icon={Building2} label="Broker" name={booking.broker} tint="primary" />}
        {booking.driver?.name && (
          <InfoTile icon={User} label="Driver" name={booking.driver.name} sub={booking.driver.phone} tint="success" />
        )}
        {booking.truckReg && (
          <InfoTile icon={Truck} label="Truck" name={booking.truckReg} sub={booking.truckType} tint="warning" />
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
      <div className="bg-primary-50 rounded-lg p-3 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-neutral-500">Total Amount</span>
          <span className="font-poppins font-bold text-lg text-primary">
            ₹{booking.amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-neutral-500">Payment Status</span>
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

      {/* Proof of Delivery */}
      {booking.podUrl && (
        <button
          onClick={viewProofOfDelivery}
          disabled={loadingPod}
          className="w-full flex items-center gap-2.5 bg-neutral-50 rounded-lg p-3 mb-4 hover:bg-neutral-100 transition-colors disabled:opacity-60"
        >
          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <Camera className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-neutral-700">{loadingPod ? "Loading..." : "View Proof of Delivery"}</span>
        </button>
      )}

      {/* Client Rating */}
      {booking.rating && (
        <div className="bg-neutral-50 rounded-lg p-3 mb-4">
          <p className="text-[10px] text-neutral-400 mb-1.5">Your Rating</p>
          <div className="flex items-center gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={`w-4 h-4 ${value <= booking.rating.stars ? "fill-warning text-warning" : "text-neutral-200"}`}
              />
            ))}
          </div>
          {booking.rating.review && (
            <p className="text-sm text-neutral-600">{booking.rating.review}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {isRatable && (
          <button
            onClick={onRateNow}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-warning text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Star className="w-4 h-4" />
            Rate this Delivery
          </button>
        )}
        {isPayable && (
          <button
            onClick={onPayNow}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <CreditCard className="w-4 h-4" />
            Pay Now
          </button>
        )}
        {isLive && (
          <button
            onClick={() => navigate(`/track?bookingId=${booking.id}`)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Track Live
          </button>
        )}
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <Download className="w-4 h-4" />
          Download Invoice
        </button>
        {isDisputable && (
          <button
            onClick={onDisputeNow}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Report a Problem
          </button>
        )}
        {isCancellable && (
          <button
            onClick={handleCancelClick}
            disabled={cancelling}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
