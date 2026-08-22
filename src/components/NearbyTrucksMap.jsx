import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GoogleMap, useJsApiLoader, Marker, Circle, DirectionsService, DirectionsRenderer, TrafficLayer } from "@react-google-maps/api";
import { io } from "socket.io-client";
import { Truck as TruckIcon, Check } from "lucide-react";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";
import { TRUCK_IMAGES } from "../lib/truckImages";
import { api, getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const RADIUS_PRESETS_KM = [5, 10, 25, 50];
const ANIM_MS = 1000;

// A muted, minimal-label theme (no business/POI icons, no transit clutter, pale roads and
// water) — the same general look ride-hailing apps use so the map reads as a clean canvas
// for our own pickup/drop/truck markers rather than a busy default Google Maps tile.
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d8e3" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  // Lets the mouse wheel zoom directly instead of showing Google's "use ctrl+scroll" nag,
  // appropriate here since this map lives in its own fixed-height panel, not a full page.
  gestureHandling: "greedy",
};
// The muted style above only applies to this component's own small standalone fallback box
// (no mapPortalNode) — portaled into the wizard's shared right-hand panel (the normal case),
// it stays the same default Google colors every other step's map already uses, not a
// suddenly-different-looking map once Step 3 loads.
const MAP_OPTIONS_MUTED = { ...MAP_OPTIONS, styles: MAP_STYLE };

