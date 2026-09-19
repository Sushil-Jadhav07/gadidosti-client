import React, { useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { ArrowLeft, Clock3, MapPin, ClipboardList, Ruler } from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import RequestDriver from "./RequestDriver";
import MapView from "../components/MapView";
import { api, getToken } from "../services/api";
import { useDriverRequestSocket } from "../hooks/useDriverRequestSocket";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

const POLL_MS = 5000;
// How long to wait before offering "Search Again"/"Cancel Search" — no visible countdown shown
// for this, it just decides when that prompt appears.
const SEARCH_PROGRESS_SECONDS = 60;

// A soft sonar-style ping — three rings expanding out from center and fading, looped forever.
// Deliberately a plain CSS overlay centered on the map container, not a real geo-anchored Google
// Maps Circle (animating a real overlay's radius every frame fights the SDK's own rendering and
// isn't necessary here). This is only ever placed over a `lockedCenter` map (see MapView.jsx) —
// with the viewport pinned exactly on pickup and pan/zoom disabled, "centered in the container"
// and "sitting on the pickup pin" are the same point by construction, so this never drifts off
// of it the way it would on a map that's still auto-fitting/re-centering.
function RadarPulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute w-4 h-4 rounded-full bg-primary/40 animate-radar-ping"
          style={{ animationDelay: `${i * 0.7}s` }}
        />
      ))}
      <span className="relative w-3 h-3 rounded-full bg-primary shadow-[0_0_0_4px_rgba(255,255,255,0.9)]" />
    </div>
  );
}

// Same priority scheme ChooseBroker.jsx uses to pick a single "primary" offer — but here it
// also decides WHETHER to hand off to the single-request <RequestDriver> negotiation card at
// all: a merely 'pending' request (driver hasn't responded yet) never promotes on its own,
// since with N fanned-out drivers there's no single one worth spotlighting until one of them
// actually does something. 'countered'/'awaiting_confirmation'/'accepted' all do.
const RANK = { accepted: 4, awaiting_confirmation: 3, countered: 2, pending: 1 };
const NEEDS_ACTION_RANK = 2;

// A fixed zoom level that comfortably shows the search-radius circle for a given radius, for the
// locked (non-interactive) map below — picked from a lookup table rather than computed from the
// container's actual pixel size, which this component has no reliable way to read up front.
const zoomForRadiusKm = (km) => {
  if (!km || km <= 2) return 13;
  if (km <= 5) return 12;
  if (km <= 10) return 11;
  if (km <= 20) return 10;
  if (km <= 50) return 9;
  if (km <= 100) return 8;
  return 6;
};

// Elapsed seconds since this screen actually started actively searching (i.e. since `active`
// first went true, or since the caller last called the returned reset function — "Search Again"
// uses that to give the 2-minute window a fresh start without touching the actual backend
// search, which never stopped in the first place).
function useElapsedSeconds(active) {
  const [elapsed, setElapsed] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setElapsed(0);
      return undefined;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, resetToken]);
  const reset = () => setResetToken((n) => n + 1);
  return [elapsed, reset];
}

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
export default function FindTruckSearch({ bookingId, bookingNumber, askingPrice, pickup, pickupLat, pickupLng, drop, searchRadiusKm, onBack, onCancelled }) {
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
      pickupLat={pickupLat}
      pickupLng={pickupLng}
      drop={drop}
      searchRadiusKm={searchRadiusKm}
      onBack={onBack}
      onCancelled={onCancelled}
      onPromote={setDriverRequest}
    />
  );
}

