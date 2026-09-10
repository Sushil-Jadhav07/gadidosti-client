import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Radar, Clock3, MapPin, ClipboardList, Ruler } from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import RequestDriver from "./RequestDriver";
import { api, getToken } from "../services/api";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";

const POLL_MS = 5000;

// Same priority scheme ChooseBroker.jsx uses to pick a single "primary" offer — but here it
// also decides WHETHER to hand off to the single-request <RequestDriver> negotiation card at
// all: a merely 'pending' request (driver hasn't responded yet) never promotes on its own,
// since with N fanned-out drivers there's no single one worth spotlighting until one of them
// actually does something. 'countered'/'awaiting_confirmation'/'accepted' all do.
const RANK = { accepted: 4, awaiting_confirmation: 3, countered: 2, pending: 1 };
const NEEDS_ACTION_RANK = 2;

// Rendered as step 5 of the booking wizard (BookTruck.jsx) for search_mode='truck' ("Find
// Truck") bookings — the fan-out counterpart to ChooseBroker.jsx. POST /api/bookings already
// broadcast the booking to every available driver within search_radius_km, one driver_requests
// row per driver (see gadidosti-backend's booking.controller.js broadcastBooking). This screen
// polls GET /api/bookings/:id/driver-requests (NOT /api/driver-requests/booking/:bookingId,
// which only ever returns one arbitrary row and can't represent a fan-out) until any one of
// those rows needs the client's attention, then hands off entirely to <RequestDriver> — the
// exact same single-target accept/negotiate/mutual-confirm/payment flow the broker-assigned
// path already uses — so declining that one driver returns here to keep waiting on the rest,
// rather than ending the search.
export default function FindTruckSearch({ bookingId, bookingNumber, askingPrice, pickup, drop, searchRadiusKm, onBack }) {
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
        variant="findTruck"
        onBack={onBack}
        onFallbackToBrokers={() => setDriverRequest(null)}
      />
    );
  }

  return (
    <DriverFanOutWaiting
      bookingId={bookingId}
      askingPrice={askingPrice}
      pickup={pickup}
      drop={drop}
      searchRadiusKm={searchRadiusKm}
      onBack={onBack}
      onPromote={setDriverRequest}
    />
  );
}

function DriverFanOutWaiting({ bookingId, askingPrice, pickup, drop, searchRadiusKm, onBack, onPromote }) {
  const token = getToken();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pollRef = useRef(null);

  const fetchRequests = async ({ silent } = {}) => {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/api/bookings/${bookingId}/driver-requests`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to load driver responses");
      setRequests(res.data?.requests || []);
    } catch {
      setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return undefined;
    fetchRequests();
    pollRef.current = setInterval(() => fetchRequests({ silent: true }), POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Live push for whichever of the fanned-out rows updates first — same event every other
  // driver-request screen listens for, just patched into this list instead of a single request.
  useDriverRequestSocket((updated) => {
    if (!updated?.id) return;
    setRequests((current) => {
      const exists = current.some((r) => r.id === updated.id);
      return exists ? current.map((r) => (r.id === updated.id ? updated : r)) : [...current, updated];
    });
  });

  // The moment any fanned-out request reaches something requiring the client's turn, hand off
  // to the single-request negotiation card and stop polling this list (unmounts this component).
  useEffect(() => {
    const live = requests.filter((r) => r.status !== "declined");
    if (!live.length) return;
    const best = live.reduce((a, b) => ((RANK[b.status] || 0) > (RANK[a.status] || 0) ? b : a));
    if ((RANK[best.status] || 0) >= NEEDS_ACTION_RANK) onPromote(best);
  }, [requests, onPromote]);

  const totalCount = requests.length;
  const declinedCount = requests.filter((r) => r.status === "declined").length;
  const allDeclined = totalCount > 0 && declinedCount === totalCount;

  return (
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
            <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Finding you a nearby truck</h1>
          </div>
          <p className="text-sm text-neutral-400 mb-6 ml-12">
            {pickup && drop ? `${pickup} → ${drop} · ` : ""}Asking price ₹{Number(askingPrice || 0).toLocaleString("en-IN")}
          </p>

          {error && (
            <div className="bg-red-50 rounded-xl p-4 text-sm text-danger flex items-center gap-2 mb-4">
              <span>Couldn't load driver responses.</span>
              <button onClick={() => fetchRequests()} className="underline">Retry</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Booking Summary — same card RequestDriver.jsx/ChooseBroker.jsx use. */}
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
                  <p className="text-sm font-semibold text-neutral-800 truncate">{pickup}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Drop-off</p>
                  <p className="text-sm font-semibold text-neutral-800 truncate">{drop}</p>
                </div>
              </div>
            </div>

            {!!searchRadiusKm && (
              <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-500">
                <Ruler className="w-3.5 h-3.5 text-neutral-400" />
                Searching within a {searchRadiusKm} km radius
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="bg-neutral-50 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Asking Price</p>
                <p className="font-poppins font-bold text-2xl text-primary tabular-nums">
                  ₹{Number(askingPrice || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Right: fan-out status. */}
          <div className="p-6 md:p-8 text-center">
            {loading ? (
              <div className="flex flex-col items-center py-10">
                <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                <p className="text-sm text-neutral-400">Notifying nearby drivers...</p>
              </div>
            ) : allDeclined ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <Radar className="w-8 h-8 text-danger" />
                </div>
                <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">No drivers accepted yet</h2>
                <p className="text-sm text-neutral-400 mb-6">
                  Every driver within {searchRadiusKm ? `${searchRadiusKm} km` : "range"} declined or didn't respond. You can widen your search with a new booking.
                </p>
                <button
                  onClick={onBack}
                  className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  Back to Review
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                  <Radar className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h2 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">
                  {totalCount > 0 ? `Notified ${totalCount} driver${totalCount === 1 ? "" : "s"} nearby` : "Notifying nearby drivers"}
                </h2>
                <p className="text-sm text-neutral-400 mb-4">
                  Waiting for a response — this screen updates automatically the moment someone accepts or counters.
                </p>
                <p className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary">
                  <Clock3 className="w-3 h-3" /> First to accept gets the job
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
