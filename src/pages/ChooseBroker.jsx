import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Tag, Loader2, CheckCircle2, Check, Clock3 } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import PaymentSheet from "../components/PaymentSheet";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";

const POLL_MS = 4000;

// Real backend statuses on a job_request/"offer":
//  pending   -> broker hasn't responded yet, OR the client just proposed a number and is
//               waiting on the broker (the same status covers both — it just means "the
//               broker owes a response").
//  countered -> the broker replied with a different number; it's the client's turn to act.
//  accepted  -> this broker won the booking (every other offer auto-declines).
//  declined  -> this offer is no longer live (lost the race, or was rejected).
const STATUS_LABEL = {
  pending: "Waiting for broker",
  countered: "Broker countered — your turn",
  accepted: "Accepted",
  declined: "No longer available",
};

const initials = (name) => (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

function OfferCard({ offer, selected, onSelect }) {
  const disabled = offer.status === "declined";
  return (
    <button
      onClick={() => !disabled && onSelect(offer.id)}
      disabled={disabled}
      className={`relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left w-full ${
        disabled
          ? "border-neutral-100 bg-neutral-50 opacity-60 cursor-not-allowed"
          : selected
          ? "border-primary bg-primary-50"
          : "border-neutral-100 bg-white hover:border-neutral-200"
      }`}
    >
      {selected && !disabled && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      )}
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-poppins font-bold text-lg bg-primary-50 text-primary">
        {initials(offer.brokerName)}
      </div>
      <div className="min-w-0 w-full">
        <h4 className="font-poppins font-semibold text-sm text-neutral-800">{offer.brokerName || "Broker"}</h4>
        {offer.brokerPhone && (
          <p className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
            <Phone className="w-3 h-3" /> {offer.brokerPhone}
          </p>
        )}
        <p
          className={`inline-flex items-center gap-1 text-[11px] font-medium mt-1.5 px-2 py-0.5 rounded-full ${
            offer.status === "countered"
              ? "bg-amber-50 text-warning"
              : offer.status === "accepted"
              ? "bg-green-50 text-success"
              : offer.status === "declined"
              ? "bg-neutral-100 text-neutral-400"
              : "bg-primary-50 text-primary"
          }`}
        >
          {offer.status === "pending" && <Clock3 className="w-3 h-3" />}
          {STATUS_LABEL[offer.status] || offer.status}
        </p>
        <p className="font-poppins font-bold text-base text-primary mt-2">
          ₹{Number(offer.amount || 0).toLocaleString("en-IN")}
        </p>
      </div>
    </button>
  );
}