function DriverFanOutWaiting({ bookingId, askingPrice, pickup, pickupLat, pickupLng, drop, searchRadiusKm, onBack, onCancelled, onPromote }) {
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
  // The one state where there's genuinely nothing left to search for — map/progress bar/radar
  // ping all stop making sense once every fanned-out driver has declined or timed out.
  const isActivelySearching = !loading && !allDeclined;

  // Tracked silently (no visible countdown/progress bar) purely to decide when to offer a way
  // out. "Cancel Search" actually cancels the booking and sends the client back to a completely
  // fresh Step 1.
  const [elapsedSeconds, resetElapsedSeconds] = useElapsedSeconds(isActivelySearching);
  const searchTimedOut = isActivelySearching && elapsedSeconds >= SEARCH_PROGRESS_SECONDS;
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [searchingAgain, setSearchingAgain] = useState(false);

  const handleCancelSearch = async () => {
    setCancelling(true);
    setCancelError("");
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/cancel`, { reason: "No driver found within the search window" }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to cancel booking");
      onCancelled?.();
    } catch (err) {
      setCancelError(err?.message || "Failed to cancel booking. Please try again.");
      setCancelling(false);
    }
  };

  // "Search Again" — actually re-notifies nearby drivers server-side (a driver who declined
  // the first round is a legitimate candidate again; see rebroadcastBooking on the backend),
  // not just a cosmetic timer reset. Refreshes the request list right after so a re-notified
  // driver's fresh 'pending' row shows up immediately instead of waiting for the next poll.
  const handleSearchAgain = async () => {
    setSearchingAgain(true);
    setCancelError("");
    try {
      const res = await api.patch(`/api/bookings/${bookingId}/rebroadcast`, {}, token);
      if (!res?.success) throw new Error(res?.message || "Failed to search again");
      resetElapsedSeconds();
      await fetchRequests({ silent: true });
    } catch (err) {
      setCancelError(err?.message || "Failed to search again. Please try again.");
    } finally {
      setSearchingAgain(false);
    }
  };

  // Loaded here too (not just inside MapView) so the fallback geocode below knows
  // window.google.maps is actually ready before it tries to use it — normally it already is by
  // Step 5 (Step 1's own map/autocomplete inputs load the same shared script id), but nothing
  // upstream of this screen guarantees that.
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Some pickup addresses (a Plus Code pasted in directly, or any free-typed text the client
  // never chose an autocomplete suggestion for) never get lat/lng captured at all — pickupLat/
  // pickupLng stay null despite `pickup` itself having a real address string. Without a
  // fallback, hasPickupCoords below is permanently false for that booking and the whole map
  // panel just shows its empty background forever, which is exactly what "map not loading"
  // looked like — it was correctly never rendering, not failing to load.
  //
  // mapError surfaces WHY that fallback itself failed (a Geocoder status, or the API script
  // load itself throwing) directly in the panel instead of a silent catch — this whole feature
  // is otherwise invisible from the outside; if it's still broken after this, the message shown
  // here is what to report back, since there's no way to inspect this app's own browser console
  // from here.
  const [fallbackCoords, setFallbackCoords] = useState(null);
  const [mapError, setMapError] = useState(null);
  // Postgres NUMERIC columns come back from the API as strings (a well-known pg driver quirk —
  // BookingDetail.jsx/BookTruck.jsx wrap every lat/lng the same way for the same reason), so
  // pickupLat/pickupLng here can easily be "19.076" rather than 19.076. `!= null` alone treats
  // that as "present" and skips the fallback geocode below entirely, then hands the raw string
  // straight to Google's `center` prop — which is exactly what threw "setCenter: not a LatLng
  // or LatLngLiteral with finite coordinates: in property lat: not a number" here. Coercing with
  // Number() and checking isFinite (not just !=null) catches strings, "", and NaN alike.
  const numPickupLat = pickupLat != null ? Number(pickupLat) : null;
  const numPickupLng = pickupLng != null ? Number(pickupLng) : null;
  const hasOwnCoords = Number.isFinite(numPickupLat) && Number.isFinite(numPickupLng);

  useEffect(() => {
    if (mapsLoadError) {
      // eslint-disable-next-line no-console
      console.error("[FindTruckSearch] Google Maps script failed to load:", mapsLoadError);
      setMapError(`Google Maps script failed to load: ${mapsLoadError.message || mapsLoadError}`);
    }
  }, [mapsLoadError]);

  useEffect(() => {
    if (hasOwnCoords || !pickup || !mapsLoaded || !window.google?.maps) return;
    let cancelled = false;
    (async () => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const { results } = await geocoder.geocode({ address: pickup });
        const loc = results?.[0]?.geometry?.location;
        if (cancelled) return;
        if (loc) {
          setFallbackCoords({ lat: loc.lat(), lng: loc.lng() });
        } else {
          setMapError(`Couldn't resolve "${pickup}" to a map location (no results).`);
        }
      } catch (err) {
        if (cancelled) return;
        // A Geocoder failure rejects with either a plain string status ("REQUEST_DENIED",
        // "OVER_QUERY_LIMIT", "ZERO_RESULTS"...) or, less commonly, an Error — handle both so
        // the real reason always ends up on screen instead of "[object Object]".
        const reason = typeof err === "string" ? err : err?.message || JSON.stringify(err);
        // eslint-disable-next-line no-console
        console.error(`[FindTruckSearch] Geocoding "${pickup}" failed:`, err);
        setMapError(`Couldn't resolve "${pickup}" to a map location (${reason}).`);
      }
    })();
    return () => { cancelled = true; };
  }, [hasOwnCoords, pickup, mapsLoaded]);

  const effectivePickupLat = hasOwnCoords ? numPickupLat : fallbackCoords?.lat ?? null;
  const effectivePickupLng = hasOwnCoords ? numPickupLng : fallbackCoords?.lng ?? null;
  const hasPickupCoords = Number.isFinite(effectivePickupLat) && Number.isFinite(effectivePickupLng);
  // How many still-live drivers (not declined) have actually responded/are pending — used for
  // the "N drivers nearby" count and the list below, but no longer plotted on the map itself or
  // labeled with their truck — the map only ever shows the pickup point (see searchMapMarkers).
  const driverMarkers = useMemo(() => requests
    .filter((r) => r.status !== "declined" && r.driverLat != null && r.driverLng != null),
  [requests]);
  // Deliberately pickup only — no driver pins, no radius circle. Those pulled the map's bounds
  // around as drivers responded/timed out, which is exactly what made it feel like it kept
  // "moving"; a single fixed point is simpler and matches what was actually asked for.
  const searchMapMarkers = useMemo(() => (hasPickupCoords
    ? [{ id: "pickup", position: { lat: effectivePickupLat, lng: effectivePickupLng }, color: "blue", title: pickup || "Pickup" }]
    : []), [hasPickupCoords, effectivePickupLat, effectivePickupLng, pickup]);
  // Stable object identity across polls (this component re-renders every POLL_MS) — a fresh
  // {lat,lng} literal every render was passed straight into GoogleMap's `center` prop, which
  // treats a changed reference as a real recenter request even when the values are identical,
  // and doing that repeatedly while tiles are still loading was why the map rendered as a blank
  // fill color with no imagery at all instead of an actual map.
  const lockedCenter = useMemo(
    () => (hasPickupCoords ? { lat: effectivePickupLat, lng: effectivePickupLng } : null),
    [hasPickupCoords, effectivePickupLat, effectivePickupLng]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col flex-1 lg:min-h-0">
        {/* Left/right split, map on the right, full height from the very top — step indicator,
            header, booking summary, and status all live in the left column now, so the right
            side is nothing but the map (no floating card on top of it either). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch flex-1 lg:min-h-0">
          {/* min-w-0 on both grid children — without it, a grid item's default min-width:auto
              lets long in-flow content (addresses, driver rows) force this column past its fair
              share of the row, pushing the map column into overflow instead of just wrapping.
              That's what the horizontal scrollbar was, and why the map looked like it "wasn't
              loading" — it was rendering fine, just squeezed/pushed off past the visible edge. */}
          <div className="min-w-0 p-5 md:p-8 border-b lg:border-b-0 lg:border-r border-neutral-100 lg:overflow-y-auto lg:min-h-0 no-scrollbar">
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

            {/* Status — was a floating card over the map; now sits here so the map on the
                right stays completely clear except the pickup pin itself. */}
            <div className="mt-6 pt-6 border-t border-neutral-100">
              {loading ? (
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-neutral-500">Notifying nearby drivers...</p>
                </div>
              ) : allDeclined ? (
                <>
                  <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-1">No drivers accepted yet</h2>
                  <p className="text-xs text-neutral-400 mb-3">
                    Every driver within {searchRadiusKm ? `${searchRadiusKm} km` : "range"} declined or didn't respond.
                    You can notify them again, or go back and adjust your booking.
                  </p>
                  {cancelError && <p className="text-[11px] text-danger mb-2.5">{cancelError}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSearchAgain}
                      disabled={searchingAgain}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {searchingAgain ? "Searching..." : "Search Again"}
                    </button>
                    <button
                      onClick={onBack}
                      disabled={searchingAgain}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                    >
                      Back to Review
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-1">
                    {totalCount > 0 ? `Notified ${totalCount} driver${totalCount === 1 ? "" : "s"} nearby` : "Notifying nearby drivers"}
                  </h2>
                  <p className="text-xs text-neutral-400 mb-3">
                    Waiting for a response — this screen updates automatically the moment someone accepts or counters.
                  </p>
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary mb-3">
                    <Clock3 className="w-3 h-3" /> First to accept gets the job
                  </p>

                  {driverMarkers.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {requests
                        .filter((r) => r.status !== "declined")
                        .map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 bg-neutral-50 rounded-lg px-3 py-2 text-xs">
                            <span className="font-medium text-neutral-700 truncate">{r.driverName || "Driver"}</span>
                            <span className="text-neutral-400 flex-shrink-0 capitalize">{r.status.replace(/_/g, " ")}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {searchTimedOut && (
                    <div className="pt-3 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-800 mb-1">Still no driver yet</p>
                      <p className="text-[11px] text-neutral-500 mb-2.5">
                        You can search again to notify nearby drivers once more, or cancel and start over.
                      </p>
                      {cancelError && <p className="text-[11px] text-danger mb-2.5">{cancelError}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSearchAgain}
                          disabled={cancelling || searchingAgain}
                          className="flex-1 py-2 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-60"
                        >
                          {searchingAgain ? "Searching..." : "Search Again"}
                        </button>
                        <button
                          onClick={handleCancelSearch}
                          disabled={cancelling || searchingAgain}
                          className="flex-1 py-2 rounded-lg text-xs font-medium bg-danger text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                        >
                          {cancelling ? "Cancelling..." : "Cancel Search"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: nothing but the map — pickup location only, fixed/locked, full height. */}
          <div className="relative min-w-0 h-full min-h-[420px] bg-neutral-50">
            {hasPickupCoords && (
              <MapView
                markers={searchMapMarkers}
                lockedCenter={lockedCenter}
                lockedZoom={zoomForRadiusKm(searchRadiusKm)}
                height="100%"
                className="absolute inset-0"
              />
            )}
            {isActivelySearching && <RadarPulse />}
            {!hasPickupCoords && (
              <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                <p className="max-w-xs text-center text-xs font-medium text-neutral-500 bg-white/90 rounded-lg px-3 py-2 shadow-card">
                  {mapError || (mapsLoaded ? "Resolving pickup location..." : "Loading map...")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
