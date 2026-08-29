import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Download, Mail, XCircle, Truck, Copy, User, Building2,
  Navigation, Ruler, AlertTriangle, RefreshCw, CreditCard, Star, Camera, Handshake, Phone, Tag, Clock3, Share2, MapPin,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import PaymentSheet from "../components/PaymentSheet";
import MapView from "../components/MapView";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef, TIMELINE_STEPS, getStoredDriverRequestId, setStoredDriverRequestId, clearStoredDriverRequestId, shareInvoicePdf } from "../utils";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

const LIVE_STATUSES = ["Assigned", "En Route", "Picked Up", "In Transit"];
const INVOICE_READY_STATUSES = ["Delivered", "Completed"];
const OFFERS_POLL_INTERVAL_MS = 6000;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Mirrors ADVANCE_PAYMENT_THRESHOLD in gadidosti-backend's booking.controller.js and
// RequestDriver.jsx — above this, Pay Later isn't offered (this page's Pay Now button always
// pays in full, so there's no advance option to offer here, only the later-tab to hide).
const ADVANCE_PAYMENT_THRESHOLD = 5000;

// Full page for a single booking — replaces the old BottomSheet-based detail modal so there's
// room for a real map of the pickup/drop route (a modal was too cramped for that) and a proper
// shareable URL (/bookings/:id) instead of client-only sheet state.
export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const token = getToken();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [showDisputeSheet, setShowDisputeSheet] = useState(false);
  const [showEmailSheet, setShowEmailSheet] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [loadingPod, setLoadingPod] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [sharingInvoice, setSharingInvoice] = useState(false);

  const loadBooking = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/api/bookings/${id}`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to load booking");
      setBooking(adaptBooking(res.data?.booking));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async (reason) => {
    if (!booking) return;
    const res = await api.patch(`/api/bookings/${booking.id}/cancel`, { reason }, token);
    if (!res?.success) throw new Error(res?.message || "This booking can no longer be cancelled");
    setBooking((current) => (current ? { ...current, status: "Cancelled", paymentStatus: current.paymentStatus === "Paid" ? "Refunded" : current.paymentStatus } : current));
    setShowCancelSheet(false);
    toast.success("Booking cancelled");
  };

  const handlePaySuccess = async () => {
    setShowPaymentSheet(false);
    if (!booking) return;
    try {
      const res = await api.patch(`/api/bookings/${booking.id}/pay`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to record payment");
      setBooking((current) => (current ? { ...current, paymentStatus: "Paid" } : current));
      toast.success("Payment recorded — thank you!");
    } catch (err) {
      toast.error(err?.message || "Failed to record payment");
    }
  };

  const handleRateSubmit = async ({ stars, review }) => {
    if (!booking) return;
    const res = await api.post(`/api/bookings/${booking.id}/rate`, { stars, review }, token);
    if (!res?.success) throw new Error(res?.message || "Failed to submit rating");
    const rating = res.data?.rating;
    setBooking((current) => (current ? { ...current, rating } : current));
    setShowRateSheet(false);
    toast.success("Thanks for rating your delivery!");
  };

  const handleDisputeSubmit = async ({ issueType, description }) => {
    if (!booking) return;
    const res = await api.post("/api/disputes", { booking_id: booking.id, issue_type: issueType, description }, token);
    if (!res?.success) throw new Error(res?.message || "Failed to raise dispute");
    setShowDisputeSheet(false);
    toast.success("Dispute raised — our team will review it shortly.");
  };

  // A broker/driver offer was accepted from one of the negotiation panels below — the booking
  // is now confirmed, so just refresh it in place (no sheet to close anymore).
  const handleOfferAccepted = async () => {
    await loadBooking();
  };

  const handleShareInvoice = async () => {
    if (sharingInvoice || !booking) return;
    setSharingInvoice(true);
    try {
      const blob = await api.getFileBlob(`${API_BASE}/api/bookings/${booking.id}/invoice`, token);
      await shareInvoicePdf({
        blob,
        filename: `invoice-${bookingRef(booking)}.pdf`,
        text: `Invoice for ${bookingRef(booking)} (${booking.pickup || ""} → ${booking.drop || ""}) — see attached.`,
      });
    } catch (err) {
      if (err?.name !== "AbortError") toast.error(err?.message || "Failed to share invoice");
    } finally {
      setSharingInvoice(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (downloadingInvoice || !booking) return;
    setDownloadingInvoice(true);
    try {
      const blobUrl = await api.getFileBlobUrl(`${API_BASE}/api/bookings/${booking.id}/invoice`, token);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `invoice-${bookingRef(booking)}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(err?.message || "Failed to download invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const viewProofOfDelivery = async () => {
    if (!booking?.podUrl || loadingPod) return;
    setLoadingPod(true);
    try {
      const blobUrl = await api.getFileBlobUrl(booking.podUrl, token);
      window.open(blobUrl, "_blank");
    } catch (err) {
      toast.error(err?.message || "Failed to load proof of delivery");
    } finally {
      setLoadingPod(false);
    }
  };

  const copyId = () => {
    if (!booking) return;
    navigator.clipboard?.writeText(bookingRef(booking));
    toast.info("Booking ID copied");
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 animate-page-enter">
        <div className="bg-white rounded-xl shadow-card flex flex-col items-center justify-center py-24">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-400">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="p-4 md:p-8 animate-page-enter">
        <div className="bg-white rounded-xl shadow-card flex flex-col items-center justify-center py-24">
          <AlertTriangle className="w-12 h-12 text-danger/40 mb-3" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">Couldn't load this booking</h3>
          <p className="text-sm text-neutral-400 mb-4">It may not exist, or you don't have access to it.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={loadBooking}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
            <button
              onClick={() => navigate("/bookings")}
              className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Back to My Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLive = LIVE_STATUSES.includes(booking.status);
  // Cancellable any time before cargo is actually picked up — including after a driver has
  // already taken the job (Confirmed/Assigned/En Route), not just while still "Requested".
  // Past that point, use Report a Problem instead.
  const isCancellable = ["Requested", "Confirmed", "Assigned", "En Route"].includes(booking.status);
  const isPayable = ["Pending", "Partial"].includes(booking.paymentStatus) && booking.status !== "Cancelled";
  const isRatable = ["Delivered", "Completed"].includes(booking.status) && !booking.rating;
  const isDisputable = !["Requested", "Cancelled"].includes(booking.status);

  const visibleSteps = TIMELINE_STEPS.map((step, index) => ({ step, index }))
    .filter(({ index }) => index <= Math.min(booking.currentStep + 1, TIMELINE_STEPS.length - 1));

  const hasPickupCoords = booking.pickupLat != null && booking.pickupLng != null;
  const hasDropCoords = booking.dropLat != null && booking.dropLng != null;

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      {/* Back header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/bookings")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-card text-neutral-500 hover:text-neutral-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Booking Details</h1>
          <button onClick={copyId} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            {bookingRef(booking)} <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6 items-start">
        {/* Left: booking detail content */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-5 md:p-6">
            {/* Route + at-a-glance stats */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex flex-col items-center pt-1 pb-1 flex-shrink-0 w-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1" />
                  <MapPin className="w-3.5 h-3.5 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                </div>
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Pickup</p>
                    <p className="text-sm font-semibold text-neutral-800 truncate">{booking.pickup || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Drop-off</p>
                    <p className="text-sm font-semibold text-neutral-800 truncate">{booking.drop || "—"}</p>
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary whitespace-nowrap flex-shrink-0">
                {booking.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-neutral-50 rounded-lg py-2 px-3">
                <p className="text-[10px] text-neutral-400 flex items-center gap-1"><Ruler className="w-3 h-3" /> Distance</p>
                <p className="text-sm font-semibold text-neutral-700 mt-0.5">{booking.distance ? `${booking.distance} km` : "—"}</p>
              </div>
              <div className="bg-neutral-50 rounded-lg py-2 px-3">
                <p className="text-[10px] text-neutral-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> Transport Type</p>
                <p className="text-sm font-semibold text-neutral-700 mt-0.5">{booking.transportType === "intra" ? "Intra-City" : "Inter-City"}</p>
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

            {/* Direct-driver request + Broker Offers */}
            {["Requested", "Confirmed"].includes(booking.status) && (
              <DriverRequestPanel booking={booking} onAccepted={handleOfferAccepted} />
            )}
            {booking.status === "Requested" && (
              <OffersPanel booking={booking} onAccepted={handleOfferAccepted} />
            )}

            {/* Load Details — three separate small boxes */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Load Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-400">Weight</p>
                  <p className="text-sm font-medium text-neutral-700 mt-0.5">{booking.weight} {booking.weightUnit}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-400">Material</p>
                  <p className="text-sm font-medium text-neutral-700 mt-0.5 truncate">{booking.material || "—"}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-400">Quantity</p>
                  <p className="text-sm font-medium text-neutral-700 mt-0.5">{booking.quantity} items</p>
                </div>
              </div>
            </div>

            {/* Stakeholders + Asset Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Stakeholders</p>
                <div className="space-y-2">
                  <InfoRow icon={User} label="Client" value={booking.clientName || "You"} />
                  {booking.broker && <InfoRow icon={Building2} label="Broker" value={booking.broker} />}
                </div>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Asset Details</p>
                <div className="space-y-2">
                  {booking.driver?.name ? (
                    <InfoRow icon={User} label="Driver" value={booking.driver.name} sub={booking.driver.phone} />
                  ) : (
                    <InfoRow icon={User} label="Driver" value="Not yet assigned" />
                  )}
                  {booking.truckReg ? (
                    <InfoRow icon={Truck} label="Vehicle" value={booking.truckReg} sub={booking.truckType} />
                  ) : (
                    <InfoRow icon={Truck} label="Vehicle" value={booking.truckType || "Not yet assigned"} />
                  )}
                </div>
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

            {/* Actions — a grid instead of flex-wrap so every button gets the same height
                regardless of how many lines its label wraps to (mixing fixed-width and
                flex-1 buttons in one flex-wrap row let e.g. "Download Invoice" wrap to two
                lines while its neighbors stayed single-line, making the row look uneven). */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isRatable && (
                <button
                  onClick={() => setShowRateSheet(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-warning text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Star className="w-4 h-4 flex-shrink-0" />
                  Rate Delivery
                </button>
              )}
              {isPayable && (
                <button
                  onClick={() => setShowPaymentSheet(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-success text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  {booking.paymentStatus === "Partial" ? "Pay Remaining" : "Pay Now"}
                </button>
              )}
              {isLive && (
                <button
                  onClick={() => navigate(`/track?bookingId=${booking.id}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  <Navigation className="w-4 h-4 flex-shrink-0" />
                  Track Live
                </button>
              )}
              {INVOICE_READY_STATUSES.includes(booking.status) && (
                <>
                  <button
                    onClick={handleDownloadInvoice}
                    disabled={downloadingInvoice}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                  >
                    <Download className="w-4 h-4 flex-shrink-0" />
                    {downloadingInvoice ? "Downloading..." : "Download"}
                  </button>
                  <button
                    onClick={() => setShowEmailSheet(true)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    Email Copy
                  </button>
                  <button
                    onClick={handleShareInvoice}
                    disabled={sharingInvoice}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                  >
                    <Share2 className="w-4 h-4 flex-shrink-0" />
                    {sharingInvoice ? "Preparing..." : "Share"}
                  </button>
                </>
              )}
            </div>
            {!INVOICE_READY_STATUSES.includes(booking.status) && (
              <p className="text-center text-xs text-neutral-400 italic mt-3">Invoice available once delivery is complete</p>
            )}
          </div>
        </div>

        {/* Right: Route map + Financial Summary */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-5">
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="p-4 border-b border-neutral-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Live Route
              </p>
              {(booking.pickup || hasPickupCoords) && (booking.drop || hasDropCoords) && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${
                    hasPickupCoords ? `${booking.pickupLat},${booking.pickupLng}` : encodeURIComponent(booking.pickup)
                  }&destination=${
                    hasDropCoords ? `${booking.dropLat},${booking.dropLng}` : encodeURIComponent(booking.drop)
                  }`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  Full Screen <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
            <MapView
              routes={[{
                id: booking.id,
                origin: hasPickupCoords ? { lat: Number(booking.pickupLat), lng: Number(booking.pickupLng) } : booking.pickup,
                destination: hasDropCoords ? { lat: Number(booking.dropLat), lng: Number(booking.dropLng) } : booking.drop,
                originLabel: booking.pickup,
                destinationLabel: booking.drop,
              }]}
              height="280px"
            />
          </div>

          {/* Financial Summary — real fields off the pricing breakdown stored at booking-creation
              time (same shape BookTruck's own Cost Breakdown reads from /api/bookings/quote);
              falls back to just the total when an older/manually-priced booking has none. */}
          <div className="bg-white rounded-2xl shadow-card p-4 md:p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Financial Summary</p>
            {booking.pricing ? (
              <div className="space-y-2 mb-3">
                {booking.pricing.baseFare != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Base Rate</span>
                    <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(booking.pricing.baseFare).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {booking.pricing.distanceFare != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Distance Fare</span>
                    <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(booking.pricing.distanceFare).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {booking.pricing.totalTruckCost != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Truck Cost</span>
                    <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(booking.pricing.totalTruckCost).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {!!booking.pricing.trafficSurcharge && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Traffic Surcharge</span>
                    <span className="text-xs font-medium text-amber-600 tabular-nums">+₹{Number(booking.pricing.trafficSurcharge).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {booking.pricing.platformFee != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Taxes &amp; Fees</span>
                    <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(booking.pricing.platformFee).toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <span className="text-sm font-semibold text-neutral-800">Total</span>
              <span className="font-poppins font-bold text-lg text-primary tabular-nums">₹{booking.amount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
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

            {(isCancellable || isDisputable) && (
              <div className="flex gap-3 mt-4 pt-4 border-t border-neutral-100">
                {isCancellable && (
                  <button
                    onClick={() => setShowCancelSheet(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Cancel Booking
                  </button>
                )}
                {isDisputable && (
                  <button
                    onClick={() => setShowDisputeSheet(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" /> Contact Support
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentSheet
        open={showPaymentSheet}
        // A "Partial" booking already paid its 20% advance — charge only what's actually left,
        // not the full original amount again (amountPaid comes from the same booking projection
        // that already powers the payment-status badge above).
        amount={booking.paymentStatus === "Partial" ? Number(booking.amount) - Number(booking.amountPaid || 0) : booking.amount}
        phone={user?.phone}
        onClose={() => setShowPaymentSheet(false)}
        onSuccess={handlePaySuccess}
        onPayLater={() => { setShowPaymentSheet(false); toast.info("You can pay anytime from this page."); }}
        allowPayLater={booking.paymentStatus !== "Partial" && Number(booking.amount) <= ADVANCE_PAYMENT_THRESHOLD}
      />

      <BottomSheet isOpen={showRateSheet} onClose={() => setShowRateSheet(false)}>
        <RateDeliverySheet booking={booking} onSubmit={handleRateSubmit} onCancel={() => setShowRateSheet(false)} />
      </BottomSheet>

      <BottomSheet isOpen={showDisputeSheet} onClose={() => setShowDisputeSheet(false)}>
        <RaiseDisputeSheet booking={booking} onSubmit={handleDisputeSubmit} onCancel={() => setShowDisputeSheet(false)} />
      </BottomSheet>

      <BottomSheet isOpen={showCancelSheet} onClose={() => setShowCancelSheet(false)}>
        <CancelBookingSheet booking={booking} onSubmit={handleCancel} onCancel={() => setShowCancelSheet(false)} />
      </BottomSheet>

      <BottomSheet isOpen={showEmailSheet} onClose={() => setShowEmailSheet(false)}>
        <EmailInvoiceSheet booking={booking} defaultTo={user?.email || ""} onClose={() => setShowEmailSheet(false)} />
      </BottomSheet>
    </div>
  );
}

// Manual send only — never auto-sent. To starts pre-filled with the client's own profile
// email (so "email me a copy" is a one-tap default) but stays fully editable, same as
// subject/message.
function EmailInvoiceSheet({ booking, defaultTo, onClose }) {
  const toast = useToast();
  const [to, setTo] = useState(defaultTo || "");
  const [subject, setSubject] = useState(`Invoice for booking ${bookingRef(booking)}`);
  const [message, setMessage] = useState(`Hi,\n\nPlease find attached the invoice for booking ${bookingRef(booking)}.\n\nThanks,\nGadiDost`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !message.trim()) {
      toast.error("To, subject, and message are all required");
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/api/bookings/${booking.id}/invoice/email`, { to: to.trim(), subject: subject.trim(), message: message.trim() }, getToken());
      if (!res?.success) throw new Error(res?.message || "Failed to send invoice");
      toast.success("Invoice emailed.");
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to send invoice");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Email Invoice</h3>
      <p className="text-sm text-neutral-400 mb-5">{booking.pickup} → {booking.drop}</p>

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">To</label>
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
      />

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Subject</label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
      />

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Message</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
      />

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
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

// Asks for a reason before cancelling — sent to whichever driver/broker is currently assigned
// so they know why, not just that it happened. Same shape as RaiseDisputeSheet above.
function CancelBookingSheet({ booking, onSubmit, onCancel }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please tell us why you're cancelling");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      toast.error(err?.message || "Failed to cancel booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Cancel this booking?</h3>
      <p className="text-sm text-neutral-400 mb-5">
        {booking.pickup} → {booking.drop}
      </p>

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Reason for cancelling</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Found another truck, plans changed, no longer needed..."
        maxLength={500}
        rows={4}
        className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
      />

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Keep Booking
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-danger text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Cancelling..." : "Confirm Cancellation"}
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

// A single labeled row (icon + label + value, optional sub-line) inside the Stakeholders/Asset
// Details cards — lighter than the old boxed InfoTile grid it replaces, since these now live
// two-to-a-card instead of each being its own standalone box.
function InfoRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-neutral-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-700 truncate">{value || "—"}</p>
        {sub && <p className="text-xs text-neutral-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

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
      if (res.data?.request?.status === "accepted") {
        clearStoredDriverRequestId(booking.id);
        toast.success("Confirmed with this driver!");
        await onAccepted?.();
      } else {
        // Mutual-confirmation: this was only the first commit — the driver/broker still needs
        // to confirm on their side before the booking is actually finalized.
        if (res.data?.request) adopt(res.data.request);
        toast.info("Accepted — waiting for the driver to confirm.");
        setActing(false);
      }
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
          ) : request.status === "awaiting_confirmation" && request.pendingConfirmationBy === "respondent" ? (
            /* ── Driver/broker already accepted — your turn, no more negotiating ── */
            <div className="mt-2">
              <p className="text-[11px] text-neutral-400 mb-2">This driver accepted — confirm to finalize.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="flex-1 py-1.5 text-xs font-semibold bg-success text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="flex-1 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ) : request.status === "awaiting_confirmation" ? (
            /* ── You already accepted — waiting for the driver/broker to also confirm ── */
            <p className="text-[11px] text-neutral-400 mt-2">
              <Clock3 className="w-3 h-3 inline mr-1" />
              You accepted — waiting for them to confirm.
            </p>
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

// Negotiation panel — one entry per broker who received this booking's job request. A broker's
// turn is 'pending' (nothing for the client to do yet); once they counter, status flips to
// 'countered' and the client can accept/reject/counter back. Polled every few seconds while the
// page is open since offers arrive in near real time, not on a client action.
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
      if (res.data?.booking) {
        toast.success("Offer accepted — booking confirmed!");
        await onAccepted?.();
      } else {
        // Mutual-confirmation: only the first commit — the broker still needs to confirm.
        const updated = res.data?.request;
        if (updated) setOffers((current) => current.map((o) => (o.id === offerId ? updated : o)));
        toast.info("Accepted — waiting for the broker to confirm.");
        setBusyId(null);
      }
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
              ) : offer.status === "awaiting_confirmation" && offer.pendingConfirmationBy === "broker" ? (
                /* ── Broker already accepted — your turn, no more negotiating ── */
                <div className="mt-2">
                  <p className="text-[11px] text-neutral-400 mb-2">This broker accepted — confirm to finalize.</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(offer.id)}
                      disabled={busyId === offer.id}
                      className="flex-1 py-1.5 text-xs font-semibold bg-success text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleReject(offer.id)}
                      disabled={busyId === offer.id}
                      className="flex-1 py-1.5 text-xs font-semibold border border-neutral-200 text-neutral-500 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ) : offer.status === "awaiting_confirmation" ? (
                <p className="text-[11px] text-neutral-400 mt-1">You accepted — waiting for them to confirm.</p>
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
