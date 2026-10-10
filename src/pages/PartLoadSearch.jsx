import React, { useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { ArrowLeft, Truck, Clock3, PackagePlus, Check, MapPin, ClipboardList, Gauge, User } from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import MapView from "../components/MapView";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { clearWizardState } from "../store/bookingWizardSlice";
import { useTripJoinRequestSocket } from "../hooks/useTripJoinRequestSocket";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

const POLL_MS = 5000;

// Same soft sonar-style ping as FindTruckSearch.jsx's RadarPulse — kept as an exact duplicate
// (not extracted into a shared component) since this is the only other place that needs it and
// a shared file isn't worth it for one small, purely-visual overlay.
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

// Rendered as step 5 of the booking wizard (BookTruck.jsx) for search_mode='part_load' ("Part
// Truck" + "Find Truck") bookings — the load-sharing counterpart to FindTruckSearch/ChooseBroker,
// deliberately built on the same two-column (info left, locked map right) shell so it reads as
// the same product, not a bolted-on screen. Unlike FindTruckSearch there's no existing broadcast
// to wait on: this screen itself runs the search (GET /vehicles/trucks/nearby-on-trip — on-trip
// trucks with spare capacity heading roughly the right way, see gadidosti-backend's
// TruckModel.findOnTripForPartLoad), lets the client pick one, then creates a trip_join_requests
// row for the driver to accept/decline. No negotiation in v1 — the price shown per candidate is
// final, same as a normal quote.
export default function PartLoadSearch({ bookingId, bookingNumber, pickup, pickupLat, pickupLng, drop, dropLat, dropLng, weightTons, onBack }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const token = getToken();

  // 'candidates' — picking a truck; 'pending' — waiting on the driver; 'accepted' — done.
  const [phase, setPhase] = useState("candidates");
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidatesError, setCandidatesError] = useState(null);
  const [requestingId, setRequestingId] = useState(null);
  const [joinRequest, setJoinRequest] = useState(null);
  const pollRef = useRef(null);

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    setCandidatesError(null);
    try {
      const qs = new URLSearchParams({
        pickup_lat: pickupLat, pickup_lng: pickupLng, drop_lat: dropLat, drop_lng: dropLng, weight_tons: weightTons,
      });
      const res = await api.get(`/api/vehicles/trucks/nearby-on-trip?${qs}`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to search for trucks");
      setCandidates(res.data?.trucks || []);
    } catch (err) {
      // The real reason (e.g. a validation message) is far more useful here than a generic
      // "something went wrong" — this search has real required inputs (weight, both
      // coordinates), and a silently generic error here is what made an earlier real bug (a
      // booking created without a weight) look like nothing was happening at all.
      setCandidatesError(err?.message || "Failed to search for trucks");
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Resume-on-reload: if a request already exists for this booking (the client navigated away
  // mid-search and came back), pick up wherever it left off instead of starting a fresh search.
  // api.get never throws on a non-2xx status (see services/api.js) — a missing request comes
  // back as an ordinary { success: false } body (404), not an exception, so this checks
  // `res?.success` rather than try/catch.
  const checkExisting = async () => {
    const res = await api.get(`/api/trip-join-requests/booking/${bookingId}`, token);
    if (res?.success && res.data?.request) {
      const request = res.data.request;
      setJoinRequest(request);
      if (request.status === "accepted") setPhase("accepted");
      else if (request.status === "pending") setPhase("pending");
      else fetchCandidates();
      return;
    }
    fetchCandidates();
  };

  useEffect(() => {
    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (phase !== "pending" || !bookingId) return undefined;
    const poll = async () => {
      try {
        const res = await api.get(`/api/trip-join-requests/booking/${bookingId}`, token);
        if (res?.success && res.data?.request) applyRequestUpdate(res.data.request);
      } catch { /* silent — next poll retries */ }
    };
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bookingId]);

  const applyRequestUpdate = (request) => {
    setJoinRequest(request);
    if (request.status === "accepted") {
      setPhase("accepted");
    } else if (request.status === "declined") {
      toast.info("That driver declined — pick another truck.");
      setJoinRequest(null);
      setPhase("candidates");
      fetchCandidates();
    }
  };

  useTripJoinRequestSocket((payload) => {
    if (payload?.bookingId === bookingId) applyRequestUpdate(payload);
  });

  const handleRequestTruck = async (candidate) => {
    setRequestingId(candidate.truckId);
    try {
      const res = await api.post("/api/trip-join-requests", { booking_id: bookingId, target_trip_id: candidate.currentTripId }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send request");
      setJoinRequest(res.data?.request || null);
      setPhase("pending");
    } catch (err) {
      toast.error(err?.message || "Failed to request this truck — it may no longer be available.");
      fetchCandidates();
    } finally {
      setRequestingId(null);
    }
  };

  // Loaded here the same way FindTruckSearch.jsx does, for the same reason — nothing upstream
  // of Step 5 guarantees window.google.maps is ready yet.
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // pickupLat/pickupLng are guaranteed numeric here (this screen's own search query already
  // requires them — see fetchCandidates), unlike FindTruckSearch which can be reached via a
  // reload with coordinates still unresolved, so no fallback-geocode path is needed.
  const numPickupLat = pickupLat != null ? Number(pickupLat) : null;
  const numPickupLng = pickupLng != null ? Number(pickupLng) : null;
  const hasPickupCoords = Number.isFinite(numPickupLat) && Number.isFinite(numPickupLng);
  const searchMapMarkers = useMemo(() => (hasPickupCoords
    ? [{ id: "pickup", position: { lat: numPickupLat, lng: numPickupLng }, color: "blue", title: pickup || "Pickup" }]
    : []), [hasPickupCoords, numPickupLat, numPickupLng, pickup]);
  const lockedCenter = useMemo(
    () => (hasPickupCoords ? { lat: numPickupLat, lng: numPickupLng } : null),
    [hasPickupCoords, numPickupLat, numPickupLng]
  );
  // 'candidates'/'pending' both represent "actively trying to get you a truck" — the radar ping
  // runs through both, same as FindTruckSearch's isActivelySearching covers its whole wait.
  const isActivelySearching = phase === "candidates" || phase === "pending";

  const headerTitle = phase === "candidates" ? "Pick a truck to share" : phase === "pending" ? "Waiting for the driver" : "Load Confirmed!";

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch flex-1 lg:min-h-0">
          <div className="min-w-0 p-5 md:p-8 border-b lg:border-b-0 lg:border-r border-neutral-100 lg:overflow-y-auto lg:min-h-0 no-scrollbar">
            <StepIndicator currentStep={5} onStepClick={undefined} embedded />
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={onBack}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 -ml-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">{headerTitle}</h1>
            </div>
            <p className="text-sm text-neutral-400 mb-6 ml-12">{pickup} → {drop}</p>

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

            <div className="mt-6 pt-6 border-t border-neutral-100">
              {phase === "candidates" && (
                loadingCandidates ? (
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin flex-shrink-0" />
                    <p className="text-sm text-neutral-500">Looking for trucks already heading your way...</p>
                  </div>
                ) : candidatesError ? (
                  <div className="bg-red-50 rounded-xl p-4 text-sm text-danger flex items-center gap-2">
                    <span>{candidatesError}</span>
                    <button onClick={fetchCandidates} className="underline">Retry</button>
                  </div>
                ) : candidates.length === 0 ? (
                  <>
                    <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-1">No trucks available to share right now</h2>
                    <p className="text-xs text-neutral-400 mb-3">Try again in a few minutes, or go back and book a dedicated truck instead.</p>
                    <button onClick={fetchCandidates} className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                      Search Again
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-3">
                      {candidates.length} truck{candidates.length === 1 ? "" : "s"} nearby with spare capacity
                    </h2>
                    <div className="space-y-2.5">
                      {candidates.map((c) => (
                        <div key={c.truckId} className="border border-neutral-100 rounded-xl p-3.5 flex items-center gap-3">
                          <span className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4.5 h-4.5 text-teal-700" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-neutral-800 truncate">{c.registration} · {c.driverName || "Driver"}</p>
                            <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-2.5 flex-wrap">
                              {c.distanceKm != null && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{c.distanceKm.toFixed(1)} km</span>}
                              {c.etaMinutes != null && <span className="flex items-center gap-1"><Clock3 className="w-2.5 h-2.5" />~{c.etaMinutes} min</span>}
                              {c.spareTons != null && <span className="flex items-center gap-1"><Gauge className="w-2.5 h-2.5" />{c.spareTons} ton spare</span>}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-poppins font-bold text-base text-primary tabular-nums">
                              ₹{Number(c.estimatedPrice?.total || 0).toLocaleString("en-IN")}
                            </p>
                            <button
                              onClick={() => handleRequestTruck(c)}
                              disabled={requestingId === c.truckId}
                              className="mt-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
                            >
                              {requestingId === c.truckId ? "Requesting..." : "Request"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}

              {phase === "pending" && (
                <>
                  <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-1">
                    {joinRequest?.truckReg ? `Waiting for ${joinRequest.driverName || "the driver"} (${joinRequest.truckReg})` : "Waiting for the driver to respond"}
                  </h2>
                  <p className="text-xs text-neutral-400 mb-3">This screen updates automatically once they accept or decline.</p>
                  <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-3">
                    <div className="h-full w-full rounded-full bg-primary animate-pulse" />
                  </div>
                  {joinRequest?.driverName && (
                    <p className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><User className="w-3 h-3" /> {joinRequest.driverName}{joinRequest.truckReg ? ` · ${joinRequest.truckReg}` : ""}</p>
                  )}
                  {joinRequest?.amount != null && (
                    <p className="text-sm text-neutral-500 mt-2">
                      Price: <span className="font-semibold text-primary">₹{Number(joinRequest.amount).toLocaleString("en-IN")}</span>
                    </p>
                  )}
                </>
              )}

              {phase === "accepted" && (
                <>
                  <div className="animate-bounce-in mb-5 flex">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center shadow-glow-green">
                      <div className="w-11 h-11 rounded-full bg-success flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                  <h2 className="font-poppins font-bold text-xl text-success mb-1">Load Confirmed!</h2>
                  <p className="text-sm text-neutral-400 mb-4">
                    {joinRequest?.driverName || "Your driver"} will carry your load{joinRequest?.truckReg ? ` — truck ${joinRequest.truckReg}` : ""}.
                  </p>
                  <div className="bg-neutral-50 rounded-xl p-4 mb-4">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Booking ID</p>
                    <p className="font-poppins font-bold text-xl text-neutral-800">{bookingNumber}</p>
                  </div>
                  <div className="flex gap-2.5">
                    <button onClick={() => { dispatch(clearWizardState()); navigate("/track"); }} className="flex-1 bg-primary text-white font-medium py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors">
                      Track Booking
                    </button>
                    <button onClick={() => { dispatch(clearWizardState()); navigate("/"); }} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-2.5 rounded-lg text-sm hover:bg-neutral-50 transition-colors">
                      Back to Home
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: nothing but the map — pickup location only, fixed/locked, full height,
              same shell as FindTruckSearch.jsx's own map panel. */}
          <div className="relative min-w-0 h-full min-h-[420px] bg-neutral-50">
            {hasPickupCoords && (
              <MapView
                markers={searchMapMarkers}
                lockedCenter={lockedCenter}
                lockedZoom={13}
                height="100%"
                className="absolute inset-0"
              />
            )}
            {isActivelySearching && <RadarPulse />}
            {!hasPickupCoords && (
              <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                <p className="max-w-xs text-center text-xs font-medium text-neutral-500 bg-white/90 rounded-lg px-3 py-2 shadow-card">
                  {mapsLoaded ? "Resolving pickup location..." : "Loading map..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
