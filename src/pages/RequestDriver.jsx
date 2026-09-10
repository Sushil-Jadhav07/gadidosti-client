import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Tag, Clock3, Check, Truck, AlertTriangle, CheckCircle2, MapPin, ClipboardList } from "lucide-react";
import PaymentSheet from "../components/PaymentSheet";
import StepIndicator from "../components/StepIndicator";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";
import { setStoredDriverRequestId, clearStoredDriverRequestId, clearStoredBookingWizardState } from "../utils";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

// Socket push (see useDriverRequestSocket) is now the primary way this screen updates —
// polling stays on as a fallback in case the socket connection drops, just at a longer
// interval since it's no longer doing the real-time work.
const POLL_MS = 15000;

// Four freight payment stages a client can pick once a driver's confirmed — Pay Now (full,
// immediately), Advance (a partial amount now, rest on delivery), To Pay (nothing now, full
// amount collected by the driver on delivery — the old "Pay Later"), and To Be Billed (nothing
// now, nothing on delivery either — settled out of band later). The old hardcoded "20% above
// ₹5000" rule is gone — Advance is always offered, and its amount comes from the admin-
// configurable tiers via GET /api/bookings/:id/advance-amount (see PricingModel.computeAdvanceAmount
// in gadidosti-backend's pricing.model.js) rather than being computed here.

const statusLabel = (request) => {
  if (request.status === "countered") return "Driver countered — your turn";
  if (request.status === "declined") return "No longer available";
  if (request.status === "accepted") return "Confirmed";
  if (request.status === "awaiting_confirmation") {
    return request.pendingConfirmationBy === "client" ? "Your turn to confirm" : "Waiting for them to confirm";
  }
  return request.driverTimedOut ? "No response yet — their broker has been notified" : "Waiting for the driver to respond";
};