// A real teardrop pin with a soft drop shadow (not the tiny legacy "-dot" icon) so
// pickup/drop are unmistakable against the map — a white core on a solid color, matching
// the blue-pickup/green-drop convention used everywhere else in this app (MapView,
// TrackShipment, the address step). Built once per color via useMemo below (NOT called
// inline in JSX) — this map re-renders on every animation frame while trucks are moving,
// and rebuilding a fresh data-URI/Size/Point object 60x/second made Google Maps repeatedly
// reload the icon, flickering it invisible more often than not.
const buildPinIcon = (color) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36">` +
    `<defs><filter id="s" x="-60%" y="-20%" width="220%" height="180%">` +
    `<feDropShadow dx="0" dy="1.5" stdDeviation="1.3" flood-color="#000" flood-opacity="0.35"/>` +
    `</filter></defs>` +
    `<g filter="url(#s)">` +
    `<path d="M13 1.5C7 1.5 2 6.4 2 12.3 2 21 13 33.5 13 33.5s11-12.5 11-21.2C24 6.4 19 1.5 13 1.5z" fill="${color}"/>` +
    `<circle cx="13" cy="12.3" r="4.6" fill="#fff"/>` +
    `</g></svg>`
  )}`,
  scaledSize: new window.google.maps.Size(26, 36),
  anchor: new window.google.maps.Point(13, 33.5),
});

const easedPositionAt = (anim, now) => {
  const t = Math.min(1, (now - anim.start) / ANIM_MS);
  const eased = 1 - (1 - t) * (1 - t);
  return {
    lat: anim.from.lat + (anim.to.lat - anim.from.lat) * eased,
    lng: anim.from.lng + (anim.to.lng - anim.from.lng) * eased,
  };
};

// Interpolates every truck's displayed marker position toward its latest known target
// (initial REST fetch, or a live socket push) over ANIM_MS instead of snapping — one rAF
// loop drives all of them since there's only ever a handful of trucks in view at once.
function useAnimatedPositions(targets) {
  const [positions, setPositions] = useState({});
  const animRef = useRef({});
  const rafRef = useRef(null);

  useEffect(() => {
    const now = performance.now();
    const activeIds = new Set();
    targets.forEach((t) => {
      activeIds.add(t.id);
      const prev = animRef.current[t.id];
      if (prev && prev.to.lat === t.lat && prev.to.lng === t.lng) return;
      const from = prev ? easedPositionAt(prev, now) : { lat: t.lat, lng: t.lng };
      animRef.current[t.id] = { from, to: { lat: t.lat, lng: t.lng }, start: now };
    });
    Object.keys(animRef.current).forEach((id) => {
      if (!activeIds.has(id)) delete animRef.current[id];
    });
  }, [targets]);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const next = {};
      Object.entries(animRef.current).forEach(([id, anim]) => { next[id] = easedPositionAt(anim, now); });
      setPositions(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return positions;
}

// Live "trucks near your pickup" panel for the Truck-selection step: a REST snapshot
// (re-fetched on radius/category/capacity change) seeds the list and map, then a Socket.IO
// connection — same server/auth pattern as ChatWindow — streams live position updates for
// exactly the trucks currently in view, joining/leaving tracking rooms as that set changes.
export default function NearbyTrucksMap({
  pickupLat, pickupLng, dropLat, dropLng, stops = [], truckCategory, capacity, selectedTruckId, onSelectTruck,
  // Real admin-configured per-category starting prices (/api/config/vehicle-types, loaded by
  // BookTruck) — looked up per truck below so the list can show an approximate price without
  // fabricating one; a category with no match in truckOptions just omits the price.
  truckOptions = [],
  // A DOM node (state, not a ref — see BookTruck's callback ref) to portal the actual Google
  // Map into, so it can render full-bleed in the wizard's right-hand column instead of the
  // small inline box this component used to draw on its own. Falls back to the original
  // inline map (unchanged) when no portal target is given, so this component still works
  // standalone if used elsewhere.
  mapPortalNode = null,
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [radiusKm, setRadiusKm] = useState(10);
  const [trucks, setTrucks] = useState([]);
  const [loadingTrucks, setLoadingTrucks] = useState(false);
  const [trucksError, setTrucksError] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [liveByTruck, setLiveByTruck] = useState({}); // truckId -> { lat, lng, lastLocationAt }

  const socketRef = useRef(null);
  const joinedIdsRef = useRef(new Set());
  const hasPickup = pickupLat != null && pickupLng != null;

  // One socket per mount (i.e. for as long as the Truck step is open) — join/leave for
  // individual trucks happens separately below, as the nearby list changes underneath it.
  useEffect(() => {
    const socket = io(BASE, { auth: { token: getToken() }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("truck-location", ({ truckId, lat, lng, lastLocationAt }) => {
      setLiveByTruck((prev) => ({ ...prev, [truckId]: { lat, lng, lastLocationAt } }));
    });

    return () => {
      joinedIdsRef.current.forEach((id) => socket.emit("leave-truck-tracking", { truckId: id }));
      joinedIdsRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Nearby-trucks REST snapshot — refetched on pickup point, radius, or filter change.
  useEffect(() => {
    if (!hasPickup) { setTrucks([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingTrucks(true);
      setTrucksError(false);
      try {
        const params = new URLSearchParams({ pickup_lat: pickupLat, pickup_lng: pickupLng, radius_km: radiusKm });
        if (truckCategory) params.set("truck_category", truckCategory);
        if (capacity) params.set("capacity", capacity);
        const res = await api.get(`/api/vehicles/trucks/nearby?${params.toString()}`, getToken());
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.message || "Failed to load nearby trucks");
        setTrucks(res.data?.trucks || []);
      } catch {
        if (!cancelled) { setTrucks([]); setTrucksError(true); }
      } finally {
        if (!cancelled) setLoadingTrucks(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hasPickup, pickupLat, pickupLng, radiusKm, truckCategory, capacity]);

  // Keep the socket's tracked-truck set in sync with whichever trucks are currently listed —
  // a truck that drops out of the nearby list on refetch gets explicitly un-tracked.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const currentIds = new Set(trucks.map((t) => String(t.id)));
    currentIds.forEach((id) => {
      if (!joinedIdsRef.current.has(id)) {
        socket.emit("join-truck-tracking", { truckId: id }, () => {});
        joinedIdsRef.current.add(id);
      }
    });
    [...joinedIdsRef.current].forEach((id) => {
      if (!currentIds.has(id)) {
        socket.emit("leave-truck-tracking", { truckId: id });
        joinedIdsRef.current.delete(id);
      }
    });
  }, [trucks]);

  const targets = useMemo(() => trucks
    .map((t) => {
      const live = liveByTruck[t.id];
      const lat = live?.lat ?? t.currentLat;
      const lng = live?.lng ?? t.currentLng;
      return lat == null || lng == null ? null : { id: String(t.id), lat, lng };
    })
    .filter(Boolean), [trucks, liveByTruck]);

  const animatedPositions = useAnimatedPositions(targets);
  const sortedTrucks = useMemo(
    () => [...trucks].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
    [trucks]
  );

  // Stable object identities across the ~60fps animation-driven re-renders above — without
  // this, GoogleMap/Marker/Circle would see a "changed" prop every single frame (even though
  // the actual lat/lng/color never did) and redo work needlessly.
  const center = useMemo(
    () => (hasPickup ? { lat: pickupLat, lng: pickupLng } : undefined),
    [hasPickup, pickupLat, pickupLng]
  );
  const dropPosition = useMemo(
    () => (dropLat != null && dropLng != null ? { lat: dropLat, lng: dropLng } : undefined),
    [dropLat, dropLng]
  );
  // Extra loading/unloading points (Ola-style add-stop) — visited in the order they were
  // added, never reordered by Google (optimizeWaypoints: false below), since load/unload
  // order is operationally meaningful, not just a shortest-path problem.
  const waypoints = useMemo(
    () => stops.filter((s) => s.lat != null && s.lng != null).map((s) => ({ location: { lat: s.lat, lng: s.lng }, stopover: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(stops)]
  );
  const pickupIcon = useMemo(() => (isLoaded ? buildPinIcon("#1976FF") : undefined), [isLoaded]);
  const dropIcon = useMemo(() => (isLoaded ? buildPinIcon("#17D86B") : undefined), [isLoaded]);
  const circleOptions = useMemo(() => ({
    fillColor: "#1976FF",
    fillOpacity: 0.08,
    strokeColor: "#1976FF",
    strokeOpacity: 0.4,
    strokeWeight: 1.5,
    clickable: false,
  }), []);
  // One small icon per (category, hovered?) pair — a handful of combinations at most, built
  // once the map's loaded rather than freshly on every animation-frame re-render.
  const truckIcons = useMemo(() => {
    if (!isLoaded) return {};
    const icons = {};
    Object.entries(TRUCK_IMAGES).forEach(([category, url]) => {
      [20, 26, 30].forEach((size) => {
        icons[`${category}-${size}`] = {
          url,
          scaledSize: new window.google.maps.Size(size, size),
          anchor: new window.google.maps.Point(size / 2, size / 2),
        };
      });
    });
    return icons;
  }, [isLoaded]);

  // The actual driving route between pickup and drop (not just a straight line) — the same
  // black polyline convention Uber/Ola use. Re-requested only when pickup/drop actually
  // change (the reset effect below), never on the ~60fps animation-driven re-renders.
  const [directions, setDirections] = useState(null);
  const [directionsRequested, setDirectionsRequested] = useState(false);

  useEffect(() => {
    setDirections(null);
    setDirectionsRequested(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, dropPosition?.lat, dropPosition?.lng, JSON.stringify(waypoints)]);

  const directionsRendererOptions = useMemo(() => ({
    suppressMarkers: true,
    preserveViewport: true,
    polylineOptions: { strokeColor: "#000000", strokeWeight: 4, strokeOpacity: 0.85 },
  }), []);

  // Real admin-configured starting price for this truck's category (/api/config/vehicle-types)
  // — "starting" since the actual quote depends on distance/traffic, computed once this truck
  // is picked. Omitted entirely (never a fabricated number) when the category has no match.
  const priceFor = (t) => truckOptions.find((o) => o.id === t.category)?.basePrice;

  const listContent = (
    <div>
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Trucks near your pickup</p>
      <div className="flex items-center gap-1.5 mb-3">
        {RADIUS_PRESETS_KM.map((km) => (
          <button
            key={km}
            type="button"
            onClick={() => setRadiusKm(km)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              radiusKm === km ? "bg-primary text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {km} km
          </button>
        ))}
      </div>

      {!hasPickup ? (
        <div className="bg-neutral-50 rounded-xl p-4 text-center text-xs text-neutral-400">
          Select a precise pickup address (from the suggestions list in Step 2) to see nearby trucks.
        </div>
      ) : loadingTrucks && trucks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-2" />
          <p className="text-xs text-neutral-400">Finding trucks nearby...</p>
        </div>
      ) : trucksError ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <p className="text-xs text-neutral-400">Couldn't load nearby trucks. Try a different radius.</p>
        </div>
      ) : sortedTrucks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <TruckIcon className="w-6 h-6 text-neutral-200 mb-1.5" />
          <p className="text-xs text-neutral-400">No trucks within {radiusKm} km right now. Try a wider radius.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedTrucks.map((t) => {
            const isSelected = String(selectedTruckId) === String(t.id);
            const price = priceFor(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTruck?.(t)}
                onMouseEnter={() => setHoveredId(String(t.id))}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative w-full p-3.5 flex items-start gap-3 text-left rounded-xl border transition-all ${
                  isSelected ? "border-primary bg-primary-50" : hoveredId === String(t.id) ? "border-neutral-300 bg-neutral-50" : "border-neutral-200 bg-white"
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-card">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
                <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1.5 border border-neutral-100">
                  {TRUCK_IMAGES[t.category] ? (
                    <img src={TRUCK_IMAGES[t.category]} alt={t.category} className="w-full h-full object-contain" />
                  ) : (
                    <TruckIcon className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{t.registration}</p>
                    {price != null && (
                      <span className="text-sm font-bold text-primary flex-shrink-0 tabular-nums">~₹{Number(price).toLocaleString("en-IN")}</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{[t.make, t.type].filter(Boolean).join(" · ") || t.type}</p>

                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-neutral-100">
                    <div>
                      <p className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wide">Capacity</p>
                      <p className="text-[11px] font-medium text-neutral-600">{t.capacity || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wide">Distance</p>
                      <p className="text-[11px] font-medium text-neutral-600">{t.distanceKm != null ? `${Number(t.distanceKm).toFixed(1)} km` : "—"}</p>
                    </div>
                    <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-success">
                      <span className="w-1 h-1 rounded-full bg-success animate-pulse" /> Live
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const mapContent = !hasPickup ? (
    <div className="h-full flex items-center justify-center bg-neutral-50">
      <p className="text-sm text-neutral-400 text-center px-6">Select a precise pickup address to see nearby trucks on the map.</p>
    </div>
  ) : loadError ? (
    <div className="h-full flex items-center justify-center bg-neutral-50">
      <p className="text-sm text-neutral-400">Couldn't load the map right now.</p>
    </div>
  ) : !isLoaded ? (
    <div className="h-full flex flex-col items-center justify-center bg-neutral-50">
      <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-2" />
      <p className="text-sm text-neutral-400">Loading map...</p>
    </div>
  ) : (
    <>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={center} zoom={13} options={mapPortalNode ? MAP_OPTIONS : MAP_OPTIONS_MUTED}>
        {/* Google's live traffic layer — congestion coloring plus incident icons
            (accidents, closures, construction) drawn directly on the road tiles. */}
        <TrafficLayer />
        <Circle center={center} radius={radiusKm * 1000} options={circleOptions} />
        {center && dropPosition && !directionsRequested && (
          <DirectionsService
            options={{
              origin: center,
              destination: dropPosition,
              waypoints,
              optimizeWaypoints: false,
              travelMode: "DRIVING",
              // Routes and durations reflect current traffic conditions, not just
              // free-flow distance — matching what Ola/Uber factor into their route.
              drivingOptions: { departureTime: new Date(), trafficModel: "bestguess" },
            }}
            callback={(result, status) => {
              setDirectionsRequested(true);
              if (status === "OK" && result) setDirections(result);
            }}
          />
        )}
        {directions && <DirectionsRenderer directions={directions} options={directionsRendererOptions} />}
        <Marker position={center} icon={pickupIcon} title="Pickup" zIndex={1000} />
        {dropPosition && <Marker position={dropPosition} icon={dropIcon} title="Drop" zIndex={1000} />}
        {trucks.map((t) => {
          const pos = animatedPositions[String(t.id)];
          if (!pos) return null;
          const isSelected = String(selectedTruckId) === String(t.id);
          const isHovered = hoveredId === String(t.id);
          const size = isSelected ? 30 : isHovered ? 26 : 20;
          return (
            <Marker
              key={t.id}
              position={pos}
              title={`${t.registration}${t.distanceKm != null ? ` · ${Number(t.distanceKm).toFixed(1)} km away` : ""}`}
              zIndex={isSelected ? 1000 : isHovered ? 999 : undefined}
              icon={truckIcons[`${t.category}-${size}`]}
              onClick={() => onSelectTruck?.(t)}
            />
          );
        })}
      </GoogleMap>
      {loadingTrucks && trucks.length > 0 && (
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-card">
          <span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] text-neutral-500">Updating...</span>
        </div>
      )}
    </>
  );

  // With a portal target (BookTruck's Step 3 right-hand column), the map renders full-bleed
  // there instead of the small inline box below the list — falls back to the original
  // side-by-side inline layout if no target was given.
  if (mapPortalNode) {
    return (
      <>
        {listContent}
        {createPortal(mapContent, mapPortalNode)}
      </>
    );
  }

  return (
    <div className="mt-5">
      {listContent}
      <div className="relative rounded-xl overflow-hidden border border-neutral-100 mt-3" style={{ height: "300px" }}>
        {mapContent}
      </div>
    </div>
  );
}
