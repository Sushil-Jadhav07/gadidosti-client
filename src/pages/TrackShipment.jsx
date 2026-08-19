import React, { useEffect, useState } from "react";
import { Search, Phone, Check, Truck, MapPin, Clock, AlertTriangle, MessageCircle, Package, Hash, PackagePlus, PackageMinus, CheckCircle2 } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import BottomSheet from "../components/BottomSheet";
import ChatWindow from "../components/ChatWindow";
import MapView from "../components/MapView";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef, formatBookingStatus, TIMELINE_STEPS } from "../utils";
import { useTripStatusSocket } from "../hooks/useTripStatusSocket";
import { useTruckLocationSocket } from "../hooks/useTruckLocationSocket";

// Friendly, non-technical phrasing for the tracking banner — never expose the raw enum value.
const INCIDENT_REASON_LABELS = {
  accident: "an accident",
  breakdown: "a vehicle breakdown",
  traffic_block: "a traffic block",
  medical: "a medical issue",
  other: "an issue",
};

const MECHANIC_STATUS_LABELS = {
  requested: "We're arranging a mechanic now.",
  mechanic_assigned: "A mechanic has been arranged and is on the way.",
  in_progress: "The mechanic is working on the vehicle.",
  resolved: "The issue has been resolved.",
};

