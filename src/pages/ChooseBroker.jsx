import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Phone, Tag, Clock3, Building2 } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import RequestDriver from "./RequestDriver";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { useJobRequestSocket } from "../hooks/useJobRequestSocket";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

const POLL_MS = 4000;
const DRIVER_DISCOVERY_POLL_MS = 5000;

// Real backend statuses on a job_request/"offer":
//  pending               -> broker hasn't responded yet, OR the client just proposed a number
//                            and is waiting on the broker (the same status covers both — it
//                            just means "the broker owes a response").
//  countered             -> the broker replied with a different number; it's the client's turn.
//  awaiting_confirmation -> mutual-confirmation: one side already accepted, the other must now
//                            confirm or decline (see offer.pendingConfirmationBy) — no more
//                            negotiating once here.
//  accepted              -> both sides confirmed; this broker won the booking (every other
//                            offer auto-declines).
//  declined              -> this offer is no longer live (lost the race, or was rejected).
//
// Priority used to pick the single "primary" offer to negotiate with — same single-target
// design the direct-pick flow (RequestDriver.jsx) already uses, rather than making the client
// compare a whole grid of brokers who mostly haven't even responded yet.
const RANK = { awaiting_confirmation: 3, countered: 2, pending: 1 };

// Rendered as step 6 of the same booking wizard (BookTruck.jsx) once the booking has been
// created — never routed to directly. bookingId/bookingNumber/askingPrice/pickup/drop come
// from the booking BookTruck just created; onBack resets the whole wizard back to step 1
// (there's no safe "previous step" to return to once the booking already exists — going back
// to Review and confirming again would create a second, duplicate booking).
//
// Two phases, split into two components so phase 1's hooks (offer polling, both sockets) fully
// unmount once phase 2 starts instead of lingering alongside it: (1) BrokerNegotiation —
// negotiate with a single broker at a time (whichever's furthest along) until one is confirmed
// by both sides, then discover the driver that broker assigns; (2) once discovered, this
// wrapper hands off entirely to <RequestDriver> — the exact same single-target accept/
// negotiate/mutual-confirm/payment flow the direct-pick path already uses, so the client
// experiences one continuous "accept -> wait for driver -> driver accepts -> booked" flow
// instead of a separate broker-picking page.
export default function ChooseBroker({ bookingId, bookingNumber, askingPrice, pickup, drop, onBack }) {
  const [driverRequest, setDriverRequest] = useState(null);

  if (driverRequest) {
    return (
      <RequestDriver
        bookingId={bookingId}
        bookingNumber={bookingNumber}
        askingPrice={driverRequest.amount || askingPrice}
        pickup={pickup}
        drop={drop}
        initialRequest={driverRequest}
        onBack={onBack}
        onFallbackToBrokers={() => setDriverRequest(null)}
      />
    );
  }

  return (
    <BrokerNegotiation
      bookingId={bookingId}
      askingPrice={askingPrice}
      pickup={pickup}
      drop={drop}
      onBack={onBack}
      onDriverAssigned={setDriverRequest}
    />
  );
}

