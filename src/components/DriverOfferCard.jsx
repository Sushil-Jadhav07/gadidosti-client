import React, { useState } from "react";
import { Phone, Tag, Clock3, Truck, CheckCircle2, ChevronDown } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";

const statusMeta = (request) => {
  if (request.status === "awaiting_confirmation") {
    return request.pendingConfirmationBy === "client"
      ? { label: "Your turn to confirm", tone: "bg-primary-50 text-primary" }
      : { label: "Waiting for them to confirm", tone: "bg-neutral-100 text-neutral-500" };
  }
  if (request.status === "countered") return { label: "Countered — your turn", tone: "bg-amber-50 text-warning" };
  if (request.status === "accepted") return { label: "Confirmed", tone: "bg-green-50 text-success" };
  return {
    label: request.driverTimedOut ? "No response — broker notified" : "Waiting for response",
    tone: "bg-neutral-100 text-neutral-500",
  };
};

// One independently-negotiable offer card — rendered once per live (non-declined) driver_requests
// row inside DriverFanOutWaiting's step-5 list. Unlike the old single-promoted <RequestDriver>
// card, every nearby driver who's responded gets one of these at the same time, and the client can
// accept/counter/decline each on its own; the parent only takes over the whole screen once one of
// them actually reaches "accepted" (both sides committed).
export default function DriverOfferCard({ request, askingPrice, onChange }) {
  const toast = useToast();
  const token = getToken();
  const [acting, setActing] = useState(false);
  const [negotiate, setNegotiate] = useState(null); // { min, max, stage: 'set' | 'sent' }
  const [offerAmount, setOfferAmount] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const amount = Number(request.amount || askingPrice || 0);
  const meta = statusMeta(request);

  const isYourTurnToConfirm = request.status === "awaiting_confirmation" && request.pendingConfirmationBy === "respondent";
  const isWaitingOnThem = request.status === "awaiting_confirmation" && request.pendingConfirmationBy === "client";
  const canCounter = request.status === "pending" || request.status === "countered";

  const openNegotiate = () => {
    const base = amount;
    const min = Math.round(base * 0.78);
    setOfferAmount(base);
    setNegotiate({ min, max: Math.max(base, min + 1), stage: "set" });
  };
  const closeNegotiate = () => setNegotiate(null);

  const handleAccept = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-accept`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to confirm this driver");
      const updated = res.data?.request;
      if (updated) onChange(updated);
      const driverName = updated?.driverName || "this driver";
      toast.success(updated?.status === "accepted" ? `Confirmed with ${driverName}!` : `Accepted — waiting for ${driverName} to also confirm.`);
    } catch (err) {
      toast.error(err?.message || "This offer is no longer available.");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-reject`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to decline");
      onChange({ ...request, status: "declined" });
      toast.info(`Declined ${request.driverName || "this driver"} — still waiting on the rest.`);
    } catch (err) {
      toast.error(err?.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  };

  const submitNegotiate = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/driver-requests/${request.id}/client-counter`, { amount: offerAmount }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send offer");
      if (res.data?.request) onChange(res.data.request);
      setNegotiate((current) => (current ? { ...current, stage: "sent" } : current));
    } catch (err) {
      toast.error(err?.message || "Failed to send offer");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-white border border-neutral-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate">{request.driverName || "Driver"}</p>
            {(request.truckReg || request.driverPhone) && (
              <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                {request.truckReg && <span>{request.truckReg}</span>}
                {request.truckReg && request.driverPhone && <span>·</span>}
                {request.driverPhone && (
                  <span className="flex items-center gap-0.5">
                    <Phone className="w-2.5 h-2.5" /> {request.driverPhone}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${meta.tone}`}>
          <Clock3 className="w-2.5 h-2.5" /> {meta.label}
        </span>
      </div>

      {negotiate?.stage === "set" ? (
        <>
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Current Offer</p>
          <p className="font-poppins font-bold text-xl text-primary mb-2">₹{amount.toLocaleString("en-IN")}</p>
          <input
            type="range"
            min={negotiate.min}
            max={negotiate.max}
            value={offerAmount}
            onChange={(e) => setOfferAmount(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex items-center justify-between mt-1 mb-2">
            <span className="text-[11px] text-neutral-400">₹{negotiate.min.toLocaleString("en-IN")}</span>
            <span className="text-[11px] text-neutral-400">₹{negotiate.max.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-xs font-medium text-warning mb-3">Your Counter-Offer: ₹{offerAmount.toLocaleString("en-IN")}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={submitNegotiate}
              disabled={acting}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {acting ? "Sending..." : "Send Offer"}
            </button>
            <button onClick={closeNegotiate} className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline transition-colors px-2">
              Cancel
            </button>
          </div>
        </>
      ) : negotiate?.stage === "sent" ? (
        <>
          <p className="text-xs text-neutral-500 mb-3">
            Your offer of <span className="font-semibold text-primary">₹{offerAmount.toLocaleString("en-IN")}</span> was sent — this card updates automatically once {request.driverName || "they"} respond.
          </p>
          <button
            onClick={closeNegotiate}
            className="w-full py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Back
          </button>
        </>
      ) : request.status === "accepted" ? (
        <div className="flex items-center gap-2 text-success text-sm font-medium py-1">
          <CheckCircle2 className="w-4 h-4" /> Confirmed — opening your booking...
        </div>
      ) : isWaitingOnThem ? (
        <p className="text-xs text-neutral-500">
          You accepted at <span className="font-semibold text-primary">₹{amount.toLocaleString("en-IN")}</span> — waiting for {request.driverName || "the driver"} to confirm.
        </p>
      ) : (
        <>
          <p className="font-poppins font-bold text-xl text-primary mb-3">₹{amount.toLocaleString("en-IN")}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAccept}
              disabled={acting}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {isYourTurnToConfirm ? "Confirm" : request.status === "countered" ? "Accept This Price" : "Confirm Now"}
            </button>
            {canCounter && (
              <button
                onClick={openNegotiate}
                disabled={acting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
              >
                <Tag className="w-3.5 h-3.5" /> Counter
              </button>
            )}
            <button
              onClick={handleReject}
              disabled={acting}
              className="py-2 px-3 text-xs font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        </>
      )}

      {request.offerHistory?.length > 1 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            Negotiation history ({request.offerHistory.length})
          </button>
          {historyOpen && (
            <div className="mt-1.5 space-y-1">
              {request.offerHistory.map((entry, i) => (
                <p key={i} className="text-[11px] text-neutral-400">
                  {entry.by === "client" ? "You" : entry.by === "broker" ? "Broker" : "Driver"} offered{" "}
                  <span className="font-medium text-neutral-600">₹{Number(entry.amount || 0).toLocaleString("en-IN")}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