// Statuses where the driver is actually en route and worth polling live position for —
// matches formatBookingStatus's labels (adaptBooking already converts the raw enum).
const LIVE_TRACKING_LABELS = ["Assigned", "En Route", "Picked Up", "In Transit"];
// Once the cargo's actually been picked up, the meaningful route is "truck's current position
// -> drop", not the original pickup -> drop line (the truck's already left pickup by now).
const POST_PICKUP_LABELS = ["Picked Up", "In Transit"];
const TRACK_POLL_MS = 7000;
// Only redraw the live route once the truck has moved a meaningful distance — the Directions
// API would otherwise be re-queried every single 7s poll (a fresh object every render, even
// when the coordinates haven't meaningfully changed), which is wasteful for a leg that can run
// for a long time. 150m is small enough that the drawn route still tracks real progress.
const ROUTE_ORIGIN_UPDATE_THRESHOLD_M = 150;

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatEta = (minutes) => {
  if (minutes == null) return "Calculating...";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function TrackShipment() {
  const { user } = useAuth();
  const [searchId, setSearchId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBooking, setActiveBooking] = useState(null);
  const [incident, setIncident] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [noBookingsYet, setNoBookingsYet] = useState(false);
  const token = getToken();

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const response = await api.get("/api/bookings?limit=100", token);
        const list = response?.data?.bookings || response?.data || [];
        const live = list.find((b) => ["assigned", "en_route_pickup", "picked_up", "in_transit"].includes(b.status)) || list[0];
        if (live) {
          setActiveBooking(adaptBooking(live));
        } else {
          setNoBookingsYet(true);
        }
      } catch {
        setNoBookingsYet(true);
      } finally {
        setLoading(false);
      }
    };

    loadLatest();
  }, [token]);

  // Booking list/search responses don't carry incident or live-location data — both only
  // come back from the dedicated tracking endpoint, polled every few seconds while the
  // shipment is actually en route (per the backend's own polling comment on that route).
  // refreshTick lets the trip-status-updated socket handler below force an immediate re-poll
  // (bumping it re-runs this effect, which calls poll() right away) instead of waiting out the
  // rest of the current 7s interval — the poll is still what actually supplies driverLat/
  // driverLng, since those come from a different backend source (the driver's live device
  // position) than the socket payload's trip-scoped location.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!activeBooking?.id) {
      setIncident(null);
      setTracking(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await api.get(`/api/bookings/${activeBooking.id}/track`, token);
        if (cancelled) return;
        const data = response?.data || {};
        setIncident(data.incident || null);
        setTracking({
          driverLat: data.driverLat,
          driverLng: data.driverLng,
          driverHeading: data.driverHeading,
          etaMinutes: data.etaMinutes,
          distanceRemainingKm: data.distanceRemainingKm,
          isTerminal: !!data.isTerminal,
          deliveredAt: data.deliveredAt,
        });
      } catch {
        if (!cancelled) setIncident(null);
      }
    };

    poll();
    const interval = LIVE_TRACKING_LABELS.includes(activeBooking.status) ? setInterval(poll, TRACK_POLL_MS) : null;
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [activeBooking?.id, activeBooking?.status, token, refreshTick]);

  // Live push — the moment the driver's trip status changes (picked up, delivered, etc.), this
  // updates the status badge/labels instantly instead of waiting up to 7s for the next poll,
  // and immediately triggers a fresh poll (above) to pick up the location/ETA fields that go
  // with the new status. No reload needed.
  useTripStatusSocket((trip) => {
    if (!trip?.bookingId || trip.bookingId !== activeBooking?.id) return;
    setActiveBooking((current) => (current ? { ...current, status: formatBookingStatus(trip.status) } : current));
    setRefreshTick((n) => n + 1);
  });

  // Primary path for the live truck marker while a trip is actually en route — updates
  // lat/lng/heading the instant a location ping lands, instead of waiting out the rest of the
  // 7s poll interval above. The poll (still running per the same LIVE_TRACKING_LABELS gate)
  // remains the fallback: if this socket is disconnected, `tracking` just keeps getting
  // refreshed from there instead, same as before this existed.
  useTruckLocationSocket(
    LIVE_TRACKING_LABELS.includes(activeBooking?.status) ? activeBooking?.truckId : null,
    ({ lat, lng, heading }) => {
      setTracking((current) =>
        current ? { ...current, driverLat: lat, driverLng: lng, driverHeading: heading } : current
      );
    }
  );

  // Throttled live route origin for the post-pickup phase — see POST_PICKUP_LABELS/
  // ROUTE_ORIGIN_UPDATE_THRESHOLD_M above for why this only updates on real movement.
  const [liveRouteOrigin, setLiveRouteOrigin] = useState(null);
  useEffect(() => {
    if (!POST_PICKUP_LABELS.includes(activeBooking?.status) || tracking?.driverLat == null || tracking?.driverLng == null) {
      setLiveRouteOrigin(null);
      return;
    }
    const lat = Number(tracking.driverLat);
    const lng = Number(tracking.driverLng);
    setLiveRouteOrigin((current) => {
      if (!current || haversineMeters(current.lat, current.lng, lat, lng) >= ROUTE_ORIGIN_UPDATE_THRESHOLD_M) {
        return { lat, lng };
      }
      return current;
    });
  }, [activeBooking?.status, tracking?.driverLat, tracking?.driverLng]);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setSearching(true);
    try {
      const query = searchId.trim();
      const response = await api.get(`/api/bookings/${query}`, token);
      setSearchQuery(query);
      setActiveBooking(adaptBooking(response.data?.booking));
    } catch {
      setSearchQuery(searchId.trim());
      setActiveBooking(null);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // Extra loading/unloading stops (Ola/Uber-style add-stop) between pickup and drop — empty
  // for the vast majority of bookings, which keeps the rail exactly as it always looked.
  const routeStops = (activeBooking?.stops || []).filter((s) => s.type === "loading" || s.type === "unloading");

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      {/* Search Bar */}
      <div className="flex gap-3 mb-6 md:mb-8 w-full max-w-xl">
        <div className="flex-1 flex items-center bg-white border border-neutral-200 rounded-lg px-4 py-3 shadow-card focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
          <Search className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter Booking ID (e.g., BKG-202412-001)"
            className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 md:px-6 bg-primary rounded-lg text-white text-sm font-medium flex items-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {searching ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 md:py-32 bg-white rounded-xl shadow-card">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-400">Loading your shipments...</p>
        </div>
      ) : activeBooking ? (
        <>
          {incident && (
            <div className="bg-orange-50 border border-yellow-200 rounded-xl p-4 mb-5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  Your driver reported {INCIDENT_REASON_LABELS[incident.reason] || "an issue"} and support has been notified.
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {incident.reason === "breakdown" && incident.mechanicStatus
                    ? MECHANIC_STATUS_LABELS[incident.mechanicStatus] || "We're arranging a solution and will keep you updated."
                    : "We're arranging a solution and will keep you updated."}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6">
          {/* Left Panel */}
          <div className="lg:col-span-2 space-y-4 md:space-y-5">
            {/* Booking Summary Card */}
            <div className="bg-white rounded-xl shadow-card p-5">
              {/* Ref + actions on their own row — kept separate from the address rail below so
                  long real addresses (not short city names) never squeeze this row unevenly. */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <p className="text-xs text-neutral-400 font-medium">{bookingRef(activeBooking)}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-8 h-8 rounded-lg bg-primary-50 text-primary flex items-center justify-center hover:bg-primary/15 transition-colors"
                    title="Chat"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <StatusBadge status={activeBooking.status} />
                </div>
              </div>

              {/* Route rail — pickup, any extra loading/unloading stops, then drop, each on its
                  own full-width line so a long real street address always wraps cleanly instead
                  of squeezing two columns of text into one row. */}
              <div className="flex gap-3 pb-4 border-b border-neutral-50">
                <div className="flex flex-col items-center pt-1 flex-shrink-0 w-4">
                  <span className="w-3 h-3 rounded-full bg-primary ring-[3px] ring-primary/20 flex-shrink-0" />
                  <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1.5" />
                  {routeStops.map((_, i) => (
                    <span key={i} className="flex flex-col items-center flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1.5" />
                    </span>
                  ))}
                  <MapPin className="w-4 h-4 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <p className="font-poppins font-semibold text-sm text-neutral-800">{activeBooking.pickup}</p>
                  {routeStops.map((stop, i) => {
                    const StopIcon = stop.type === "loading" ? PackagePlus : PackageMinus;
                    return (
                      <p key={i} className="text-sm text-neutral-600 flex items-center gap-1.5">
                        <StopIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        {stop.location}
                        {stop.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                      </p>
                    );
                  })}
                  <p className="font-poppins font-semibold text-sm text-neutral-800">{activeBooking.drop}</p>
                </div>
              </div>

              {/* Truck Info */}
              {activeBooking.truckReg && (
                <div className="flex items-center justify-between py-3 border-t border-neutral-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-neutral-700">{activeBooking.truckReg}</span>
                  </div>
                  <span className="text-xs font-medium bg-primary-50 text-primary px-2.5 py-1 rounded-full">
                    {activeBooking.truckType}
                  </span>
                </div>
              )}

              {/* Driver Info */}
              {/* Backend always returns a driver object ({name: null, phone: null} before assignment) —
                  check for an actual name, not just object presence, or this crashes on .split(" "). */}
              {activeBooking.driver?.name && (
                <div className="flex items-center justify-between py-3 border-t border-neutral-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {activeBooking.driver.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-700">{activeBooking.driver.name}</p>
                      <p className="text-xs text-neutral-400">{activeBooking.driver.phone}</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${activeBooking.driver.phone}`}
                    className="w-9 h-9 rounded-full bg-success flex items-center justify-center shadow-glow-green hover:opacity-90 transition-opacity"
                  >
                    <Phone className="w-4 h-4 text-white" />
                  </a>
                </div>
              )}
            </div>

            {/* Status Timeline — horizontal */}
            <div className="bg-white rounded-xl shadow-card p-5">
              <h3 className="font-poppins font-semibold text-base text-neutral-800 mb-4">Shipment Timeline</h3>
              {(() => {
                const visibleSteps = TIMELINE_STEPS.map((step, index) => ({ step, index }))
                  .filter(({ index }) => index <= Math.min(activeBooking.currentStep + 1, TIMELINE_STEPS.length - 1));

                return (
                  <>
                    <div className="flex items-start overflow-x-auto no-scrollbar pb-1">
                      {visibleSteps.map(({ step, index }, i) => {
                        const isCompleted = index < activeBooking.currentStep;
                        const isCurrent = index === activeBooking.currentStep;
                        const isLast = i === visibleSteps.length - 1;

                        return (
                          <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"} min-w-[70px]`}>
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isCompleted
                                    ? "bg-success"
                                    : isCurrent
                                    ? "bg-primary ring-4 ring-primary/15"
                                    : "border-2 border-neutral-200 bg-white"
                                }`}
                              >
                                {isCompleted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />}
                              </div>
                              <span
                                className={`text-[11px] mt-1.5 text-center whitespace-nowrap ${
                                  isCompleted ? "text-success font-medium" : isCurrent ? "text-primary font-semibold" : "text-neutral-300"
                                }`}
                              >
                                {step}
                              </span>
                            </div>
                            {!isLast && (
                              <div className={`flex-1 h-0.5 mx-1 mb-4 ${isCompleted ? "bg-success" : "bg-neutral-100"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {activeBooking.currentStep < TIMELINE_STEPS.length && (
                      <p className="text-[11px] text-neutral-400 mt-3">
                        Current Status: <span className="font-medium text-primary">{TIMELINE_STEPS[activeBooking.currentStep]}</span>
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl shadow-card p-4">
                <p className="text-[11px] text-neutral-400 mb-1">Weight</p>
                <p className="font-poppins font-bold text-lg text-neutral-800">
                  {activeBooking.weight} {activeBooking.weightUnit}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-card p-4">
                <p className="text-[11px] text-neutral-400 mb-1">Amount</p>
                <p className="font-poppins font-bold text-lg text-primary">
                  ₹{activeBooking.amount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Map Panel */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-card overflow-hidden h-full min-h-[300px] md:min-h-[400px] lg:min-h-[500px] relative">
              <MapView
                routes={[{
                  id: activeBooking.id,
                  origin: liveRouteOrigin
                    ? liveRouteOrigin
                    : activeBooking.pickupLat != null && activeBooking.pickupLng != null
                    ? { lat: Number(activeBooking.pickupLat), lng: Number(activeBooking.pickupLng) }
                    : activeBooking.pickup,
                  destination: activeBooking.dropLat != null && activeBooking.dropLng != null
                    ? { lat: Number(activeBooking.dropLat), lng: Number(activeBooking.dropLng) }
                    : activeBooking.drop,
                  originLabel: liveRouteOrigin ? "Your truck" : activeBooking.pickup,
                  destinationLabel: activeBooking.drop,
                  waypoints: routeStops
                    .filter((s) => s.lat != null && s.lng != null)
                    .map((s) => ({ location: { lat: Number(s.lat), lng: Number(s.lng) }, stopover: true })),
                }]}
                markers={[
                  ...(tracking?.driverLat != null && tracking?.driverLng != null ? [{
                    id: "truck",
                    position: { lat: Number(tracking.driverLat), lng: Number(tracking.driverLng) },
                    truckCategory: activeBooking.truckCategory || "medium",
                    heading: tracking.driverHeading,
                    iconSize: 44,
                    title: tracking.isTerminal ? "Delivered here" : "Your truck",
                  }] : []),
                  // Numbered stop markers between pickup/drop, matching the rail's order.
                  ...routeStops
                    .filter((s) => s.lat != null && s.lng != null)
                    .map((s, i) => ({
                      id: `stop-${i}`,
                      position: { lat: Number(s.lat), lng: Number(s.lng) },
                      color: "yellow",
                      label: String(i + 1),
                      title: s.location,
                    })),
                ]}
                height="100%"
                className="absolute inset-0"
              />

              {/* Live / Delivered chip */}
              {tracking?.isTerminal ? (
                <div className="absolute top-4 left-4 z-10 bg-secondary text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg pointer-events-none">
                  <Check className="w-3 h-3" strokeWidth={3} />
                  Delivered
                </div>
              ) : (
                <div className="absolute top-4 left-4 z-10 bg-success text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-white animate-green-pulse" />
                  Live Tracking
                </div>
              )}

              {/* Booking ID chip */}
              <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md border border-white/60 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 pointer-events-none">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Hash className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide leading-none mb-0.5">Tracking</p>
                  <p className="text-xs font-semibold text-neutral-700 leading-none">{bookingRef(activeBooking)}</p>
                </div>
              </div>

              {/* ETA / Delivered-at Chip */}
              <div className="absolute bottom-5 right-5 z-10 bg-white/90 backdrop-blur-md border border-white/60 rounded-xl px-4 md:px-5 py-3 shadow-lg flex items-center gap-3 pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {tracking?.isTerminal ? <Check className="w-5 h-5 text-primary" strokeWidth={3} /> : <Clock className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide leading-none mb-1">
                    {tracking?.isTerminal ? "Delivered At" : "Estimated Arrival"}
                  </p>
                  <p className="font-poppins font-bold text-base text-neutral-800 leading-none">
                    {tracking?.isTerminal ? (formatDateTime(tracking.deliveredAt) || "—") : formatEta(tracking?.etaMinutes)}
                  </p>
                </div>
              </div>

              {/* Material info chip */}
              <div className="absolute bottom-5 left-5 z-10 bg-white/90 backdrop-blur-md border border-white/60 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 pointer-events-none">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide leading-none mb-0.5">Cargo</p>
                  <p className="text-xs font-semibold text-neutral-700 leading-none">{activeBooking.material}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{activeBooking.weight} {activeBooking.weightUnit}</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 md:py-32 bg-white rounded-xl shadow-card">
          <MapPin className="w-16 h-16 text-neutral-200 mb-4" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">
            {noBookingsYet && !searchQuery ? "No shipments to track yet" : "Booking not found"}
          </h3>
          <p className="text-sm text-neutral-400 text-center px-4">
            {noBookingsYet && !searchQuery
              ? "Book a truck to start tracking your shipments here."
              : `No booking found with ID "${searchQuery}". Please check and try again.`}
          </p>
        </div>
      )}

      <BottomSheet isOpen={showChat} onClose={() => setShowChat(false)}>
        {activeBooking && (
          <div>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-3">Chat &mdash; {bookingRef(activeBooking)}</h3>
            <ChatWindow bookingId={activeBooking.id} currentUserId={user?.id} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
