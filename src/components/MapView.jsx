import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsService, DirectionsRenderer } from "@react-google-maps/api";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";
import { buildTruckIcon } from "../lib/truckIcon";

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }; // Mumbai — used only when there's nothing to fit bounds to

const MARKER_ICON = (color) => `https://maps.google.com/mapfiles/ms/icons/${color || "blue"}-dot.png`;

// Markers default to a plain colored dot, but a live vehicle (see TrackShipment.jsx) reads much
// clearer as an actual truck image — pass iconUrl (+ optional iconSize, default 40px square) to
// use one instead. A marker with `truckCategory` set additionally rotates to face `heading`
// (already resolved to the last-known value by useStableHeadings below — this function has no
// memory of its own, see truckIcon.js). Built lazily (only once Maps JS has loaded) since
// window.google.maps.Size/Point don't exist before then.
const buildMarkerIcon = (marker, isLoaded, heading) => {
  if (!marker.iconUrl && !marker.truckCategory) return { url: MARKER_ICON(marker.color) };
  if (!isLoaded || !window.google?.maps) return undefined;
  const size = marker.iconSize || 40;
  return {
    url: marker.truckCategory ? buildTruckIcon(marker.truckCategory, heading) : marker.iconUrl,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
};

// Remembers the last known-valid heading per marker id, so a fix with no heading (GPS reports
// null while stationary — see useDriverLocationTracking.js) keeps the truck pointed the way it
// was last actually facing instead of snapping back to 0/north. Plain ref, not state — this
// runs synchronously during the same render that receives new marker props, so nothing needs to
// force a re-render on its own account (unlike useAnimatedPositions, which drives an ongoing
// RAF loop and genuinely needs to).
function useStableHeadings(markers) {
  const headingRef = useRef({});
  markers.forEach((m) => {
    const numeric = Number(m.heading);
    if (m.heading != null && Number.isFinite(numeric)) {
      headingRef.current[m.id] = numeric;
    }
    // else: leave whatever was last stored (undefined if this marker has never had one)
  });
  return headingRef.current;
}

// Matches the driver apps' location-ping throttle (MIN_INTERVAL_MS in
// useDriverLocationTracking.js / driver_location_tracker.dart) so each eased tween runs until
// the next fix actually arrives, instead of finishing early and sitting still for the remainder
// of the interval — this is what turns periodic smooth hops into continuous-feeling motion.
const ANIM_MS = 3000;

const easedPositionAt = (anim, now) => {
  const t = Math.min(1, (now - anim.start) / ANIM_MS);
  const eased = 1 - (1 - t) * (1 - t);
  return {
    lat: anim.from.lat + (anim.to.lat - anim.from.lat) * eased,
    lng: anim.from.lng + (anim.to.lng - anim.from.lng) * eased,
  };
};

// Eases marker movement between position updates instead of snapping — most noticeable on
// TrackShipment's live truck marker, which otherwise jumps on every ~7s location poll. Static
// markers (pickup/drop pins) are unaffected: their position never changes once resolved, so
// `from` and `to` are identical and the eased value is just that same point. Unlike a
// permanently-running animation loop, this one only ticks while at least one marker is actually
// mid-transition, then stops — cheap to leave mounted on a page like TrackShipment for minutes.
function useAnimatedPositions(markers) {
  const [, forceTick] = useState(0);
  const animRef = useRef({});
  const rafRef = useRef(null);

  useEffect(() => {
    const now = performance.now();
    const activeIds = new Set();
    markers.forEach((m) => {
      if (!m.position) return;
      activeIds.add(m.id);
      const prev = animRef.current[m.id];
      if (prev && prev.to.lat === m.position.lat && prev.to.lng === m.position.lng) return;
      const from = prev ? easedPositionAt(prev, now) : m.position;
      animRef.current[m.id] = { from, to: m.position, start: now };
    });
    Object.keys(animRef.current).forEach((id) => {
      if (!activeIds.has(id)) delete animRef.current[id];
    });

    if (!rafRef.current) {
      const loop = () => {
        const t = performance.now();
        const stillAnimating = Object.values(animRef.current).some((a) => t - a.start < ANIM_MS);
        forceTick((n) => n + 1);
        rafRef.current = stillAnimating ? requestAnimationFrame(loop) : null;
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [markers]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const now = performance.now();
  const positions = {};
  Object.entries(animRef.current).forEach(([id, anim]) => { positions[id] = easedPositionAt(anim, now); });
  return positions;
}

const MAP_OPTIONS = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

// One route's directions request + rendered polyline. Origin/destination can be lat/lng
// objects or plain address/city strings — the Directions API resolves either. Reports back
// the geocoded start/end points so MapView can still drop pickup/drop pins even when the
// booking only ever stored address text, not raw coordinates (older bookings, city chips).
function RouteRenderer({ route, onResolved }) {
  const [directions, setDirections] = useState(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    setDirections(null);
    setRequested(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.origin, route.destination, JSON.stringify(route.waypoints || [])]);

  if (!route.origin || !route.destination) return null;

  return (
    <>
      {!requested && (
        <DirectionsService
          options={{
            origin: route.origin,
            destination: route.destination,
            waypoints: route.waypoints,
            // Extra loading/unloading stops are visited in the order they were added, not
            // the shortest path — never let Google reorder them.
            optimizeWaypoints: false,
            travelMode: "DRIVING",
          }}
          callback={(result, status) => {
            setRequested(true);
            if (status === "OK" && result) {
              setDirections(result);
              const leg = result.routes[0]?.legs?.[0];
              if (leg) {
                onResolved?.(route.id, { start: leg.start_location.toJSON(), end: leg.end_location.toJSON() });
              }
            }
          }}
        />
      )}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: { strokeColor: route.color || "#1976FF", strokeWeight: 4, strokeOpacity: 0.85 },
          }}
        />
      )}
    </>
  );
}

// Shared map for every SSK client screen that needs one — accepts routes (drawn via the
// Directions API) and markers (plain pins) as props so BookTruck/TrackShipment don't each
// reimplement map plumbing. Loading/error states reuse the same spinner styling used
// elsewhere in the app (e.g. TrackShipment's own "Loading your shipments..." state).
export default function MapView({ routes = [], markers = [], height = "400px", className = "", zoom }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [map, setMap] = useState(null);
  const [resolvedEndpoints, setResolvedEndpoints] = useState({});

  useEffect(() => {
    setResolvedEndpoints({});
  }, [routes.map((r) => r.id).join(",")]);

  const handleResolved = useCallback((routeId, endpoints) => {
    setResolvedEndpoints((prev) => ({ ...prev, [routeId]: endpoints }));
  }, []);

  const routeMarkers = useMemo(
    () =>
      routes.flatMap((route) => {
        const resolved = resolvedEndpoints[route.id];
        if (!resolved) return [];
        return [
          { id: `${route.id}-start`, position: resolved.start, color: "blue", title: route.originLabel || "Pickup" },
          { id: `${route.id}-end`, position: resolved.end, color: "green", title: route.destinationLabel || "Drop" },
        ];
      }),
    [routes, resolvedEndpoints]
  );

  const allMarkers = useMemo(() => [...routeMarkers, ...markers], [routeMarkers, markers]);
  const pointsKey = allMarkers.map((m) => `${m.position?.lat},${m.position?.lng}`).join("|");
  // Bounds-fitting and the map's center below intentionally use each marker's real (target)
  // position, not the animated one — otherwise the viewport would subtly drift/re-fit on every
  // animation frame while a marker is easing into place.
  const animatedPositions = useAnimatedPositions(allMarkers);
  // Rotation is intentionally kept out of useAnimatedPositions — icon changes don't touch
  // `animRef`/the position RAF loop above, so the two stay fully independent as required.
  const stableHeadings = useStableHeadings(allMarkers);

  const onLoad = useCallback((instance) => setMap(instance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  useEffect(() => {
    if (!map || !isLoaded || !window.google || !allMarkers.length) return;
    if (allMarkers.length === 1) {
      map.setCenter(allMarkers[0].position);
      if (!zoom) map.setZoom(13);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    allMarkers.forEach((m) => { if (m.position) bounds.extend(m.position); });
    map.fitBounds(bounds, 56);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, pointsKey]);

  if (loadError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-neutral-50 ${className}`} style={{ height }}>
        <p className="text-sm text-neutral-400">Couldn't load the map right now.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex flex-col items-center justify-center bg-neutral-50 ${className}`} style={{ height }}>
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-2" />
        <p className="text-xs text-neutral-400">Loading map...</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName={className}
      mapContainerStyle={{ width: "100%", height }}
      center={allMarkers[0]?.position || DEFAULT_CENTER}
      zoom={zoom || 12}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={MAP_OPTIONS}
    >
      {routes.map((route) => (
        <RouteRenderer key={route.id} route={route} onResolved={handleResolved} />
      ))}
      {allMarkers.map((m) => (
        <Marker
          key={m.id}
          position={animatedPositions[m.id] || m.position}
          icon={buildMarkerIcon(m, isLoaded, stableHeadings[m.id])}
          title={m.title}
          label={m.label}
        />
      ))}
    </GoogleMap>
  );
}