function BrokerNegotiation({ bookingId, askingPrice, pickup, drop, onBack, onDriverAssigned }) {
  const toast = useToast();
  const token = getToken();

  const [offers, setOffers] = useState([]);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [primaryOfferId, setPrimaryOfferId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState(false);
  const pollRef = useRef(null);

  // negotiate.stage: "set" (slider) -> "sent" (waiting on the broker for real — no fake reply)
  const [negotiate, setNegotiate] = useState(null);
  const [offerAmount, setOfferAmount] = useState(0);

  const fetchOffers = async ({ silent } = {}) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/api/bookings/${bookingId}/offers`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to load broker offers");
      setOffers(res.data?.offers || []);
      setBookingStatus(res.data?.bookingStatus);
    } catch {
      setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return;
    fetchOffers();
    // Poll for real broker responses — unlike a demo, these don't arrive instantly; a broker
    // might take minutes to respond via their own app. Stop polling once the booking is
    // confirmed (a broker's been locked in) — nothing left to watch for at that point.
    pollRef.current = setInterval(() => {
      if (bookingStatus !== "confirmed") fetchOffers({ silent: true });
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (bookingStatus === "confirmed" && pollRef.current) {
      clearInterval(pollRef.current);
    }
  }, [bookingStatus]);

  // Live push (see useJobRequestSocket) — makes "your turn to confirm" / "broker confirmed"
  // arrive immediately instead of waiting out the 4s poll. Polling stays on as a fallback.
  useJobRequestSocket((updated) => {
    if (!updated?.id) return;
    setOffers((current) => current.map((o) => (o.id === updated.id ? updated : o)));
  });

  // Keep whichever offer is currently "primary" sticky across polls/pushes (avoids the card
  // jumping between brokers) — only re-pick once the current one dies (declined), or on first
  // load, preferring whichever live offer has moved furthest through the negotiation.
  useEffect(() => {
    setPrimaryOfferId((current) => {
      const currentOffer = offers.find((o) => o.id === current);
      if (currentOffer && currentOffer.status !== "declined") return current;
      const candidates = offers.filter((o) => o.status !== "declined");
      if (!candidates.length) return null;
      const best = candidates.reduce((a, b) => ((RANK[b.status] || 0) > (RANK[a.status] || 0) ? b : a));
      return best.id;
    });
  }, [offers]);

  const primaryOffer = offers.find((o) => o.id === primaryOfferId) || null;

  // ── Phase 2 handoff: discover the driver the broker assigned, once the booking is
  // confirmed. Calls onDriverAssigned so the parent can mount <RequestDriver> and unmount
  // this whole component (and its polling/sockets) instead of running both at once.
  const discoverDriverRequest = async () => {
    try {
      const res = await api.get(`/api/driver-requests/booking/${bookingId}`, token);
      if (res?.success && res.data?.request) onDriverAssigned(res.data.request);
    } catch {
      /* not assigned yet — keep polling */
    }
  };

  useEffect(() => {
    if (bookingStatus !== "confirmed") return undefined;
    discoverDriverRequest();
    const interval = setInterval(discoverDriverRequest, DRIVER_DISCOVERY_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus, bookingId]);

  // The broker's assignDriver call pushes here directly (see job.controller.js), so this
  // usually beats the poll above.
  useDriverRequestSocket((updated) => {
    if (updated?.bookingId === bookingId) onDriverAssigned(updated);
  });

  const openNegotiate = (offer) => {
    const base = Number(offer.amount) || Number(askingPrice) || 0;
    const min = Math.round(base * 0.78);
    setOfferAmount(base);
    setNegotiate({ offer, stage: "set", min, max: Math.max(base, min + 1) });
  };
  const closeNegotiate = () => setNegotiate(null);

  const submitNegotiate = async () => {
    setActing(true);
    try {
      const res = await api.patch(`/api/jobs/requests/${negotiate.offer.id}/client-counter`, { amount: offerAmount }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send offer");
      setNegotiate((current) => (current ? { ...current, stage: "sent" } : current));
      fetchOffers({ silent: true });
    } catch (err) {
      toast.error(err?.message || "Failed to send offer");
    } finally {
      setActing(false);
    }
  };

  const handleAccept = async (offer) => {
    setActing(true);
    try {
      const res = await api.patch(`/api/jobs/requests/${offer.id}/client-accept`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to accept this broker");
      if (res.data?.booking) {
        // Both sides now agreed — booking confirmed, move to waiting-for-driver.
        toast.success(`Confirmed with ${offer.brokerName || "this broker"}!`);
        setBookingStatus("confirmed");
      } else {
        // First mover — nothing finalized yet, just refresh so the offer's new
        // status/pendingConfirmationBy shows.
        toast.info("Accepted — waiting for the broker to confirm.");
      }
      fetchOffers({ silent: true });
    } catch (err) {
      toast.error(err?.message || "This offer is no longer available — waiting for another broker.");
      fetchOffers({ silent: true });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (offer) => {
    setActing(true);
    try {
      const res = await api.patch(`/api/jobs/requests/${offer.id}/client-reject`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to decline this broker");
      toast.info("Declined — waiting for another broker.");
      fetchOffers({ silent: true });
    } catch (err) {
      toast.error(err?.message || "Failed to decline");
    } finally {
      setActing(false);
    }
  };

  const isYourTurnToConfirm = primaryOffer?.status === "awaiting_confirmation" && primaryOffer?.pendingConfirmationBy === "broker";
  const isWaitingOnBroker = primaryOffer?.status === "awaiting_confirmation" && primaryOffer?.pendingConfirmationBy === "client";

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
            {primaryOffer?.brokerName ? `Negotiating with ${primaryOffer.brokerName}` : "Finding you a broker"}
          </h1>
        </div>
        <p className="text-sm text-neutral-400 mb-6 ml-12">
          {pickup && drop ? `${pickup} → ${drop} · ` : ""}Asking price ₹{Number(askingPrice || 0).toLocaleString("en-IN")}
        </p>

        {error && (
          <div className="bg-white rounded-xl shadow-card p-4 text-sm text-danger flex items-center gap-2 mb-4">
            <span>Couldn't load broker offers.</span>
            <button onClick={() => fetchOffers()} className="underline">Retry</button>
          </div>
        )}

        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-card p-6 md:p-8 text-center">
          {loading ? (
            <div className="flex flex-col items-center py-10">
              <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
              <p className="text-sm text-neutral-400">Loading broker responses...</p>
            </div>
          ) : bookingStatus === "confirmed" ? (
            /* ── Broker confirmed, driver not discovered yet ── */
            <>
              <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Clock3 className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">
                Confirmed with {primaryOffer?.brokerName || "your broker"}
              </h2>
              <p className="text-sm text-neutral-400">
                Final price: <span className="font-semibold text-primary">₹{Number(primaryOffer?.amount || askingPrice || 0).toLocaleString("en-IN")}</span>
                <br />Waiting for them to assign a driver from their fleet — this screen updates automatically.
              </p>
            </>
          ) : !primaryOffer ? (
            /* ── No broker has responded at all yet ── */
            <div className="flex flex-col items-center py-10">
              <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
              <p className="text-sm text-neutral-400">Waiting for a broker to respond to your booking...</p>
            </div>
          ) : isYourTurnToConfirm ? (
            /* ── This broker already accepted — your turn to confirm or decline ── */
            <>
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">{primaryOffer.brokerName || "This broker"} accepted</h2>
              {primaryOffer.brokerPhone && (
                <p className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-3">
                  <Phone className="w-3 h-3" /> {primaryOffer.brokerPhone}
                </p>
              )}
              <p className="text-sm text-neutral-400 mb-4">Confirm to finalize — no further negotiation once you do.</p>
              <p className="font-poppins font-bold text-2xl text-primary mb-6">
                ₹{Number(primaryOffer.amount || askingPrice || 0).toLocaleString("en-IN")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAccept(primaryOffer)}
                  disabled={acting}
                  className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleReject(primaryOffer)}
                  disabled={acting}
                  className="flex-1 py-3 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </>
          ) : isWaitingOnBroker ? (
            /* ── You already accepted this broker — waiting for them to also confirm ── */
            <>
              <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Clock3 className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">
                Waiting for {primaryOffer.brokerName || "the broker"} to confirm
              </h2>
              <p className="text-sm text-neutral-400">
                You accepted at ₹{Number(primaryOffer.amount || askingPrice || 0).toLocaleString("en-IN")} — we'll update this screen automatically once they confirm.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">{primaryOffer.brokerName || "Broker"}</h2>
              {primaryOffer.brokerPhone && (
                <p className="flex items-center justify-center gap-1 text-xs text-neutral-400 mb-3">
                  <Phone className="w-3 h-3" /> {primaryOffer.brokerPhone}
                </p>
              )}

              <p
                className={`inline-flex items-center gap-1 text-[11px] font-medium mb-4 px-2.5 py-1 rounded-full ${
                  primaryOffer.status === "countered" ? "bg-amber-50 text-warning" : "bg-primary-50 text-primary"
                }`}
              >
                <Clock3 className="w-3 h-3" />
                {primaryOffer.status === "countered" ? "Broker countered — your turn" : "Waiting for broker to respond"}
              </p>

              <p className="font-poppins font-bold text-2xl text-primary mb-6">
                ₹{Number(primaryOffer.amount || askingPrice || 0).toLocaleString("en-IN")}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleAccept(primaryOffer)}
                  disabled={acting}
                  className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {primaryOffer.status === "countered" ? "Accept This Price" : `Confirm at ₹${Number(primaryOffer.amount || askingPrice || 0).toLocaleString("en-IN")} Now`}
                </button>
                <button
                  onClick={() => openNegotiate(primaryOffer)}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                >
                  <Tag className="w-4 h-4" /> {primaryOffer.status === "countered" ? "Counter" : "Propose a Different Price"}
                </button>
                {primaryOffer.status === "countered" && (
                  <button
                    onClick={() => handleReject(primaryOffer)}
                    disabled={acting}
                    className="w-full py-3 text-sm font-medium text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    Reject
                  </button>
                )}
              </div>

              {primaryOffer.offerHistory?.length > 1 && (
                <details className="mt-5 text-left">
                  <summary className="text-[11px] text-neutral-400 cursor-pointer select-none">Negotiation history ({primaryOffer.offerHistory.length})</summary>
                  <div className="mt-1.5 space-y-1">
                    {primaryOffer.offerHistory.map((entry, i) => (
                      <p key={i} className="text-[11px] text-neutral-400">
                        {entry.by === "client" ? "You" : "Broker"} offered{" "}
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
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Negotiate with {negotiate.offer.brokerName || "this broker"}</h3>
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
              {acting ? "Sending..." : "Negotiate"}
            </button>
          </div>
        )}

        {negotiate?.stage === "sent" && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-4">
              <Clock3 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Offer sent to {negotiate.offer.brokerName || "broker"}</h3>
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