// Rendered as step 6 of the same booking wizard (BookTruck.jsx) once the booking has been
// created — never routed to directly. bookingId/bookingNumber/askingPrice/pickup/drop come
// from the booking BookTruck just created; onBack resets the whole wizard back to step 1
// (there's no safe "previous step" to return to once the booking already exists — going back
// to Review and confirming again would create a second, duplicate booking).
export default function ChooseBroker({ bookingId, bookingNumber, askingPrice, pickup, drop, onBack }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const token = getToken();

  const [offers, setOffers] = useState([]);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [acting, setActing] = useState(false);
  const pollRef = useRef(null);

  // negotiate.stage: "set" (slider) -> "sent" (waiting on the broker for real — no fake reply)
  const [negotiate, setNegotiate] = useState(null);
  const [offerAmount, setOfferAmount] = useState(0);

  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const fetchOffers = async ({ silent } = {}) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/api/bookings/${bookingId}/offers`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to load broker offers");
      const nextOffers = res.data?.offers || [];
      setOffers(nextOffers);
      setBookingStatus(res.data?.bookingStatus);
      setSelectedId((current) => current || nextOffers[0]?.id || null);
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

  const selectedOffer = offers.find((o) => o.id === selectedId) || null;

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
      toast.success(`Confirmed with ${offer.brokerName || "this broker"}!`);
      setBookingStatus("confirmed");
      setSelectedId(offer.id);
      fetchOffers({ silent: true });
    } catch (err) {
      toast.error(err?.message || "This offer is no longer available — pick another broker.");
      fetchOffers({ silent: true });
    } finally {
      setActing(false);
    }
  };

  const handlePaySuccess = async () => {
    setShowPaymentSheet(false);
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/pay`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to record payment");
    } catch (err) {
      toast.error(err?.message || "Failed to record payment");
    }
    setConfirmed(true);
  };

  const handlePayLater = () => {
    setShowPaymentSheet(false);
    setConfirmed(true);
  };

  // ── Final state: broker confirmed + payment (or pay-later) recorded ──
  if (confirmed) {
    return (
      <div className="min-h-full flex items-center justify-center py-8">
        <div className="bg-white rounded-2xl shadow-card p-8 md:p-12 max-w-md w-full text-center">
          <div className="animate-bounce-in mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center shadow-glow-green">
              <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
            </div>
          </div>
          <h1 className="font-poppins font-bold text-2xl text-success mb-2">Booking Confirmed!</h1>
          <p className="text-sm text-neutral-400 mb-8">Your booking has been successfully placed.</p>
          <div className="bg-neutral-50 rounded-xl p-5 mb-8">
            <p className="text-xs text-neutral-400 mb-1">Booking ID</p>
            <p className="font-poppins font-bold text-2xl text-neutral-800">{bookingNumber}</p>
            <p className="text-sm text-neutral-400 mt-2">We'll notify you once a driver is assigned.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/track")} className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors">
              Track Booking
            </button>
            <button onClick={() => navigate("/")} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Choose your broker</h1>
        </div>
        <p className="text-sm text-neutral-400 mb-6 ml-12">
          {pickup && drop ? `${pickup} → ${drop} · ` : ""}Every broker started from your asking price of ₹{Number(askingPrice || 0).toLocaleString("en-IN")}. Brokers respond in their own time — this list updates automatically.
        </p>

        {error && (
          <div className="bg-white rounded-xl shadow-card p-4 text-sm text-danger flex items-center gap-2 mb-4">
            <span>Couldn't load broker offers.</span>
            <button onClick={() => fetchOffers()} className="underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
            <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-400">Loading broker responses...</p>
          </div>
        ) : bookingStatus === "confirmed" ? (
          /* ── Broker locked in — show payment step ── */
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-card p-6 md:p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">
              {selectedOffer?.brokerName ? `Confirmed with ${selectedOffer.brokerName}` : "Broker confirmed"}
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Final price: <span className="font-semibold text-primary">₹{Number(selectedOffer?.amount || askingPrice || 0).toLocaleString("en-IN")}</span>
            </p>
            <button
              onClick={() => setShowPaymentSheet(true)}
              className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              Continue to Payment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: offer grid */}
            <div className="lg:col-span-2">
              {offers.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="w-8 h-8 text-primary/40 animate-spin mb-3" />
                  <p className="text-sm text-neutral-400">Waiting for brokers to respond to your booking...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {offers.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} selected={selectedId === offer.id} onSelect={setSelectedId} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: selected offer summary + actions */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-card p-5 md:p-6 lg:sticky lg:top-6">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-4">Selected Broker</p>

                {!selectedOffer ? (
                  <p className="text-sm text-neutral-300 text-center py-10">Select a broker to continue</p>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-poppins font-bold text-sm bg-primary-50 text-primary">
                        {initials(selectedOffer.brokerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-poppins font-semibold text-sm text-neutral-800 truncate">{selectedOffer.brokerName || "Broker"}</p>
                        {selectedOffer.brokerPhone && <p className="text-xs text-neutral-400 truncate">{selectedOffer.brokerPhone}</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-b border-neutral-100 mb-4">
                      <span className="text-xs text-neutral-400">
                        {selectedOffer.status === "countered" ? "Broker's Counter" : "Current Price"}
                      </span>
                      <span className="font-poppins font-bold text-lg text-primary">₹{Number(selectedOffer.amount || 0).toLocaleString("en-IN")}</span>
                    </div>

                    {selectedOffer.status === "declined" ? (
                      <p className="text-sm text-neutral-400 text-center py-2">This broker is no longer available. Pick another.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => handleAccept(selectedOffer)}
                          disabled={acting}
                          className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                        >
                          {selectedOffer.status === "countered" ? "Accept This Price" : "Continue"}
                        </button>
                        <button
                          onClick={() => openNegotiate(selectedOffer)}
                          disabled={acting}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                        >
                          <Tag className="w-4 h-4" /> Negotiate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
              Back to Offers
            </button>
          </div>
        )}
      </BottomSheet>

      <PaymentSheet
        open={showPaymentSheet}
        amount={Number(selectedOffer?.amount || askingPrice || 0)}
        phone={user?.phone}
        onClose={() => setShowPaymentSheet(false)}
        onSuccess={handlePaySuccess}
        onPayLater={handlePayLater}
      />
    </>
  );
}
