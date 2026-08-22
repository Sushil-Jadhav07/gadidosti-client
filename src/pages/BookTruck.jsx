import React, { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  Building2, Route, ArrowUpDown, Check, Truck,
  ArrowRight, ArrowLeft, ArrowDown, MapPin, Package, Weight, Hash, ClipboardList, Zap,
  Pencil, LocateFixed, Plus, X, PackagePlus, PackageMinus,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import NearbyTrucksMap from "../components/NearbyTrucksMap";
import MapView from "../components/MapView";
import ChooseBroker from "./ChooseBroker";
import RequestDriver from "./RequestDriver";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import {
  bookingRef, setStoredDriverRequestId, getStoredDriverRequestId, clearStoredDriverRequestId, haversineDistanceKm,
  getStoredBookingWizardState, setStoredBookingWizardState, clearStoredBookingWizardState,
} from "../utils";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

// Last-resort fallback if /api/config/vehicle-types is unreachable — these prices are only
// ever shown when the live, admin-configured pricing couldn't be fetched at all (see
// configError below), never used to override a real response.
const FALLBACK_CITIES = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad"];
const FALLBACK_MATERIALS = ["Electronics", "Furniture", "Textiles", "Machinery", "Food & Groceries", "Construction Material", "Chemicals", "General Cargo"];
const FALLBACK_TRUCKS = [
  { id: "small", name: "Small Truck", capacity: "Up to 1 Ton", basePrice: 500 },
  { id: "medium", name: "Medium Truck", capacity: "1 - 5 Tons", basePrice: 800 },
  { id: "large", name: "Large Truck", capacity: "5 - 15 Tons", basePrice: 1200 },
  { id: "part", name: "Part Load", capacity: "Shared Space", basePrice: null },
];

const INITIAL_FORM = {
  transportType: null,
  city: "",
  pickup: "",
  pickupLat: null,
  pickupLng: null,
  pickupCity: null,
  drop: "",
  dropLat: null,
  dropLng: null,
  dropCity: null,
  // Extra stops between pickup and drop (Ola/Uber-style "add stop") — each
  // { location, lat, lng }, visited in this array order, never auto-reordered. Loading
  // points are extra pickups (e.g. a second warehouse), unloading points are extra drops.
  loadingLocations: [],
  unloadingLocations: [],
  weight: 1,
  quantity: 1,
  materialType: "",
  notes: "",
  truckType: null,
  selectedTruckId: null,
  selectedTruckReg: null,
};

// A custom-styled, type-to-filter dropdown for Material Type, replacing the native
// <input list="..."> + <datalist> combo — datalist's suggestion popup is rendered by the
// OS/browser (a jarring plain black box on Windows/Chrome) and can't be styled at all.
// Still free-text like the datalist it replaces (admin-configured materialTypes are
// suggestions, not a hard enum), just with a dropdown that matches the rest of the app.
function MaterialTypeInput({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const matches = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all"
      />

      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-lg shadow-card border border-neutral-100 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {matches.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(option); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors border-b border-neutral-50 last:border-b-0 ${
                  value === option ? "bg-primary-50 text-primary font-medium" : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className="truncate">{option}</span>
                {value === option && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookTruck() {
  const toast = useToast();
  const token = getToken();
  // Restored synchronously (not via an effect) so there's no flash of an empty Step 1 before
  // snapping to whatever step/form the client actually had — only for step<5 drafts, since a
  // step>=5 draft means a real booking exists and is instead restored by re-fetching it (the
  // mount effect below), not by trusting a stale local form snapshot.
  const [step, setStep] = useState(() => {
    const stored = getStoredBookingWizardState();
    return stored?.step && stored.step < 5 ? stored.step : 1;
  });
  const [cities, setCities] = useState(FALLBACK_CITIES);
  const [materialTypes, setMaterialTypes] = useState(FALLBACK_MATERIALS);
  const [truckOptions, setTruckOptions] = useState(FALLBACK_TRUCKS);
  const [configError, setConfigError] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  // Bumped by the Retry button to force the price effect to run again without requiring the
  // user to re-touch a field — included in that effect's dependency array below.
  const [quoteRetryToken, setQuoteRetryToken] = useState(0);
  // Identifies the most recent price-fetch attempt so a slow/superseded older request can
  // never clobber a newer one's result — or worse, leave loadingQuote stuck true forever if
  // it resolves after being superseded (see the effect below for how this is used).
  const quoteRequestId = useRef(0);
  const [confirming, setConfirming] = useState(false);
  const [validatingLocation, setValidatingLocation] = useState(false);
  const [form, setForm] = useState(() => {
    const stored = getStoredBookingWizardState();
    return stored?.step && stored.step < 5 && stored.form ? { ...INITIAL_FORM, ...stored.form } : INITIAL_FORM;
  });
  const [focusedField, setFocusedField] = useState(null);
  // Set once the booking is created at Review-confirm; drives the Choose Broker step, which
  // renders inline in this same wizard instead of navigating to a separate route.
  const [createdBooking, setCreatedBooking] = useState(null);
  // Result of POST /api/bookings/:id/request-truck, when a specific truck was picked in Step 3 —
  // set right after booking creation, drives RequestDriver instead of ChooseBroker for step 5
  // until/unless the direct-driver attempt is abandoned (see showBrokerFallback below).
  const [driverRequest, setDriverRequest] = useState(null);
  // Flipped once the direct-driver request is declined, times out and the client gives up
  // waiting, or the client explicitly skips it — switches step 5 over to the broker-broadcast
  // flow, which was already kicked off automatically when the booking was created either way.
  const [showBrokerFallback, setShowBrokerFallback] = useState(false);
  const [locatingPickup, setLocatingPickup] = useState(false);
  // The DOM node NearbyTrucksMap portals its real, truck-populated map into for Step 3 — state
  // (not a plain ref) so the callback ref below re-renders once the node actually mounts,
  // letting the summary panel's right-hand column show the same live map instead of the
  // generic route-only preview it uses on every other step.
  const [truckMapNode, setTruckMapNode] = useState(null);
  // True only while restoring step 5 after a reload (see the mount effect below) — the wizard
  // shows a loading state instead of Step 1 during this window rather than flashing Step 1
  // before jumping to Step 5 a moment later.
  const [rehydrating, setRehydrating] = useState(() => getStoredBookingWizardState()?.step >= 5);

  // Reload recovery — a reload used to always dump the client back to Step 1 even mid-
  // negotiation, since step/createdBooking/driverRequest are all plain useState. Restores
  // Step 5 by re-fetching the booking (for bookingNumber/askingPrice/pickup/drop — none of
  // those are trustworthy from storage alone) and, if a direct-driver request was in flight,
  // the driver request too, deciding the RequestDriver-vs-ChooseBroker branch the same way
  // handleConfirm originally did.
  useEffect(() => {
    const stored = getStoredBookingWizardState();
    if (!stored?.bookingId || stored.step < 5) return;

    (async () => {
      try {
        const bookingRes = await api.get(`/api/bookings/${stored.bookingId}`, token);
        const booking = bookingRes?.data?.booking;
        if (!bookingRes?.success || !booking || booking.status === "cancelled") {
          clearStoredBookingWizardState();
          return;
        }

        setCreatedBooking({
          id: booking.id,
          bookingNumber: bookingRef(booking),
          askingPrice: booking.amount,
          pickup: booking.pickup,
          drop: booking.drop,
        });

        const storedRequestId = getStoredDriverRequestId(booking.id);
        if (storedRequestId) {
          try {
            const requestRes = await api.get(`/api/driver-requests/${storedRequestId}`, token);
            if (requestRes?.success && requestRes.data?.request) {
              setDriverRequest(requestRes.data.request);
            }
          } catch { /* driver request no longer reachable — falls through to the broker flow */ }
        }

        setStep(5);
      } catch {
        clearStoredBookingWizardState();
      } finally {
        setRehydrating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the reload-recovery snapshot current on every step/form change, from Step 1 onward —
  // not just the post-booking-creation case (createdBooking?.id, once it exists). Skipped while
  // the mount effect above is still restoring a step>=5 draft so it can't be clobbered mid-fetch
  // by this effect immediately re-saving the (still default) Step 1 state.
  useEffect(() => {
    if (rehydrating) return;
    setStoredBookingWizardState(step, { form, bookingId: createdBooking?.id });
  }, [step, form, createdBooking, rehydrating]);

  // Loaded here (not just inside PlacesAutocompleteInput) so "Use my current location" knows
  // whether window.google.maps.Geocoder is actually ready before it lets the user click it.
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // key is "loadingLocations" | "unloadingLocations"
  const addStop = (key) => setForm((prev) => ({ ...prev, [key]: [...prev[key], { location: "", lat: null, lng: null }] }));
  const removeStop = (key, index) => setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  const updateStop = (key, index, patch) => setForm((prev) => ({
    ...prev,
    [key]: prev[key].map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
  }));

  // Transport type is no longer a manual choice — it's derived from whichever cities the
  // pickup/drop addresses resolve to: same city → Intra-City, different cities → Inter-City.
  // Only recomputes once BOTH addresses are non-empty; if either resolved without a
  // detectable city (free-typed text, no suggestion picked), it falls back to Inter-City
  // rather than blocking the user indefinitely on an address Google can't classify.
  useEffect(() => {
    if (!form.pickup || !form.drop) return;
    if (form.pickupCity && form.dropCity) {
      const same = form.pickupCity.trim().toLowerCase() === form.dropCity.trim().toLowerCase();
      setForm((prev) => ({ ...prev, transportType: same ? "intra" : "inter", city: same ? form.pickupCity : "" }));
    } else {
      setForm((prev) => ({ ...prev, transportType: "inter", city: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pickup, form.drop, form.pickupCity, form.dropCity]);

  // Reverse-geocodes the browser's GPS position into a street address for the Pickup field —
  // uses google.maps.Geocoder (the Geocoding API, a separate Google product from Places, not
  // part of the AutocompleteService/PlacesService deprecation PlacesAutocompleteInput works
  // around) since reverse geocoding by coordinates isn't something the Places API itself does.
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device or browser");
      return;
    }
    if (!mapsLoaded) {
      toast.error("Map is still loading — please try again in a moment");
      return;
    }
    setLocatingPickup(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const geocoder = new window.google.maps.Geocoder();
          const { results } = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
          const result = results?.[0];
          const address = result?.formatted_address?.replace(/,\s*India$/, "");
          const components = result?.address_components || [];
          const city = components.find((c) => c.types?.includes("locality"))?.long_name
            || components.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name
            || null;
          updateForm("pickup", address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          updateForm("pickupLat", latitude);
          updateForm("pickupLng", longitude);
          updateForm("pickupCity", city);
        } catch {
          toast.error("Couldn't determine your address from this location");
        } finally {
          setLocatingPickup(false);
        }
      },
      (err) => {
        setLocatingPickup(false);
        toast.error(err?.code === err.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get your current location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    const loadConfig = async () => {
      const [citiesRes, vehiclesRes, materialsRes] = await Promise.all([
        api.get("/api/config/cities"),
        api.get("/api/config/vehicle-types"),
        api.get("/api/config/material-types"),
      ]);

      if (citiesRes?.data?.cities?.length) setCities(citiesRes.data.cities);
      if (materialsRes?.data?.materialTypes?.length) setMaterialTypes(materialsRes.data.materialTypes);
      if (vehiclesRes?.data?.vehicleTypes?.length) {
        // basePrice comes straight from the backend (live pricing_config, set in admin's
        // Pricing Management) — never overridden with a local constant here.
        setTruckOptions(vehiclesRes.data.vehicleTypes);
      }
    };

    loadConfig().catch(() => {
      setConfigError(true);
      toast.error("Couldn't load latest booking options, using defaults");
    });
  }, [toast]);

  // Live price estimate: refetch whenever the core fields change, regardless of step
  useEffect(() => {
    if (!form.truckType || !form.pickup || !form.drop || !form.transportType) {
      setPriceBreakdown(null);
      setQuoteError(false);
      return;
    }

    // A fresh id for this attempt — every state update below checks it's still the latest
    // before applying, so a slow/superseded request can never clobber a newer result or
    // (worse) leave loadingQuote stuck true forever after being superseded mid-flight.
    const requestId = ++quoteRequestId.current;
    const isCurrent = () => requestId === quoteRequestId.current;

    const timer = setTimeout(async () => {
      if (!isCurrent()) return;
      setLoadingQuote(true);
      setQuoteError(false);
      try {
        let distance;
        let durationMin;
        let durationInTrafficMin;
        let { pickupLat, pickupLng, dropLat, dropLng } = form;

        // A "Popular Cities" chip (or free-typed text the user never picked a suggestion for)
        // sets pickup/drop text without coordinates — geocode whichever side is missing them
        // before falling back to the backend's distance lookup, since that lookup's
        // LOCATION_PROVIDER=fake stub only recognizes a short hardcoded list of city-name
        // pairs (no same-city entries at all) and 404s on almost everything else.
        if ((pickupLat == null || pickupLng == null || dropLat == null || dropLng == null) && mapsLoaded && window.google?.maps) {
          try {
            const geocoder = new window.google.maps.Geocoder();
            if (pickupLat == null || pickupLng == null) {
              const { results } = await geocoder.geocode({ address: form.pickup });
              const loc = results?.[0]?.geometry?.location;
              if (loc) {
                pickupLat = loc.lat();
                pickupLng = loc.lng();
                updateForm("pickupLat", pickupLat);
                updateForm("pickupLng", pickupLng);
              }
            }
            if (dropLat == null || dropLng == null) {
              const { results } = await geocoder.geocode({ address: form.drop });
              const loc = results?.[0]?.geometry?.location;
              if (loc) {
                dropLat = loc.lat();
                dropLng = loc.lng();
                updateForm("dropLat", dropLat);
                updateForm("dropLng", dropLng);
              }
            }
          } catch {
            // Non-fatal — the /api/config/distance branch below is the last resort.
          }
        }

        // Prefer coordinates (autocomplete selection, or just resolved above) — a straight-line
        // estimate computed entirely client-side, no backend call needed, summed leg-by-leg
        // across every stop in visit order (pickup -> loading stops -> unloading stops ->
        // drop) when extra stops were added. Falls back to the backend's distance lookup only
        // when pickup/drop coordinates still aren't known (geocoding failed or Maps wasn't
        // loaded yet) — extra stops without resolved coordinates are silently skipped from the
        // sum rather than blocking the whole quote, since PlacesAutocompleteInput always
        // resolves lat/lng once a suggestion is actually picked.
        if (pickupLat != null && pickupLng != null && dropLat != null && dropLng != null) {
          const chain = [
            { lat: pickupLat, lng: pickupLng },
            ...form.loadingLocations.filter((s) => s.lat != null && s.lng != null),
            ...form.unloadingLocations.filter((s) => s.lat != null && s.lng != null),
            { lat: dropLat, lng: dropLng },
          ];
          distance = 0;
          for (let i = 0; i < chain.length - 1; i++) {
            distance += haversineDistanceKm(chain[i].lat, chain[i].lng, chain[i + 1].lat, chain[i + 1].lng);
          }
          distance = Math.round(distance * 10) / 10;
        } else {
          const distanceRes = await api.post("/api/config/distance", { pickup: form.pickup, drop: form.drop });
          if (!distanceRes?.success) throw new Error(distanceRes?.message || "Distance unavailable");
          distance = distanceRes.data?.distance || 0;
          // Traffic-aware pricing: feeding these through is what makes the estimate's
          // trafficMultiplier/trafficSurcharge actually reflect live traffic instead of
          // defaulting to "no surge" (see PricingModel.estimate). Not available from the
          // straight-line estimate above, so traffic surge only ever applies in this branch.
          durationMin = distanceRes.data?.durationMin;
          durationInTrafficMin = distanceRes.data?.durationInTrafficMin;
        }

        const pricingRes = await api.post("/api/bookings/quote", {
          truck_category: form.truckType,
          transport_type: form.transportType,
          distance,
          duration_min: durationMin,
          duration_in_traffic_min: durationInTrafficMin,
          // Feeds the nearby-truck-count surge (PricingModel.estimate) — omitted entirely
          // rather than sent as null/undefined when pickup hasn't been geocoded yet.
          ...(form.pickupLat != null && form.pickupLng != null
            ? { pickup_lat: form.pickupLat, pickup_lng: form.pickupLng }
            : {}),
        }, token);
        if (!pricingRes?.success) throw new Error(pricingRes?.message || "Pricing unavailable");
        if (isCurrent()) {
          const pricing = pricingRes.data?.pricing || pricingRes.data || {};
          // Carried through to submitBooking so the booking actually created stores the
          // same traffic-adjusted breakdown the client was quoted, not a fresh no-surge one.
          setPriceBreakdown({ ...pricing, distance, durationMin, durationInTrafficMin });
        }
      } catch {
        if (isCurrent()) {
          setPriceBreakdown(null);
          setQuoteError(true);
        }
      } finally {
        if (isCurrent()) setLoadingQuote(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
    };
  }, [
    form.truckType, form.pickup, form.drop, form.transportType,
    form.pickupLat, form.pickupLng, form.dropLat, form.dropLng,
    JSON.stringify(form.loadingLocations), JSON.stringify(form.unloadingLocations),
    mapsLoaded, token, quoteRetryToken,
  ]);

  // The system-calculated price is the opening ask every broker sees — negotiating from there
  // happens per-broker on the Choose Broker screen (counter-offers), not at booking time.
  const finalAmount = priceBreakdown?.total;

  // Booking is created here, at Review-confirm — *before* a broker or driver is locked in.
  // POST /api/bookings already broadcasts it to brokers automatically. If a specific truck was
  // also picked in Step 3, request-truck sends that truck's driver a direct request in parallel
  // — whichever responds and gets accepted first wins; the other side finds out via a 409 on its
  // own accept attempt. payment_status starts 'pending' regardless of what the client intends to
  // do later.
  const handleConfirm = async () => {
    if (!priceBreakdown?.total) {
      toast.error("Price quote isn't ready yet — please wait a moment and try again.");
      return;
    }

    const composedNotes = form.notes.trim();
    const selectedTruck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;

    setConfirming(true);
    try {
      const response = await api.post("/api/bookings", {
        pickup_location: form.pickup,
        pickup_lat: form.pickupLat,
        pickup_lng: form.pickupLng,
        drop_location: form.drop,
        drop_lat: form.dropLat,
        drop_lng: form.dropLng,
        transport_type: form.transportType,
        city: form.transportType === "intra" ? form.city : undefined,
        truck_type: selectedTruck?.name,
        truck_category: form.truckType,
        weight: form.weight,
        weight_unit: "tons",
        quantity: form.quantity,
        material: form.materialType,
        notes: composedNotes || undefined,
        // No date/time picker in this flow yet — every booking is "now".
        scheduled_date: new Date().toISOString(),
        distance: priceBreakdown.distance,
        duration_min: priceBreakdown.durationMin,
        duration_in_traffic_min: priceBreakdown.durationInTrafficMin,
        amount: finalAmount,
        payment_status: "pending",
        add_loading_location: form.loadingLocations.filter((s) => s.lat != null && s.lng != null),
        add_unloading_location: form.unloadingLocations.filter((s) => s.lat != null && s.lng != null),
      }, token);

      if (!response?.success) throw new Error(response?.message || "Failed to confirm booking");

      const booking = response.data?.booking;
      setCreatedBooking({
        id: booking?.id,
        bookingNumber: bookingRef(booking),
        askingPrice: finalAmount,
        pickup: form.pickup,
        drop: form.drop,
      });

      // A specific truck was picked in Step 3 — try that driver directly before falling back
      // to whatever brokers respond with. Failure here (truck taken in the meantime, etc.) is
      // non-fatal: the booking already exists and was already broadcast to brokers, so step 5
      // just shows the broker flow instead.
      if (form.selectedTruckId && booking?.id) {
        try {
          const requestRes = await api.post(`/api/bookings/${booking.id}/request-truck`, {
            truck_id: form.selectedTruckId,
          }, token);
          if (requestRes?.success && requestRes.data?.request) {
            setDriverRequest(requestRes.data.request);
            setStoredDriverRequestId(booking.id, requestRes.data.request.id);
          }
        } catch {
          // Fall through to the broker flow below.
        }
      }

      setStep(5);
    } catch (err) {
      toast.error(err?.message || "Failed to confirm booking");
    } finally {
      setConfirming(false);
    }
  };

  // The direct-pick driver (and their broker, once looped in after a timeout) both declined —
  // rather than dropping straight into the broker-broadcast flow, let the client pick a
  // different truck for the SAME booking (still 'pending' — the failed attempt never touched
  // its status). Clearing selectedTruckId forces a fresh, explicit pick in Step 3 instead of
  // silently re-requesting the truck that just declined.
  const handleBackToTruckSelection = () => {
    if (createdBooking?.id) clearStoredDriverRequestId(createdBooking.id);
    setDriverRequest(null);
    setForm((f) => ({ ...f, selectedTruckId: null }));
    setStep(3);
  };

  // Re-runs just the request-truck half of handleConfirm against the EXISTING booking — used
  // when the client picks a new truck after handleBackToTruckSelection, so this doesn't create
  // a second, duplicate booking the way calling handleConfirm again would.
  const handleRequestNewTruck = async () => {
    if (!createdBooking?.id || !form.selectedTruckId) {
      setStep(5);
      return;
    }
    setConfirming(true);
    try {
      const requestRes = await api.post(`/api/bookings/${createdBooking.id}/request-truck`, {
        truck_id: form.selectedTruckId,
      }, token);
      if (!requestRes?.success || !requestRes.data?.request) {
        throw new Error(requestRes?.message || "Failed to request this truck");
      }
      setDriverRequest(requestRes.data.request);
      setStoredDriverRequestId(createdBooking.id, requestRes.data.request.id);
      setStep(5);
    } catch (err) {
      toast.error(err?.message || "Failed to request this truck — please try another.");
    } finally {
      setConfirming(false);
    }
  };

  // Gate for leaving the Location step: the backend is the source of truth on whether
  // pickup/drop are valid for the (auto-detected) transport type — only advance once it
  // confirms that.
  const handleValidateLocation = async () => {
    setValidatingLocation(true);
    try {
      const response = await api.post("/api/bookings/validate-location", {
        pickup_location: form.pickup,
        drop_location: form.drop,
        transport_type: form.transportType,
        city: form.transportType === "intra" ? form.city : undefined,
      }, token);

      if (!response?.success) {
        // The backend only reports a generic "Validation failed" — for an intra-city trip
        // the near-universal cause is one of the two addresses falling outside the shared
        // city, so surface that reason directly instead of the opaque backend message.
        const message = form.transportType === "intra" && form.city
          ? `Pickup and drop must both be within ${form.city} for an Intra-City booking. Please choose a location inside ${form.city}.`
          : response?.message || "These pickup/drop locations aren't valid for this trip";
        throw new Error(message);
      }
      setStep(2);
    } catch (err) {
      toast.error(err?.message || "These pickup/drop locations aren't valid for this trip");
    } finally {
      setValidatingLocation(false);
    }
  };

  // The booking's already been created by the time the Choose Broker step is showing — there's
  // no safe "previous step" to rewind to (Review's Confirm button would just create a second,
  // duplicate booking). So going back from Choose Broker restarts the whole wizard fresh instead.
  const resetFlow = () => {
    setStep(1);
    setCreatedBooking(null);
    setDriverRequest(null);
    setShowBrokerFallback(false);
    setForm(INITIAL_FORM);
    setPriceBreakdown(null);
    clearStoredBookingWizardState();
  };

  const canContinue =
    (step === 1 && !!form.pickup && !!form.drop && !!form.transportType) ||
    step === 2 ||
    (step === 3 && !!form.truckType) ||
    (step === 4 && !!priceBreakdown?.total && !loadingQuote);

  // No success screen here anymore — creating the booking just moves on to Choose Broker.
  // "Booking Confirmed" now shows at the end of that screen, after a broker is locked in
  // and payment (if any) is recorded — see ChooseBroker.jsx.

  const truck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;
  const hasSummaryContent = form.transportType || form.pickup || form.drop || form.truckType;

  // Live map — pins fill in as each side gets geocoded (autocomplete selection, "Use current
  // location", or a city chip), full driving route once both are resolved. Always visible
  // (a default-centered blank map before anything's filled in) at the top of the Booking
  // Summary panel below, not a separate card — one combined map+summary panel on every step.
  const hasPickupCoords = form.pickupLat != null && form.pickupLng != null;
  const hasDropCoords = form.dropLat != null && form.dropLng != null;
  const summaryMapRoutes = hasPickupCoords && hasDropCoords ? [{
    id: "summary-map",
    origin: { lat: form.pickupLat, lng: form.pickupLng },
    destination: { lat: form.dropLat, lng: form.dropLng },
    originLabel: form.pickup,
    destinationLabel: form.drop,
  }] : [];
  const summaryMapMarkers = [
    ...(hasPickupCoords && !hasDropCoords ? [{ id: "pickup-only", position: { lat: form.pickupLat, lng: form.pickupLng }, color: "blue", title: form.pickup }] : []),
    ...(hasDropCoords && !hasPickupCoords ? [{ id: "drop-only", position: { lat: form.dropLat, lng: form.dropLng }, color: "green", title: form.drop }] : []),
  ];

  // Defined once, rendered as its own sticky right-hand column on every step — a full-bleed
  // map with the summary as a floating overlay card at the bottom, not a separate section
  // stacked below the map. h-full so this column stretches to match the left form's height
  // (grid's items-stretch below); the map is the whole panel, not a strip above some text.
  const bookingSummaryPanel = (
    <div className="relative rounded-2xl shadow-card overflow-hidden lg:sticky lg:top-6 h-full min-h-[520px]">
      {step === 3 ? (
        // Mount point NearbyTrucksMap portals its real, truck-populated map into (see
        // truckMapNode above) — same full-bleed treatment as MapView below, just a live map
        // with radius circle, traffic and truck markers instead of a plain route line.
        <div ref={setTruckMapNode} className="absolute inset-0" />
      ) : (
        <MapView routes={summaryMapRoutes} markers={summaryMapMarkers} height="100%" className="absolute inset-0" />
      )}

      {hasSummaryContent && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 max-h-[calc(100%-2rem)] overflow-y-auto">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Booking Summary</p>

          {form.transportType && (
            <div className="flex items-center gap-2">
              {form.transportType === "intra" ? (
                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Route className="w-4 h-4 text-success flex-shrink-0" />
              )}
              <span className="text-sm font-medium text-neutral-700">
                {form.transportType === "intra"
                  ? `Intra-City${form.city ? ` · ${form.city}` : ""}`
                  : "Inter-City"}
              </span>
            </div>
          )}

          {(form.pickup || form.drop) && (
            <div className="pt-3 mt-3 border-t border-neutral-100">
              <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Route</p>
              {form.pickup ? (
                <p className="text-sm font-semibold text-neutral-800 truncate">{form.pickup}</p>
              ) : (
                <p className="text-xs text-neutral-400 italic">Pickup pending</p>
              )}
              <ArrowDown className="w-3.5 h-3.5 text-neutral-300 my-1" />
              {form.drop ? (
                <p className="text-sm font-semibold text-neutral-800 truncate">{form.drop}</p>
              ) : (
                <p className="text-xs text-neutral-400 italic">Drop-off pending</p>
              )}
              {(form.loadingLocations.length > 0 || form.unloadingLocations.length > 0) && (
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  +{form.loadingLocations.length} loading, +{form.unloadingLocations.length} unloading stop{(form.loadingLocations.length + form.unloadingLocations.length) === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}

          {truck && (
            <div className="pt-3 mt-3 border-t border-neutral-100">
              <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Truck</p>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-neutral-700">{truck.name}</span>
              </div>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-neutral-100">
            <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Estimated Price</p>
            {loadingQuote ? (
              <div className="flex items-center gap-2 py-2">
                <span className="w-4 h-4 inline-block border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">Calculating...</span>
              </div>
            ) : priceBreakdown?.total ? (
              <div>
                <p className="font-poppins font-bold text-2xl text-primary tabular-nums">
                  ₹{Number(priceBreakdown.total).toLocaleString("en-IN")}
                </p>
                {!!priceBreakdown.distance && (
                  <p className="text-[11px] text-neutral-300 mt-0.5 tabular-nums">~{priceBreakdown.distance} km</p>
                )}

                {priceBreakdown.trafficMultiplier > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" /> Traffic surge ({priceBreakdown.trafficMultiplier}x)
                    </span>
                    <span className="text-xs font-medium text-amber-600">
                      +₹{Number(priceBreakdown.trafficSurcharge).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            ) : quoteError ? (
              <div>
                <p className="text-xs text-danger">Couldn't calculate the price. Please try again.</p>
                <button
                  onClick={() => setQuoteRetryToken((n) => n + 1)}
                  className="text-xs font-semibold text-primary mt-1.5 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                <p className="font-poppins font-bold text-2xl text-neutral-300 tabular-nums">₹ --</p>
                <p className="text-xs text-primary mt-0.5">Pending route completion</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (rehydrating) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center py-24">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-sm text-neutral-400">Restoring your booking...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1 animate-page-enter">
      <div className="w-full flex-1 min-h-0 flex flex-col">
        {step === 5 && createdBooking && driverRequest && !showBrokerFallback ? (
          <RequestDriver
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            initialRequest={driverRequest}
            onBack={() => setStep(4)}
            onFallbackToBrokers={() => setShowBrokerFallback(true)}
            onBackToTruckSelection={handleBackToTruckSelection}
          />
        ) : step === 5 && createdBooking ? (
          <ChooseBroker
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            onBack={() => setStep(4)}
          />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2  items-stretch flex-1 lg:min-h-0">
          {/* Center: Form — wide 2/3-width form + Booking Summary as its own right column,
              the same layout on every step now (no more narrow-sidebar special case). On
              desktop this card is height-bound to the viewport (its flex-col parent chain is
              capped, not just min-height) — only its own step-content area scrolls internally
              (overflow-y-auto no-scrollbar below), so the page itself never needs to scroll and
              the map on the right never has to shrink or scroll to make room. */}
          <div className={`min-w-0 flex flex-col lg:min-h-0 ${step === 4 ? "lg:col-span-2" : "lg:col-span-1"}`}>
            <div className="bg-white shadow-card flex flex-col flex-1 lg:min-h-0 overflow-hidden">
              <div className="flex-1 lg:min-h-0 overflow-y-auto no-scrollbar p-5 md:p-8">
              <StepIndicator currentStep={step} onStepClick={(s) => setStep(s)} embedded />

              {/* Step 1 - Location (pickup/drop; transport type is auto-detected from the
                  two cities, not chosen here) */}
              {step === 1 && (
                <div className="animate-page-enter">
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">
                    Define Route
                  </h2>
                  <p className="text-sm text-neutral-400 mb-4">Enter the pickup and drop-off to calculate the route and estimate delivery times.</p>

                  {/* Pickup/drop entry: a connected rail (dot → dashed line → pin) mirrors the
                      route itself, so the two fields read as one trip instead of two unrelated
                      boxes — the same visual language as most ride-hailing/logistics apps. */}
                  <div className="flex gap-3 mb-3">
                    <div className="flex flex-col items-center pt-6 pb-6 flex-shrink-0 w-4">
                      {/* Blue pickup / green drop matches MapView's own marker colors (see
                          RouteRenderer below and TrackShipment's map) — same trip, same colors. */}
                      <span className="w-3 h-3 rounded-full bg-primary ring-[3px] ring-primary/20 flex-shrink-0" />
                      <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1.5" />
                      <MapPin className="w-4 h-4 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                            Pick-up Location
                          </label>
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={locatingPickup}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                          >
                            {locatingPickup ? (
                              <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            ) : (
                              <LocateFixed className="w-3 h-3" />
                            )}
                            {locatingPickup ? "Locating..." : "Use current location"}
                          </button>
                        </div>
                        <div className="flex items-center bg-white border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                          <PlacesAutocompleteInput
                            value={form.pickup}
                            onChange={(v) => {
                              updateForm("pickup", v);
                              updateForm("pickupLat", null);
                              updateForm("pickupLng", null);
                              updateForm("pickupCity", null);
                            }}
                            onPlaceSelect={({ address, lat, lng, city }) => {
                              updateForm("pickup", address);
                              updateForm("pickupLat", lat);
                              updateForm("pickupLng", lng);
                              updateForm("pickupCity", city);
                            }}
                            inputProps={{ onFocus: () => setFocusedField("pickup") }}
                            placeholder="Enter pickup address or city"
                            className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                          Drop-off Location
                        </label>
                        <div className="flex items-center bg-white border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                          <PlacesAutocompleteInput
                            value={form.drop}
                            onChange={(v) => {
                              updateForm("drop", v);
                              updateForm("dropLat", null);
                              updateForm("dropLng", null);
                              updateForm("dropCity", null);
                            }}
                            onPlaceSelect={({ address, lat, lng, city }) => {
                              updateForm("drop", address);
                              updateForm("dropLat", lat);
                              updateForm("dropLng", lng);
                              updateForm("dropCity", city);
                            }}
                            inputProps={{ onFocus: () => setFocusedField("drop") }}
                            placeholder="Enter drop address or city"
                            className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            pickup: prev.drop,
                            pickupLat: prev.dropLat,
                            pickupLng: prev.dropLng,
                            pickupCity: prev.dropCity,
                            drop: prev.pickup,
                            dropLat: prev.pickupLat,
                            dropLng: prev.pickupLng,
                            dropCity: prev.pickupCity,
                          }));
                        }}
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-primary bg-white flex items-center justify-center hover:bg-primary-50 transition-colors"
                      >
                        <ArrowUpDown className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Ola/Uber-style "add stop" — extra loading points (more pickups) and
                      unloading points (more drops), visited in this order between the main
                      pickup and drop. Purely additive: zero stops behaves exactly as before. */}
                  <div className="mb-4 space-y-3">
                    {[
                      { key: "loadingLocations", label: "Loading Point", icon: PackagePlus },
                      { key: "unloadingLocations", label: "Unloading Point", icon: PackageMinus },
                    ].map(({ key, label, icon: StopIcon }) => (
                      form[key].length > 0 && (
                        <div key={key} className="space-y-2">
                          {form[key].map((stop, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <StopIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                                <PlacesAutocompleteInput
                                  value={stop.location}
                                  onChange={(v) => updateStop(key, index, { location: v, lat: null, lng: null })}
                                  onPlaceSelect={({ address, lat, lng }) => updateStop(key, index, { location: address, lat, lng })}
                                  placeholder={`${label} address`}
                                  className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeStop(key, index)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-danger hover:bg-red-50 flex-shrink-0 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    ))}

                    {/* Both add-stop actions together as a single row of pill buttons, always
                        in the same place below the lists — not trailing each list separately. */}
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => addStop("loadingLocations")}
                        className="flex-1 min-w-[160px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary/15 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Loading Point
                      </button>
                      <button
                        type="button"
                        onClick={() => addStop("unloadingLocations")}
                        className="flex-1 min-w-[160px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary/15 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Unloading Point
                      </button>
                    </div>
                  </div>

                  {/* Auto-detected once both addresses are known — this replaces the old
                      manual Intra-City/Inter-City choice entirely. */}
                  {form.transportType && (
                    <div className={`flex items-center gap-2.5 mb-4 px-3.5 py-2 rounded-lg border ${
                      form.transportType === "intra" ? "border-primary/20 bg-primary-50" : "border-success/20 bg-green-50"
                    }`}>
                      {form.transportType === "intra" ? (
                        <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <Route className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                      <p className={`text-sm font-medium ${form.transportType === "intra" ? "text-primary" : "text-success"}`}>
                        {form.transportType === "intra"
                          ? `Intra-City trip${form.city ? ` — both ends are in ${form.city}` : ""}`
                          : "Inter-City trip — pickup and drop are in different cities"}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Popular Cities</p>
                    <div className="flex flex-wrap gap-2">
                      {cities.map((city) => (
                        <button
                          key={city}
                          onClick={async () => {
                            const target = focusedField === "drop" || (!form.pickup && focusedField !== "pickup") ? "drop" : "pickup";
                            updateForm(target, city);
                            // A city chip already tells us the address's city directly — no
                            // geocoding needed to know pickupCity/dropCity for this one.
                            updateForm(target === "drop" ? "dropCity" : "pickupCity", city);
                            // Clear any stale lat/lng from whatever was there before, then resolve
                            // this city's own coordinates (needed for the live map preview below
                            // and the price-quote effect's straight-line distance) — a plain city
                            // name still geocodes reliably, unlike a full free-typed address.
                            updateForm(target === "drop" ? "dropLat" : "pickupLat", null);
                            updateForm(target === "drop" ? "dropLng" : "pickupLng", null);
                            if (mapsLoaded && window.google?.maps) {
                              try {
                                const geocoder = new window.google.maps.Geocoder();
                                const { results } = await geocoder.geocode({ address: city });
                                const loc = results?.[0]?.geometry?.location;
                                if (loc) {
                                  updateForm(target === "drop" ? "dropLat" : "pickupLat", loc.lat());
                                  updateForm(target === "drop" ? "dropLng" : "pickupLng", loc.lng());
                                }
                              } catch {
                                // Non-fatal — the price-quote effect's own geocoding fallback still
                                // covers this once a truck category is picked in Step 3.
                              }
                            }
                          }}
                          className={`px-3 md:px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                            form.pickup === city || form.drop === city
                              ? "bg-primary text-white"
                              : "bg-primary-50 text-primary hover:bg-primary/15"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 - Load Information */}
              {step === 2 && (
                <div className="animate-page-enter">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-3"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-lg md:text-xl text-neutral-800 mb-1">Load details</h2>
                  <p className="text-xs md:text-sm text-neutral-400 mb-5">A quick overview — helps us match the right truck.</p>

                  <div className="border border-neutral-100 rounded-xl overflow-hidden divide-y divide-neutral-50">
                    {/* Material Type */}
                    <div className="p-3 md:p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <Package className="w-3 h-3 text-primary" />
                        </span>
                        <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Material Type</label>
                      </div>
                      <MaterialTypeInput
                        options={materialTypes}
                        value={form.materialType}
                        onChange={(v) => updateForm("materialType", v)}
                        placeholder="e.g. Electronics, Furniture, Textiles..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-50">
                      {/* Weight */}
                      <div className="p-3 md:p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Weight className="w-3 h-3 text-primary" />
                          </span>
                          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Weight (Tons)</label>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min={0.5}
                            max={50}
                            step={0.5}
                            value={form.weight}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              updateForm("weight", Number.isNaN(v) ? 0.5 : Math.min(50, Math.max(0.5, v)));
                            }}
                            placeholder="0.5"
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 pr-12 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all tabular-nums"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-neutral-400 pointer-events-none">
                            Tons
                          </span>
                        </div>
                        <p className="text-[9px] text-neutral-300 mt-1.5">Recommended: 2–5 Tons</p>
                      </div>

                      {/* Quantity */}
                      <div className="p-3 md:p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Hash className="w-3 h-3 text-primary" />
                          </span>
                          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Items</label>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={form.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              updateForm("quantity", Number.isNaN(v) ? 1 : Math.min(100, Math.max(1, v)));
                            }}
                            placeholder="1"
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 pr-14 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all tabular-nums"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-neutral-400 pointer-events-none">
                            pieces
                          </span>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="p-3 md:p-3.5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="w-3 h-3 text-primary" />
                          </span>
                          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                            Notes <span className="text-neutral-300 normal-case font-normal">(Optional)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <textarea
                            value={form.notes}
                            onChange={(e) => updateForm("notes", e.target.value.slice(0, 200))}
                            placeholder="Special instructions..."
                            rows={2}
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1.5 text-xs text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all resize-none"
                          />
                          <span className="absolute bottom-1 right-2 text-[9px] text-neutral-300">
                            {form.notes.length}/200
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 - Select Truck */}
              {step === 3 && (
                <div className="animate-page-enter">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Pick your truck</h2>
                  <p className="text-sm text-neutral-400 mb-4">Tap a truck below to select it.</p>

                  {/* No more abstract category picker — form.truckType (needed for the price
                      estimate and truck_category on submit) now comes from whichever real
                      nearby truck the user taps, via its own category field. */}
                  <NearbyTrucksMap
                    pickupLat={form.pickupLat}
                    pickupLng={form.pickupLng}
                    dropLat={form.dropLat}
                    dropLng={form.dropLng}
                    stops={[...form.loadingLocations, ...form.unloadingLocations]}
                    selectedTruckId={form.selectedTruckId}
                    truckOptions={truckOptions}
                    mapPortalNode={truckMapNode}
                    onSelectTruck={(t) => {
                      updateForm("selectedTruckId", t.id);
                      updateForm("truckType", t.category);
                      updateForm("selectedTruckReg", t.registration);
                    }}
                  />
                </div>
              )}

              {/* Step 4 - Review & Pay */}
              {step === 4 && (
                <div className="animate-page-enter">
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Review Booking Details</h2>
                  <p className="text-sm text-neutral-400 mb-6">Please review your booking details before confirming.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">
                    {/* Route — its own card, same icon-header style as Cargo/Vehicle below. */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                          <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Route className="w-3.5 h-3.5 text-primary" />
                          </span>
                          Route
                        </p>
                        <button
                          onClick={() => setStep(1)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>

                      {/* Same dot → dashed line → pin rail as the pickup/drop step, so this
                          reads as the same trip rather than a plain two-line address block. */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center pt-1 pb-1 flex-shrink-0 w-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1" />
                          <MapPin className="w-3.5 h-3.5 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div>
                            <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Pickup</p>
                            <p className="font-poppins font-semibold text-sm text-neutral-800 truncate">{form.pickup}</p>
                          </div>
                          {form.loadingLocations.map((s, i) => (
                            <p key={`l${i}`} className="text-xs text-neutral-500 truncate flex items-center gap-1"><PackagePlus className="w-3 h-3 flex-shrink-0" /> {s.location}</p>
                          ))}
                          {form.unloadingLocations.map((s, i) => (
                            <p key={`u${i}`} className="text-xs text-neutral-500 truncate flex items-center gap-1"><PackageMinus className="w-3 h-3 flex-shrink-0" /> {s.location}</p>
                          ))}
                          <div>
                            <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Drop-off</p>
                            <p className="font-poppins font-semibold text-sm text-neutral-800 truncate">{form.drop}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cargo + Vehicle — split into their own cards, side by side. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border border-neutral-100 rounded-xl p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-3">
                          <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Package className="w-3.5 h-3.5 text-primary" />
                          </span>
                          Cargo
                        </p>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Type</span>
                            <span className="text-xs font-medium text-neutral-700 truncate">{form.materialType || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Weight</span>
                            <span className="text-xs font-medium text-neutral-700 tabular-nums">{form.weight} Tons</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Items</span>
                            <span className="text-xs font-medium text-neutral-700 tabular-nums">{form.quantity}</span>
                          </div>
                          {form.notes && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-neutral-400 flex-shrink-0">Notes</span>
                              <span className="text-xs font-medium text-neutral-700 truncate">{form.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border border-neutral-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                            <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                              <Truck className="w-3.5 h-3.5 text-primary" />
                            </span>
                            Vehicle
                          </p>
                          <button
                            onClick={() => setStep(3)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Type</span>
                            <span className="text-xs font-medium text-neutral-700 truncate">{truck?.name || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Capacity</span>
                            <span className="text-xs font-medium text-neutral-700 truncate">{truck?.capacity || "—"}</span>
                          </div>
                          {form.selectedTruckReg && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Registration</span>
                              <span className="text-xs font-medium text-neutral-700 truncate">{form.selectedTruckReg}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right: Cost Breakdown + pay-later note — its own column, same as the
                      reference's layout (this page has no map, so nothing else takes the
                      remaining width). */}
                  <div className="lg:col-span-1 space-y-4">
                    {/* Real fields straight off /api/bookings/quote's breakdown — only ever
                        the ones that response actually returned (varies by truck category/
                        transport type), never invented line items like fuel/insurance/taxes
                        we have no real figures for. */}
                    {priceBreakdown && (
                      <div className="border border-neutral-100 rounded-xl p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-3">
                          <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="w-3.5 h-3.5 text-primary" />
                          </span>
                          Cost Breakdown
                        </p>
                        <div className="space-y-2">
                          {priceBreakdown.baseFare != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Base Fare</span>
                              <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(priceBreakdown.baseFare).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {priceBreakdown.distanceFare != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Distance Fare{priceBreakdown.distance ? ` (${priceBreakdown.distance} km)` : ""}</span>
                              <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(priceBreakdown.distanceFare).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {priceBreakdown.totalTruckCost != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Truck Cost{priceBreakdown.distance ? ` (${priceBreakdown.distance} km)` : ""}</span>
                              <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(priceBreakdown.totalTruckCost).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {!!priceBreakdown.trafficSurcharge && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Traffic Surcharge</span>
                              <span className="text-xs font-medium text-amber-600 tabular-nums">+₹{Number(priceBreakdown.trafficSurcharge).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {!!priceBreakdown.supplySurcharge && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Demand Surcharge</span>
                              <span className="text-xs font-medium text-amber-600 tabular-nums">+₹{Number(priceBreakdown.supplySurcharge).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {priceBreakdown.platformFee != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400">Platform Fee</span>
                              <span className="text-xs font-medium text-neutral-700 tabular-nums">₹{Number(priceBreakdown.platformFee).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                          <span className="text-sm font-semibold text-neutral-800">Total Estimated</span>
                          <span className="font-poppins font-bold text-lg text-primary tabular-nums">₹{Number(priceBreakdown.total).toLocaleString("en-IN")}</span>
                        </div>

                        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4 h-4 text-primary" />
                          </span>
                          <p className="text-xs text-neutral-500">Once a driver or broker confirms your booking, you'll choose to pay now or pay later.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}
              </div>

              {/* Navigation Buttons — pinned as the card's own footer, not the page's, so
                  Back/Next stay put without scrolling even while the step content above
                  scrolls internally. */}
              <div className="flex gap-3 justify-end px-5 md:px-8 py-4 border-t border-neutral-100 flex-shrink-0">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-5 md:px-6 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[0.98] transition-all"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => {
                    if (step === 1) handleValidateLocation();
                    else if (step < 4) setStep(step + 1);
                    // A truck was (re-)picked after handleBackToTruckSelection cleared
                    // driverRequest — request it against the existing booking instead of just
                    // resuming Step 5 with nothing to show there.
                    else if (createdBooking && !driverRequest && form.selectedTruckId) handleRequestNewTruck();
                    // Revisiting Review via the Negotiation screen's back arrow means the
                    // booking already exists — just return to it instead of re-running
                    // handleConfirm, which would POST a second, duplicate booking.
                    else if (createdBooking) setStep(5);
                    else handleConfirm();
                  }}
                  disabled={!canContinue || confirming || validatingLocation}
                  className="group px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2"
                >
                  {step === 4 ? (confirming ? "Confirming..." : createdBooking ? "Back to Negotiation" : "Confirm & Proceed to Negotiation")
                    : step === 1 ? (validatingLocation ? "Validating..." : "Next Step")
                    : "Continue"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Live Booking Summary — its own column on every step except Review, which
              has no map in its reference design and doesn't need one (the Cost Breakdown card
              already covers the price). h-full so the panel's own h-full (map as the flexible
              fill) has something concrete to stretch against — the grid's items-stretch above
              only stretches this wrapper, not its content. */}
          {step !== 4 && (
            <div className="lg:col-span-1 min-w-0 h-full">
              {bookingSummaryPanel}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
