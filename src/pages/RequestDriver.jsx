import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Tag, Clock3, Check, Truck, AlertTriangle } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { setStoredDriverRequestId, clearStoredDriverRequestId } from "../utils";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

// Socket push (see useDriverRequestSocket) is now the primary way this screen updates —
// polling stays on as a fallback in case the socket connection drops, just at a longer
// interval since it's no longer doing the real-time work.
const POLL_MS = 15000;

const statusLabel = (request) => {
  if (request.status === "countered") return "Driver countered — your turn";
  if (request.status === "declined") return "No longer available";
  if (request.status === "accepted") return "Confirmed";
  return request.driverTimedOut ? "No response yet — their broker has been notified" : "Waiting for the driver to respond";
};

// Rendered as step 5 of the booking wizard (BookTruck.jsx) whenever a specific truck was picked
// in Step 3 and POST /api/bookings/:id/request-truck succeeded — the direct-negotiation
// counterpart to ChooseBroker.jsx. Parallel to the broker-broadcast flow, not a replacement:
// the booking was already broadcast to brokers when it was created, so if this driver declines,
// times out, or the client gives up waiting, onFallbackToBrokers() just switches the wizard over
// to ChooseBroker — nothing needs to be re-created.
export default function RequestDriver({ bookingId, bookingNumber, askingPrice, pickup, drop, initialRequest, onBack, onFallbackToBrokers }) {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [request, setRequest] = useState(initialRequest);
  const [acting, setActing] = useState(false);
  const pollRef = useRef(null);

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

  useDriverRequestSocket((updated) => {
    if (updated?.id === request.id) setRequest(updated);
  });

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
      toast.success(`Confirmed with ${res.data?.request?.driverName || "this driver"}!`);
    } catch (err) {
      toast.error(err?.message || "This request is no longer available — showing broker offers instead.");
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
      toast.info("Declined — showing broker offers instead");
      onFallbackToBrokers();
    } catch (err) {
      toast.error(err?.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  };

  const isTerminalDeclined = request.status === "declined";
  const isConfirmed = request.status === "accepted";

  return (
    <>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0"
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

        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-card p-6 md:p-8 text-center">
          {isConfirmed ? (
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
                <button onClick={() => navigate("/track")} className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors">
                  Track Booking
                </button>
                <button onClick={() => navigate("/")} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors">
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
                Brokers were already notified when you created this booking — let's see who's responded.
              </p>
              <button
                onClick={onFallbackToBrokers}
                className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                See Broker Offers
              </button>
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
                <button
                  onClick={openNegotiate}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                >
                  <Tag className="w-4 h-4" /> {request.status === "countered" ? "Counter" : "Propose a Different Price"}
                </button>
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

              {request.status !== "countered" && (
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

      {/* Negotiate sheet */}
      <BottomSheet isOpen={!!negotiate} onClose={closeNegotiate}>
        {negotiate?.stage === "set" && (
          <div>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Negotiate with {request.driverName || "this driver"}</h3>
            <p className="text-sm text-neutral-400 mb-6">Use the slider to set your offer amount.</p>

            <div className="bg-neutral-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-neutral-700">Offer price</span>
                <span className="font-poppins font-bold text-xl text-success">₹{offerAmount.toLocaleString("en-IN")}</span>
              </div>
              <input
                type="range"
                min={negotiate.min}
                max={negotiate.max}
                value={offerAmount}
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                className="w-full accent-success"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-neutral-400">₹{negotiate.min.toLocaleString("en-IN")}</span>
                <span className="text-xs text-neutral-400">₹{negotiate.max.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <button
              onClick={submitNegotiate}
              disabled={acting}
              className="w-full py-3 bg-success text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {acting ? "Sending..." : "Send Offer"}
            </button>
          </div>
        )}

        {negotiate?.stage === "sent" && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-4">
              <Clock3 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Offer sent to {request.driverName || "the driver"}</h3>
            <p className="text-sm text-neutral-400 mb-6">
              We'll update this screen automatically once they respond — this can take a little while, unlike an instant demo reply.
            </p>
            <button onClick={closeNegotiate} className="w-full py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
              Back
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