// The single-request negotiation card — shared by two different origins that both eventually
// narrow down to exactly one driver_requests row to negotiate:
//   variant="broker" (default) — ChooseBroker.jsx hands off here once a broker assigns a driver
//     from their fleet. onFallbackToBrokers() (declined/gave up) returns to the broker offers
//     list, since search_mode='broker' bookings have no other driver to fall back to.
//   variant="findTruck" — FindTruckSearch.jsx hands off here once ANY of the fanned-out
//     driver_requests (one per nearby driver, search_mode='truck') needs the client's attention.
//     onFallbackToBrokers() (declined) returns to that waiting list — other drivers in the same
//     fan-out may still respond, so this is "back to waiting", not "start over".
export default function RequestDriver({ bookingId, bookingNumber, askingPrice, pickup, drop, initialRequest, onBack, onFallbackToBrokers, variant = "broker" }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const token = getToken();

  const [request, setRequest] = useState(initialRequest);
  const [acting, setActing] = useState(false);
  const pollRef = useRef(null);

  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paid, setPaid] = useState(false);
  // Which button opened the sheet — decides both the amount PaymentSheet charges and what
  // pay_type the /pay call records. Set right before setShowPaymentSheet(true).
  const [paymentIntent, setPaymentIntent] = useState("full");
  // Fetched from the backend the moment the driver's confirmed — the Advance button stays
  // disabled (shows a generic label) until this resolves, since there's no longer a client-side
  // formula to fall back on.
  const [advanceAmount, setAdvanceAmount] = useState(null);
  const [markingToBeBilled, setMarkingToBeBilled] = useState(false);

  // negotiate.stage: "set" (slider) -> "sent" (waiting on the driver for real — no fake reply)
  const [negotiate, setNegotiate] = useState(null);
  const [offerAmount, setOfferAmount] = useState(0);

  useEffect(() => {
    setStoredDriverRequestId(bookingId, request.id);
  }, [bookingId, request.id]);

  const fetchRequest = async ({ silent } = {}) => {
    try {
      const res = await api.get(`/api/driver-requests/${request.id}`, token);
      if (res?.success && res.data?.request) setRequest(res.data.request);
    } catch {
      /* silent — next poll retries */
    }
  };

  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (!["accepted", "declined"].includes(request.status)) fetchRequest({ silent: true });
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  useEffect(() => {
    if (["accepted", "declined"].includes(request.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      clearStoredDriverRequestId(bookingId);
    }
  }, [request.status, bookingId]);

  // The "Offer sent — we'll update automatically" panel (negotiate.stage === "sent") is local
  // UI state, not derived from request.status — so once the driver actually responds (status
  // moves off "pending", the state it's in right after the client's own counter goes through),
  // it needs to be explicitly cleared here. Without this the poll/socket update still lands in
  // `request` correctly, but the client stays stuck looking at "Back" instead of the real
  // Accept/Counter/Reject buttons for the driver's response, until they click Back themselves.
  useEffect(() => {
    if (negotiate?.stage === "sent" && request.status !== "pending") {
      setNegotiate(null);
    }
  }, [request.status]);

  useDriverRequestSocket((updated) => {
    if (updated?.id === request.id) setRequest(updated);
  });

  // Cargo details for the Booking Summary column — not passed down from BookTruck (which would
  // mean threading them through ChooseBroker too, since this same component is also rendered
  // from there once a broker assigns a driver), so fetched directly off the booking itself.
  const [bookingDetails, setBookingDetails] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/bookings/${bookingId}`, token);
        if (!cancelled && res?.success && res.data?.booking) setBookingDetails(res.data.booking);
      } catch { /* Booking Summary just omits cargo details if this fails */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Advance amount for the Advance button — fetched the moment the driver's confirmed rather
  // than computed here, since the tiers behind it are admin-configurable now (no more client-
  // side 20% formula to fall back on). Re-fetched if the booking's final amount changes (e.g. a
  // late counter), matching how the backend recomputes it fresh on every call too.
  useEffect(() => {
    if (request.status !== "accepted") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/bookings/${bookingId}/advance-amount`, token);
        if (!cancelled && res?.success && res.data?.advanceAmount != null) {
          setAdvanceAmount(Number(res.data.advanceAmount));
        }
      } catch { /* Advance button just stays disabled if this fails */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.status, bookingId, request.amount]);

  const openNegotiate = () => {
    const base = Number(request.amount) || Number(askingPrice) || 0;
    const min = Math.round(base * 0.78);
    setOfferAmount(base);
    setNegotiate({ min, max: Math.max(base, min + 1), stage: "set" });
  };
  const closeNegotiate = () => setNegotiate(null);

  const submitNegotiate = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-counter`, { amount: offerAmount }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send offer");
      if (res.data?.request) setRequest(res.data.request);
      setNegotiate((current) => (current ? { ...current, stage: "sent" } : current));
    } catch (err) {
      toast.error(err?.message || "Failed to send offer");
    } finally {
      setActing(false);
    }
  };

  const handleAccept = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-accept`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to confirm this driver");
      if (res.data?.request) setRequest(res.data.request);
      const driverName = res.data?.request?.driverName || "this driver";
      toast.success(
        res.data?.request?.status === "accepted" ? `Confirmed with ${driverName}!` : `Accepted — waiting for ${driverName} to also confirm.`
      );
    } catch (err) {
      toast.error(err?.message || "This request is no longer available.");
      onFallbackToBrokers();
    } finally {
      setActing(false);
    }
  };

  // Only valid while status is "countered" (the backend rejects this otherwise) — a still-
  // "pending" request (driver hasn't responded yet) has no cancel endpoint, so the "not in a
  // hurry" link below just switches the wizard view instead of trying to reject anything.
  const handleReject = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-reject`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to decline");
      toast.info(variant === "findTruck" ? "Declined — checking on other nearby drivers." : "Declined — showing broker offers instead");
      onFallbackToBrokers();
    } catch (err) {
      toast.error(err?.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  };

  const handlePaySuccess = async (paidBooking) => {
    setShowPaymentSheet(false);
    if (!paidBooking) toast.error("Failed to record payment");
    setPaid(true);
  };

  const handlePayLater = () => {
    setShowPaymentSheet(false);
    setPaid(true);
  };

  // "To Be Billed" — the new third stage: nothing collected now, nothing collected on delivery
  // either, settled out of band later. Mirrors handlePayLater's own transition (booking is now
  // "confirmed" with nothing further to pay right now) but goes through a dedicated endpoint
  // instead of just skipping straight to setPaid(true), since the backend needs to record the
  // choice (and reject it if a payment choice was already made, or the booking's cancelled).
  const handleMarkToBeBilled = async () => {
    setMarkingToBeBilled(true);
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/mark-to-be-billed`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to mark this booking as to-be-billed");
      setPaid(true);
    } catch (err) {
      toast.error(err?.message || "Failed to mark this booking as to-be-billed");
    } finally {
      setMarkingToBeBilled(false);
    }
  };

  const finalAmount = Number(request.amount || askingPrice || 0);
  // Each side gets at most maxCountersPerSide counter-offers (server-enforced too — see
  // driverRequest.controller.js) — once used up, only Accept/Decline remain here.
  const clientCounterLimitReached = (request.clientCountersUsed ?? 0) >= (request.maxCountersPerSide ?? Infinity);

  const isTerminalDeclined = request.status === "declined";
  const isConfirmed = request.status === "accepted";
  // Mutual-confirmation: one side has already committed, the other must now Accept/Decline —
  // no more negotiating once here. "respondent" pending means the driver/broker already agreed
  // and it's the client's (this app's) turn; "client" pending means the client already
  // committed here and is now waiting on the driver/broker.
  const isYourTurnToConfirm = request.status === "awaiting_confirmation" && request.pendingConfirmationBy === "respondent";
  const isWaitingOnThem = request.status === "awaiting_confirmation" && request.pendingConfirmationBy === "client";

  return (
    <>
      <div>
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 md:p-8 pb-0">
          <StepIndicator currentStep={5} onStepClick={undefined} embedded />
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">
              {request.truckReg ? `Requesting truck ${request.truckReg}` : "Requesting your selected truck"}
            </h1>
          </div>
          <p className="text-sm text-neutral-400 mb-6 ml-12">
            {pickup && drop ? `${pickup} → ${drop} · ` : ""}Asking price ₹{Number(askingPrice || 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Booking Summary — route + cargo + the live offer, constant across every
              negotiation state on the right (pending, countered, confirmed, declined...). */}
          <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-neutral-100">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-4">
              <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-3.5 h-3.5 text-primary" />
              </span>
              Booking Summary
            </p>

            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1 pb-1 flex-shrink-0 w-3">
                <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1" />
                <MapPin className="w-3.5 h-3.5 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm font-semibold text-neutral-800 truncate">{pickup || bookingDetails?.pickup}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Drop-off</p>
                  <p className="text-sm font-semibold text-neutral-800 truncate">{drop || bookingDetails?.drop}</p>
                </div>
              </div>
            </div>

            {bookingDetails && (bookingDetails.material || bookingDetails.weight != null) && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-2">Cargo Details</p>
                <div className="flex items-center justify-between">
                  {bookingDetails.material && (
                    <span className="text-xs font-medium text-neutral-700">{bookingDetails.material}</span>
                  )}
                  {bookingDetails.weight != null && (
                    <span className="text-xs font-medium text-neutral-700 tabular-nums">
                      {bookingDetails.weight} {bookingDetails.weightUnit || "Tons"}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="bg-neutral-50 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Live Cost Estimate</p>
                <p className="font-poppins font-bold text-2xl text-primary tabular-nums">
                  ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-neutral-400">Current Offer</p>
              </div>
            </div>
          </div>

          {/* Right: the driver negotiation card itself. */}
          <div className="p-6 md:p-8 text-center">
          {isConfirmed && !paid ? (
            /* ── Driver confirmed — show payment step ── */
            <>
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">
                {request.driverName ? `Confirmed with ${request.driverName}` : "Driver confirmed"}
              </h2>
              <p className="text-sm text-neutral-400 mb-6">
                Final price: <span className="font-semibold text-primary">₹{finalAmount.toLocaleString("en-IN")}</span>
              </p>
              {/* Four freight payment stages — see the comment block near the top of this file. */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => { setPaymentIntent("full"); setShowPaymentSheet(true); }}
                    className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                  >
                    Pay Now
                  </button>
                  <button
                    onClick={() => { setPaymentIntent("advance"); setShowPaymentSheet(true); }}
                    disabled={advanceAmount == null}
                    className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-60"
                  >
                    {advanceAmount != null ? `Pay Advance ₹${advanceAmount.toLocaleString("en-IN")}` : "Advance…"}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handlePayLater}
                    className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
                  >
                    To Pay
                  </button>
                  <button
                    onClick={handleMarkToBeBilled}
                    disabled={markingToBeBilled}
                    className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-60"
                  >
                    {markingToBeBilled ? "..." : "To Be Billed"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-3">
                <span className="font-medium text-neutral-500">To Pay</span> — pay in full when the vehicle is unloaded.{" "}
                <span className="font-medium text-neutral-500">To Be Billed</span> — nothing collected now or on delivery, settled separately later.
              </p>
            </>
          ) : isConfirmed ? (
            <>
              <div className="animate-bounce-in mb-6 flex justify-center">
                <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center shadow-glow-green">
                  <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </div>
                </div>
              </div>
              <h2 className="font-poppins font-bold text-2xl text-success mb-2">Booking Confirmed!</h2>
              <p className="text-sm text-neutral-400 mb-6">
                {request.driverName || "Your driver"} is assigned{request.truckReg ? ` — truck ${request.truckReg}` : ""}.
              </p>
              <div className="bg-neutral-50 rounded-xl p-5 mb-6">
                <p className="text-xs text-neutral-400 mb-1">Booking ID</p>
                <p className="font-poppins font-bold text-2xl text-neutral-800">{bookingNumber}</p>
                <p className="text-sm text-neutral-400 mt-2">
                  Final price: <span className="font-semibold text-primary">₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")}</span>
                </p>
                {request.driverPhone && (
                  <p className="flex items-center justify-center gap-1 text-sm text-neutral-400 mt-1">
                    <Phone className="w-3.5 h-3.5" /> {request.driverPhone}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { clearStoredBookingWizardState(); navigate("/track"); }} className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors">
                  Track Booking
                </button>
                <button onClick={() => { clearStoredBookingWizardState(); navigate("/"); }} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors">
                  Back to Home
                </button>
              </div>
            </>
          ) : isTerminalDeclined ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-danger" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">This driver isn't available</h2>
              <p className="text-sm text-neutral-400 mb-6">
                {variant === "findTruck"
                  ? "This driver declined — other nearby drivers were notified too, let's see if any of them respond."
                  : "Brokers were already notified when you created this booking — let's see who's responded."}
              </p>
              <button
                onClick={onFallbackToBrokers}
                className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                {variant === "findTruck" ? "Back to Waiting" : "See Broker Offers"}
              </button>
            </>
          ) : isYourTurnToConfirm ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">{request.driverName || "This driver"} accepted</h2>
              {request.driverPhone && (
                <p className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-3">
                  <Phone className="w-3 h-3" /> {request.driverPhone}
                </p>
              )}
              <p className="text-sm text-neutral-400 mb-4">Confirm to finalize this booking — no further negotiation once you do.</p>
              <p className="font-poppins font-bold text-2xl text-primary mb-6">
                ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="flex-1 py-3 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </>
          ) : isWaitingOnThem ? (
            <>
              <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Clock3 className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Waiting for {request.driverName || "the driver"} to confirm</h2>
              <p className="text-sm text-neutral-400 mb-6">
                You accepted at ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")} — we'll update this screen automatically once they confirm.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">{request.driverName || "This driver"}</h2>
              {request.driverPhone && (
                <p className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-3">
                  <Phone className="w-3 h-3" /> {request.driverPhone}
                </p>
              )}

              <p
                className={`inline-flex items-center gap-1 text-[11px] font-medium mb-4 px-2.5 py-1 rounded-full ${
                  request.status === "countered" ? "bg-amber-50 text-warning" : "bg-primary-50 text-primary"
                }`}
              >
                <Clock3 className="w-3 h-3" />
                {statusLabel(request)}
              </p>

              {negotiate?.stage === "set" ? (
                /* ── Inline counter-offer slider — same card, not a popup ── */
                <>
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Current Offer</p>
                  <p className="font-poppins font-bold text-2xl text-primary mb-4">
                    ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")}
                  </p>

                  <input
                    type="range"
                    min={negotiate.min}
                    max={negotiate.max}
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex items-center justify-between mt-1 mb-3">
                    <span className="text-xs text-neutral-400">₹{negotiate.min.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-neutral-400">₹{negotiate.max.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-sm font-medium text-warning mb-4">Your Counter-Offer: ₹{offerAmount.toLocaleString("en-IN")}</p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={submitNegotiate}
                      disabled={acting}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {acting ? "Sending..." : "Send Offer"}
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={acting}
                      className="w-full py-3 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-60"
                    >
                      Confirm at ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")} Now
                    </button>
                    <button onClick={closeNegotiate} className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline transition-colors">
                      Cancel
                    </button>
                  </div>
                </>
              ) : negotiate?.stage === "sent" ? (
                /* ── Counter-offer submitted — waiting on a real reply, no fake instant one ── */
                <>
                  <p className="text-sm text-neutral-500 mb-4">
                    Your offer of <span className="font-semibold text-primary">₹{offerAmount.toLocaleString("en-IN")}</span> has been sent — we'll update this screen automatically once {request.driverName || "they"} respond.
                  </p>
                  <button
                    onClick={closeNegotiate}
                    className="w-full py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <p className="font-poppins font-bold text-2xl text-primary mb-6">
                    ₹{Number(request.amount || askingPrice || 0).toLocaleString("en-IN")}
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleAccept}
                      disabled={acting}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {request.status === "countered" ? "Accept This Price" : `Confirm at ₹${Number(request.amount || askingPrice || 0).toLocaleString("en-IN")} Now`}
                    </button>
                    {!clientCounterLimitReached && (
                      <button
                        onClick={openNegotiate}
                        disabled={acting}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                      >
                        <Tag className="w-4 h-4" /> {request.status === "countered" ? "Counter" : "Propose a Different Price"}
                      </button>
                    )}
                    {request.status === "countered" && (
                      <button
                        onClick={handleReject}
                        disabled={acting}
                        className="w-full py-3 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                  {clientCounterLimitReached && (
                    <p className="text-xs text-neutral-400 mt-3">You've used both your counter-offers — please accept the current price or find another driver.</p>
                  )}
                </>
              )}

              {variant === "broker" && request.status !== "countered" && (
                <button onClick={onFallbackToBrokers} className="mt-5 text-xs text-neutral-400 hover:text-neutral-600 hover:underline transition-colors">
                  Not in a hurry? See broker offers instead →
                </button>
              )}

              {request.offerHistory?.length > 1 && (
                <details className="mt-5 text-left">
                  <summary className="text-[11px] text-neutral-400 cursor-pointer select-none">Negotiation history ({request.offerHistory.length})</summary>
                  <div className="mt-1.5 space-y-1">
                    {request.offerHistory.map((entry, i) => (
                      <p key={i} className="text-[11px] text-neutral-400">
                        {entry.by === "client" ? "You" : entry.by === "broker" ? "Broker" : "Driver"} offered{" "}
                        <span className="font-medium text-neutral-600">₹{Number(entry.amount || 0).toLocaleString("en-IN")}</span>
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
          </div>
        </div>
      </div>

      <PaymentSheet
        open={showPaymentSheet}
        bookingId={bookingId}
        payType={paymentIntent}
        token={token}
        amount={paymentIntent === "advance" ? advanceAmount : finalAmount}
        title={paymentIntent === "advance" ? "Advance Payment" : "Price Summary"}
        phone={user?.phone}
        onClose={() => setShowPaymentSheet(false)}
        onSuccess={handlePaySuccess}
        onPayLater={handlePayLater}
        // To Pay / To Be Billed are now their own dedicated buttons above, so the sheet itself
        // never needs to also offer a "Pay Later" category — Pay Now/Advance are the only two
        // choices that actually belong inside a real checkout.
        allowPayLater={false}
      />
    </>
  );
}
