import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  Building2, Route, ArrowUpDown, Check, Truck,
  ArrowRight, ArrowLeft, ArrowDown, MapPin, Package, Weight, Hash, ClipboardList, Zap,
  Pencil, LocateFixed, Plus, X, PackagePlus, PackageMinus, Crosshair, Radar, CalendarClock, Ruler, Phone,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import MapView from "../components/MapView";
import ChooseBroker from "./ChooseBroker";
import FindTruckSearch from "./FindTruckSearch";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import {
  bookingRef, haversineDistanceKm,
  getStoredBookingWizardState, setStoredBookingWizardState, clearStoredBookingWizardState,
} from "../utils";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

// Backend default when search_radius_km is omitted (see gadidosti-backend's
// booking.controller.js DEFAULT_BROADCAST_RADIUS_KM) — mirrored here purely so the slider
// starts wherever an omitted radius would resolve to server-side, not because the client needs
// to omit it (the new UI always sends search_radius_km explicitly in "truck" mode).
const DEFAULT_SEARCH_RADIUS_KM = 15;

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
  // Book Now / Book Later ("is_scheduled") — see the toggle at the top of Step 1.
  bookingMode: "now",
  scheduledDateTime: "",
  // Find Truck vs Search for Broker — mutually exclusive, chosen in Step 3. Exactly one of
  // these two branches is ever populated/sent; there's no third "send neither" UI path anymore.
  searchMode: null,
  searchRadiusKm: DEFAULT_SEARCH_RADIUS_KM,
  selectedBrokerId: null,
  selectedBrokerName: null,
};

// Straight-line distance across the full visit order — pickup -> loading stops -> unloading
// stops -> drop — used both for the live "~X km" shown as soon as both ends are picked (Step 1,
// no truck type needed yet) and by the price-quote effect below, so the two never disagree.
function chainDistanceKm({ pickupLat, pickupLng, dropLat, dropLng, loadingLocations, unloadingLocations }) {
  if (pickupLat == null || pickupLng == null || dropLat == null || dropLng == null) return null;
  const chain = [
    { lat: pickupLat, lng: pickupLng },
    ...loadingLocations.filter((s) => s.lat != null && s.lng != null),
    ...unloadingLocations.filter((s) => s.lat != null && s.lng != null),
    { lat: dropLat, lng: dropLng },
  ];
  let distance = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    distance += haversineDistanceKm(chain[i].lat, chain[i].lng, chain[i + 1].lat, chain[i + 1].lng);
  }
  return Math.round(distance * 10) / 10;
}

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
        className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all"
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

// Step 5 for a Book Later booking — POST /api/bookings already created it (status 'pending'),
// but the backend deliberately holds off broadcasting to anyone until ~2h before scheduled_date
// (a cron sweep fires it automatically, see gadidosti-backend's scheduledBookingBroadcastSweep.js),
// so there's nothing to negotiate or wait on here yet. Just confirms the schedule and sends the
// client back to their bookings instead of dropping them into a live waiting screen that would
// never update.
function ScheduledConfirmation({ booking, navigate }) {
  const audience = booking.searchMode === "broker" ? (booking.brokerName || "your selected broker") : "nearby drivers";
  const formattedDate = booking.scheduledDate
    ? new Date(booking.scheduledDate).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="p-5 md:p-8">
        <StepIndicator currentStep={5} onStepClick={undefined} embedded />
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-5">
            <CalendarClock className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-poppins font-bold text-2xl text-neutral-800 mb-2">Booking Scheduled!</h2>
          <p className="text-sm text-neutral-500 max-w-md mb-1">{booking.pickup} → {booking.drop}</p>
          {formattedDate && (
            <p className="text-sm font-semibold text-primary mb-4">{formattedDate}</p>
          )}
          <p className="text-sm text-neutral-500 max-w-md mb-8">
            We'll notify {audience} closer to your pickup time — you don't need to do anything else right now.
          </p>
          <div className="bg-neutral-50 rounded-xl p-5 mb-8 w-full max-w-xs">
            <p className="text-xs text-neutral-400 mb-1">Booking ID</p>
            <p className="font-poppins font-bold text-2xl text-neutral-800">{booking.bookingNumber}</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => { clearStoredBookingWizardState(); navigate(`/bookings/${booking.id}`); }}
              className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors"
            >
              View Booking
            </button>
            <button
              onClick={() => { clearStoredBookingWizardState(); navigate("/"); }}
              className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookTruck() {
  const toast = useToast();
  const navigate = useNavigate();
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
  // Quick-pick chips on Step 1 (see the Saved Addresses section, right above Popular Cities) —
  // fetched once, same as cities/materialTypes below, just from a different endpoint since
  // these are per-client, not admin-configured.
  const [savedAddresses, setSavedAddresses] = useState([]);
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
  // Set once the booking is created at Review-confirm; drives the Choose Broker / Find Truck /
  // Scheduled-confirmation step, which renders inline in this same wizard instead of navigating
  // to a separate route. isScheduled/searchMode/searchRadiusKm come straight off the booking
  // projection the server returned (or re-fetched on reload) — never assumed from local form
  // state — since that's the single source of truth for which step-5 view to show.
  const [createdBooking, setCreatedBooking] = useState(null);
  const [locatingPickup, setLocatingPickup] = useState(false);
  // Live "you are here" blue dot on the Step 1 map — watched only while Step 1 is showing, not
  // for the whole wizard's lifetime, since nothing past Step 1 needs it.
  const [myLocation, setMyLocation] = useState(null);
  // Which field a map tap fills: "pickup" | "drop" | { key: "loadingLocations"|"unloadingLocations", index }.
  // Defaults to whichever of pickup/drop is still empty (see the auto-advance effect below), but
  // stays put once a stop is explicitly armed via its own "pin on map" button.
  const [pinTarget, setPinTarget] = useState("pickup");
  // Eligible-brokers list for the "Search for Broker" card in Step 3 — fetched lazily the first
  // time that card is picked (not on every Step 3 visit, since a client who picks "Find Truck"
  // never needs it), scoped to the booking's city when it's known (intra-city only).
  const [eligibleBrokers, setEligibleBrokers] = useState([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [brokersError, setBrokersError] = useState(false);
  // True only while restoring step 5 after a reload (see the mount effect below) — the wizard
  // shows a loading state instead of Step 1 during this window rather than flashing Step 1
  // before jumping to Step 5 a moment later.
  const [rehydrating, setRehydrating] = useState(() => getStoredBookingWizardState()?.step >= 5);

  // Reload recovery — a reload used to always dump the client back to Step 1 even mid-
  // negotiation, since step/createdBooking are plain useState. Restores Step 5 by re-fetching
  // the booking (for bookingNumber/askingPrice/pickup/drop/isScheduled/searchMode/
  // searchRadiusKm — none of those are trustworthy from storage alone). Which child component
  // step 5 renders is then decided the same way it is right after creation — see the render
  // branch below — so there's no separate driver-request lookup here: FindTruckSearch and
  // ChooseBroker both discover their own in-flight negotiation on mount.
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
          isScheduled: !!booking.isScheduled,
          scheduledDate: booking.date || null,
          searchMode: booking.searchMode || null,
          searchRadiusKm: booking.searchRadiusKm,
          brokerName: null,
        });

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

  // GET /api/bookings/eligible-brokers — called lazily (see the effect below), not eagerly on
  // every Step 3 visit, and callable again directly from the Retry link on failure.
  const loadEligibleBrokers = async () => {
    setLoadingBrokers(true);
    setBrokersError(false);
    try {
      const qs = form.city ? `?city=${encodeURIComponent(form.city)}` : "";
      const res = await api.get(`/api/bookings/eligible-brokers${qs}`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to load brokers");
      setEligibleBrokers(res.data?.brokers || []);
    } catch {
      setBrokersError(true);
    } finally {
      setLoadingBrokers(false);
    }
  };

  useEffect(() => {
    if (form.searchMode === "broker" && !eligibleBrokers.length && !loadingBrokers && !brokersError) {
      loadEligibleBrokers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.searchMode]);

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

  // Live blue dot — only while Step 1 is actually showing, so this doesn't keep the GPS radio
  // active for the rest of the wizard (or after the client leaves this page mid-flow).
  useEffect(() => {
    if (step !== 1 || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silent — the blue dot just doesn't appear, rest of Step 1 still works */ },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [step]);

  // Keeps the map-tap target pointed at whichever of pickup/drop is still empty, so a client who
  // never touches the pill selector still gets sensible tap-to-pin behavior by default. Only
  // acts while pinTarget is "pickup"/"drop" — never overrides an explicit stop pin (an object).
  useEffect(() => {
    if (typeof pinTarget !== "string") return;
    if (!form.pickup) { setPinTarget("pickup"); return; }
    if (!form.drop) setPinTarget("drop");
  }, [form.pickup, form.drop]);

  // Shared by every "resolve a raw {lat,lng} into an address" path below — map taps, marker
  // drags, and the live-location auto-fill — so there's exactly one place that decides how a
  // point becomes a display address + city, matching what "Use current location" above already did.
  const reverseGeocode = async (lat, lng) => {
    const geocoder = new window.google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    const result = results?.[0];
    const address = result?.formatted_address?.replace(/,\s*India$/, "") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const components = result?.address_components || [];
    const city = components.find((c) => c.types?.includes("locality"))?.long_name
      || components.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name
      || null;
    return { address, city };
  };

  // Reverse-geocodes a tapped map point into whichever field pinTarget currently points at.
  const handleMapClick = async ({ lat, lng }) => {
    if (!mapsLoaded || !window.google?.maps) return;
    try {
      const { address, city } = await reverseGeocode(lat, lng);
      if (pinTarget === "pickup") {
        updateForm("pickup", address);
        updateForm("pickupLat", lat);
        updateForm("pickupLng", lng);
        updateForm("pickupCity", city);
      } else if (pinTarget === "drop") {
        updateForm("drop", address);
        updateForm("dropLat", lat);
        updateForm("dropLng", lng);
        updateForm("dropCity", city);
      } else if (pinTarget && typeof pinTarget === "object") {
        updateStop(pinTarget.key, pinTarget.index, { location: address, lat, lng });
      }
    } catch {
      toast.error("Couldn't resolve an address for that point");
    }
  };

  // Once a pickup/drop pin exists on the Step 1 map, it's draggable — fine-tuning the exact spot
  // (a specific gate, dock, building entrance) by dragging beats re-searching an address for it.
  const handlePinDragEnd = async (target, { lat, lng }) => {
    if (!mapsLoaded || !window.google?.maps) return;
    try {
      const { address, city } = await reverseGeocode(lat, lng);
      if (target === "pickup") {
        updateForm("pickup", address);
        updateForm("pickupLat", lat);
        updateForm("pickupLng", lng);
        updateForm("pickupCity", city);
      } else {
        updateForm("drop", address);
        updateForm("dropLat", lat);
        updateForm("dropLng", lng);
        updateForm("dropCity", city);
      }
    } catch {
      toast.error("Couldn't resolve an address for that point");
    }
  };

  // Pickup defaults to the client's own live location the moment it's known — mirrors how most
  // ride-hailing apps start the pickup pin at "where you are" rather than an empty field, while
  // still leaving it fully draggable/editable from there. Only fires once (guarded on
  // form.pickup being empty) — never overrides an address the client already typed, searched,
  // tapped, or dragged in.
  useEffect(() => {
    if (step !== 1 || form.pickup || !myLocation || !mapsLoaded || !window.google?.maps) return;
    let cancelled = false;
    (async () => {
      try {
        const { address, city } = await reverseGeocode(myLocation.lat, myLocation.lng);
        if (cancelled) return;
        updateForm("pickup", address);
        updateForm("pickupLat", myLocation.lat);
        updateForm("pickupLng", myLocation.lng);
        updateForm("pickupCity", city);
      } catch {
        // Silent — the client can still search or tap the map manually.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, myLocation, mapsLoaded, form.pickup]);

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

  // Saved-address quick-picks for Step 1 — a separate, silent-on-failure fetch from the public
  // config load above, since this is a nice-to-have shortcut, not something worth an error toast
  // over (the client can still just type/search an address like always).
  useEffect(() => {
    api.get("/api/addresses", token)
      .then((res) => { if (res?.success) setSavedAddresses(res.data?.addresses || []); })
      .catch(() => {});
  }, [token]);

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
          distance = chainDistanceKm({
            pickupLat, pickupLng, dropLat, dropLng,
            loadingLocations: form.loadingLocations, unloadingLocations: form.unloadingLocations,
          });
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

  // Whether Step 1's Book Later date/time is actually valid to submit — used both to gate the
  // Step 1 "Next" button and as a final guard here in case the client leaves it stale while
  // clicking around between steps.
  const scheduledDateTimeValid = form.bookingMode !== "later"
    || (!!form.scheduledDateTime && new Date(form.scheduledDateTime).getTime() > Date.now());

  // Booking is created here, at Review-confirm. search_mode/search_radius_km/broker_id (Step 3)
  // and is_scheduled/scheduled_date (Step 1's Book Later toggle) are the two new, mutually-
  // independent axes POST /api/bookings now takes — search_mode picks the audience (fan out to
  // every nearby driver, or send to exactly one broker), is_scheduled just defers WHEN that
  // audience is notified (immediately, or ~2h before scheduled_date via the backend's own cron
  // sweep). The booking itself is always created immediately either way, status 'pending'.
  const handleConfirm = async () => {
    if (!priceBreakdown?.total) {
      toast.error("Price quote isn't ready yet — please wait a moment and try again.");
      return;
    }
    if (!scheduledDateTimeValid) {
      toast.error("Please choose a future date and time for your scheduled booking.");
      return;
    }
    if (!form.searchMode) {
      toast.error("Please choose how you'd like to find a truck.");
      return;
    }
    if (form.searchMode === "broker" && !form.selectedBrokerId) {
      toast.error("Please select a broker.");
      return;
    }

    const composedNotes = form.notes.trim();
    const selectedTruck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;
    const isScheduled = form.bookingMode === "later";

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
        scheduled_date: isScheduled ? new Date(form.scheduledDateTime).toISOString() : new Date().toISOString(),
        ...(isScheduled ? { is_scheduled: true } : {}),
        distance: priceBreakdown.distance,
        duration_min: priceBreakdown.durationMin,
        duration_in_traffic_min: priceBreakdown.durationInTrafficMin,
        amount: finalAmount,
        payment_status: "pending",
        add_loading_location: form.loadingLocations.filter((s) => s.lat != null && s.lng != null),
        add_unloading_location: form.unloadingLocations.filter((s) => s.lat != null && s.lng != null),
        search_mode: form.searchMode,
        ...(form.searchMode === "truck" ? { search_radius_km: form.searchRadiusKm } : {}),
        ...(form.searchMode === "broker" ? { broker_id: form.selectedBrokerId } : {}),
      }, token);

      if (!response?.success) throw new Error(response?.message || "Failed to confirm booking");

      const booking = response.data?.booking;
      setCreatedBooking({
        id: booking?.id,
        bookingNumber: bookingRef(booking),
        askingPrice: finalAmount,
        pickup: form.pickup,
        drop: form.drop,
        isScheduled: !!booking?.isScheduled,
        scheduledDate: booking?.date || (isScheduled ? form.scheduledDateTime : null),
        searchMode: booking?.searchMode || form.searchMode,
        searchRadiusKm: booking?.searchRadiusKm ?? form.searchRadiusKm,
        brokerName: form.searchMode === "broker" ? form.selectedBrokerName : null,
      });

      setStep(5);
    } catch (err) {
      toast.error(err?.message || "Failed to confirm booking");
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

  // The booking's already been created by the time the Choose Broker/Find Truck step is
  // showing — there's no safe "previous step" to rewind to (Review's Confirm button would just
  // create a second, duplicate booking). So going back restarts the whole wizard fresh instead.
  const resetFlow = () => {
    setStep(1);
    setCreatedBooking(null);
    setForm(INITIAL_FORM);
    setPriceBreakdown(null);
    setEligibleBrokers([]);
    clearStoredBookingWizardState();
  };

  const canContinue =
    (step === 1 && !!form.pickup && !!form.drop && !!form.transportType && scheduledDateTimeValid) ||
    step === 2 ||
    (step === 3 && !!form.truckType && !!form.searchMode && (form.searchMode !== "broker" || !!form.selectedBrokerId)) ||
    (step === 4 && !!priceBreakdown?.total && !loadingQuote);

  // No success screen here anymore — creating the booking just moves on to Choose Broker.
  // "Booking Confirmed" now shows at the end of that screen, after a broker is locked in
  // and payment (if any) is recorded — see ChooseBroker.jsx.

  const truck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;
  const hasSummaryContent = form.transportType || form.pickup || form.drop || form.truckType;

  // Earliest value the Book Later datetime-local input accepts — "now" expressed in local time
  // (datetime-local's value/min are always local, never UTC), nudged 5 minutes out so a client
  // who picks exactly "now" doesn't immediately fail the backend's "must be in the future" check.
  const minScheduleValue = (() => {
    const d = new Date(Date.now() + 5 * 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  })();

  // Live map — pins fill in as each side gets geocoded (autocomplete selection, "Use current
  // location", or a city chip), full driving route once both are resolved. Always visible
  // (a default-centered blank map before anything's filled in) at the top of the Booking
  // Summary panel below, not a separate card — one combined map+summary panel on every step.
  const hasPickupCoords = form.pickupLat != null && form.pickupLng != null;
  const hasDropCoords = form.dropLat != null && form.dropLng != null;
  // Shown the moment both ends are picked, well before a truck type (and therefore a real
  // price quote) is chosen in Step 3 — see chainDistanceKm above.
  const routeDistanceKm = chainDistanceKm({
    pickupLat: form.pickupLat, pickupLng: form.pickupLng, dropLat: form.dropLat, dropLng: form.dropLng,
    loadingLocations: form.loadingLocations, unloadingLocations: form.unloadingLocations,
  });
  const summaryMapRoutes = hasPickupCoords && hasDropCoords ? [{
    id: "summary-map",
    origin: { lat: form.pickupLat, lng: form.pickupLng },
    destination: { lat: form.dropLat, lng: form.dropLng },
    originLabel: form.pickup,
    destinationLabel: form.drop,
  }] : [];
  // Step 1 always uses explicit, draggable pickup/drop pins instead of the route-inferred ones
  // other steps fall back to — dragging needs a marker MapView isn't deriving from a Directions
  // result itself (see suppressRouteMarkers on the MapView call below).
  const summaryMapMarkers = step === 1 ? [
    ...(hasPickupCoords ? [{
      id: "pickup", position: { lat: form.pickupLat, lng: form.pickupLng }, color: "blue",
      title: form.pickup || "Pickup — drag to adjust", draggable: true,
      onDragEnd: (pt) => handlePinDragEnd("pickup", pt),
    }] : []),
    ...(hasDropCoords ? [{
      id: "drop", position: { lat: form.dropLat, lng: form.dropLng }, color: "green",
      title: form.drop || "Drop-off — drag to adjust", draggable: true,
      onDragEnd: (pt) => handlePinDragEnd("drop", pt),
    }] : []),
  ] : [
    ...(hasPickupCoords && !hasDropCoords ? [{ id: "pickup-only", position: { lat: form.pickupLat, lng: form.pickupLng }, color: "blue", title: form.pickup }] : []),
    ...(hasDropCoords && !hasPickupCoords ? [{ id: "drop-only", position: { lat: form.dropLat, lng: form.dropLng }, color: "green", title: form.drop }] : []),
  ];

  // Defined once, rendered as its own sticky right-hand column on every step — a full-bleed
  // map with the summary as a floating overlay card at the bottom, not a separate section
  // stacked below the map. h-full so this column stretches to match the left form's height
  // (grid's items-stretch below); the map is the whole panel, not a strip above some text.
  const bookingSummaryPanel = (
    <div className="relative rounded-2xl shadow-card overflow-hidden lg:sticky lg:top-6 h-full min-h-[520px]">
      <MapView
        routes={summaryMapRoutes}
        markers={summaryMapMarkers}
        height="100%"
        className="absolute inset-0"
        {...(step === 1 ? { onMapClick: handleMapClick, myLocation, suppressRouteMarkers: true } : {})}
      />

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
              {routeDistanceKm != null && (
                <p className="text-xs font-semibold text-primary mt-1.5 tabular-nums">~{routeDistanceKm} km</p>
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
        {step === 5 && createdBooking && createdBooking.isScheduled ? (
          // Book Later — nothing to negotiate yet, the backend defers the broadcast until
          // shortly before scheduled_date (see scheduledBookingBroadcastSweep.js). No live
          // waiting/negotiate screen makes sense here since nothing will happen for a while.
          <ScheduledConfirmation booking={createdBooking} navigate={navigate} />
        ) : step === 5 && createdBooking && createdBooking.searchMode === "truck" ? (
          <FindTruckSearch
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            searchRadiusKm={createdBooking.searchRadiusKm}
            onBack={() => setStep(4)}
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
                  {/* Book Now / Book Later — when Later is picked, the backend defers the
                      driver/broker broadcast until shortly before scheduledDateTime instead of
                      firing it the moment this booking is created (see is_scheduled in
                      handleConfirm above). */}
                  <div className="flex items-center gap-1 mb-4 bg-neutral-50 rounded-full p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => updateForm("bookingMode", "now")}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        form.bookingMode !== "later" ? "bg-primary text-white" : "text-neutral-500 hover:text-primary"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> Book Now
                    </button>
                    <button
                      type="button"
                      onClick={() => updateForm("bookingMode", "later")}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        form.bookingMode === "later" ? "bg-primary text-white" : "text-neutral-500 hover:text-primary"
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" /> Book Later
                    </button>
                  </div>

                  {form.bookingMode === "later" && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                        Pickup Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={form.scheduledDateTime}
                        min={minScheduleValue}
                        onChange={(e) => updateForm("scheduledDateTime", e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-700 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1.5">
                        We'll notify nearby drivers/brokers about 2 hours before this time — you won't hear anything before then.
                      </p>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">
                        Define Route
                      </h2>
                      <p className="text-xs text-neutral-400 mt-0.5">Enter the pickup and drop-off, or tap the map.</p>
                    </div>
                    {/* Lets the client set a location by tapping the map instead of typing —
                        useful when the exact spot (a gate, a loading dock) doesn't have a clean
                        Places result. The armed target also drives handleMapClick above. */}
                    <div className="flex items-center gap-1 flex-shrink-0 bg-neutral-50 rounded-full p-0.5">
                      <button
                        type="button"
                        onClick={() => setPinTarget("pickup")}
                        title="Tap map to set pickup"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                          pinTarget === "pickup" ? "bg-primary text-white" : "text-neutral-500 hover:text-primary"
                        }`}
                      >
                        <Crosshair className="w-3 h-3" /> Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setPinTarget("drop")}
                        title="Tap map to set drop-off"
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                          pinTarget === "drop" ? "bg-primary text-white" : "text-neutral-500 hover:text-primary"
                        }`}
                      >
                        <Crosshair className="w-3 h-3" /> Drop
                      </button>
                    </div>
                  </div>

                  {/* Pickup/drop entry: a connected rail (dot → dashed line → pin) mirrors the
                      route itself, so the two fields read as one trip instead of two unrelated
                      boxes — the same visual language as most ride-hailing/logistics apps. */}
                  <div className="flex gap-3 mb-3">
                    <div className="flex flex-col items-center pt-4 pb-4 flex-shrink-0 w-4">
                      {/* Blue pickup / green drop matches MapView's own marker colors (see
                          RouteRenderer below and TrackShipment's map) — same trip, same colors. */}
                      <span className="w-3 h-3 rounded-full bg-primary ring-[3px] ring-primary/20 flex-shrink-0" />
                      <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1.5" />
                      <MapPin className="w-4 h-4 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
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
                        <div className="flex items-center bg-white border border-neutral-200 rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all">
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
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                          Drop-off Location
                        </label>
                        <div className="flex items-center bg-white border border-neutral-200 rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all">
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
                        className="w-9 h-9 rounded-full border border-primary bg-white flex items-center justify-center hover:bg-primary-50 transition-colors"
                      >
                        <ArrowUpDown className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Ola/Uber-style "add stop" — extra loading points (more pickups) and
                      unloading points (more drops), visited in this order between the main
                      pickup and drop. Purely additive: zero stops behaves exactly as before. */}
                  <div className="mb-3 space-y-2.5">
                    {[
                      { key: "loadingLocations", label: "Loading Point", icon: PackagePlus },
                      { key: "unloadingLocations", label: "Unloading Point", icon: PackageMinus },
                    ].map(({ key, label, icon: StopIcon }) => (
                      form[key].length > 0 && (
                        <div key={key} className="space-y-2">
                          {form[key].map((stop, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <StopIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0 flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all">
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
                                onClick={() => setPinTarget({ key, index })}
                                title="Pin this stop on the map"
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                  pinTarget?.key === key && pinTarget?.index === index
                                    ? "bg-primary text-white"
                                    : "text-neutral-400 hover:text-primary hover:bg-primary-50"
                                }`}
                              >
                                <Crosshair className="w-4 h-4" />
                              </button>
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
                        className="flex-1 min-w-[160px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary/15 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Loading Point
                      </button>
                      <button
                        type="button"
                        onClick={() => addStop("unloadingLocations")}
                        className="flex-1 min-w-[160px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary/15 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Unloading Point
                      </button>
                    </div>
                  </div>

                  {/* Auto-detected once both addresses are known — this replaces the old
                      manual Intra-City/Inter-City choice entirely. */}
                  {form.transportType && (
                    <div className={`flex items-center gap-2.5 mb-3 px-3.5 py-1.5 rounded-lg border ${
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

                  {savedAddresses.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Saved Addresses</p>
                      <div className="flex flex-wrap gap-1.5">
                        {savedAddresses.map((addr) => {
                          const isDropoff = addr.addressType === "dropoff";
                          const Icon = isDropoff ? PackageMinus : PackagePlus;
                          const isActive = (isDropoff ? form.drop : form.pickup) === addr.address;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                const target = isDropoff ? "drop" : "pickup";
                                updateForm(target, addr.address);
                                updateForm(target === "drop" ? "dropLat" : "pickupLat", addr.lat);
                                updateForm(target === "drop" ? "dropLng" : "pickupLng", addr.lng);
                                updateForm(target === "drop" ? "dropCity" : "pickupCity", addr.city || null);
                              }}
                              title={addr.address}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isActive ? "bg-primary text-white" : "bg-primary-50 text-primary hover:bg-primary/15"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                              {addr.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Popular Cities</p>
                    <div className="flex flex-wrap gap-1.5">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 pr-12 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all tabular-nums"
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
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2.5 py-2 pr-14 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all tabular-nums"
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
                            className="w-full bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1.5 text-xs text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)] transition-all resize-none"
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

              {/* Step 3 - Truck category + how to find one (Find Truck vs Search for Broker) */}
              {step === 3 && (
                <div className="animate-page-enter">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Find your truck</h2>
                  <p className="text-sm text-neutral-400 mb-4">Pick a truck category, then choose how we should find you one.</p>

                  <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Truck Category</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
                    {truckOptions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateForm("truckType", t.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.truckType === t.id ? "border-primary bg-primary-50" : "border-neutral-100 hover:border-primary/30"
                        }`}
                      >
                        <Truck className={`w-5 h-5 mb-2 ${form.truckType === t.id ? "text-primary" : "text-neutral-400"}`} />
                        <p className="text-sm font-semibold text-neutral-800 truncate">{t.name}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{t.capacity}</p>
                      </button>
                    ))}
                  </div>

                  {/* Find Truck (fan-out broadcast to every nearby driver) vs Search for Broker
                      (send to exactly one broker) — mutually exclusive: picking one clears the
                      other's own fields (radius / selected broker) so there's no stale leftover
                      state from a mode the client isn't using anymore. */}
                  <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">How should we find your truck?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, searchMode: "truck", selectedBrokerId: null, selectedBrokerName: null }))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        form.searchMode === "truck" ? "border-primary bg-primary-50" : "border-neutral-100 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${form.searchMode === "truck" ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"}`}>
                          <Radar className="w-4.5 h-4.5" />
                        </span>
                        <p className="font-poppins font-semibold text-sm text-neutral-800">Find Truck</p>
                      </div>
                      <p className="text-xs text-neutral-400">We notify every available driver nearby — first to accept gets the job.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, searchMode: "broker" }))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        form.searchMode === "broker" ? "border-primary bg-primary-50" : "border-neutral-100 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${form.searchMode === "broker" ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"}`}>
                          <Building2 className="w-4.5 h-4.5" />
                        </span>
                        <p className="font-poppins font-semibold text-sm text-neutral-800">Search for Broker</p>
                      </div>
                      <p className="text-xs text-neutral-400">Pick one broker yourself — the request goes only to them.</p>
                    </button>
                  </div>

                  {form.searchMode === "truck" && (
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5" /> Search Radius
                        </label>
                        <span className="text-sm font-bold text-primary tabular-nums">{form.searchRadiusKm} km</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={form.searchRadiusKm}
                        onChange={(e) => updateForm("searchRadiusKm", Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-neutral-400">1 km</span>
                        <span className="text-[11px] text-neutral-400">100 km</span>
                      </div>
                    </div>
                  )}

                  {form.searchMode === "broker" && (
                    <div className="border border-neutral-100 rounded-xl p-4 max-h-80 overflow-y-auto">
                      {loadingBrokers ? (
                        <div className="flex items-center gap-2 py-6 justify-center">
                          <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                          <span className="text-xs text-neutral-400">Loading brokers...</span>
                        </div>
                      ) : brokersError ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-danger mb-1.5">Couldn't load brokers.</p>
                          <button onClick={loadEligibleBrokers} className="text-xs font-semibold text-primary hover:underline">Retry</button>
                        </div>
                      ) : eligibleBrokers.length === 0 ? (
                        <p className="text-sm text-neutral-400 text-center py-6">
                          No brokers available{form.city ? ` in ${form.city}` : ""} right now.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {eligibleBrokers.map((b) => {
                            const isActive = form.selectedBrokerId === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => { updateForm("selectedBrokerId", b.id); updateForm("selectedBrokerName", b.name); }}
                                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors ${
                                  isActive ? "border-primary bg-primary-50" : "border-neutral-100 hover:border-primary/30"
                                }`}
                              >
                                <div className="min-w-0 flex items-center gap-2.5">
                                  <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"}`}>
                                    <Building2 className="w-4 h-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-neutral-800 truncate">{b.name}</p>
                                    <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                                      {b.phone && <><Phone className="w-3 h-3 flex-shrink-0" />{b.phone}</>}
                                      {b.serviceCity ? ` · ${b.serviceCity}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="flex flex-col items-end">
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${b.isOnline ? "bg-green-50 text-success" : "bg-neutral-100 text-neutral-400"}`}>
                                      {b.isOnline ? "Online" : "Offline"}
                                    </span>
                                    <span className="text-[11px] text-neutral-400 mt-0.5">{b.truckCount} truck{b.truckCount === 1 ? "" : "s"}</span>
                                  </div>
                                  {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
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
                  <p className="text-sm text-neutral-400 mb-4">Please review your booking details before confirming.</p>

                  {form.bookingMode === "later" && (
                    <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2 rounded-lg border border-primary/20 bg-primary-50">
                      <CalendarClock className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="text-sm font-medium text-primary">
                        Scheduled for {form.scheduledDateTime ? new Date(form.scheduledDateTime).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} — we'll broadcast closer to pickup time.
                      </p>
                    </div>
                  )}

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
                        </div>
                      </div>
                    </div>

                    {/* Search Method — the mode chosen in Step 3, mutually exclusive. */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                          <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            {form.searchMode === "broker" ? (
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Radar className="w-3.5 h-3.5 text-primary" />
                            )}
                          </span>
                          How We'll Find Your Truck
                        </p>
                        <button
                          onClick={() => setStep(3)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                      {form.searchMode === "broker" ? (
                        <p className="text-sm text-neutral-700">
                          Search for Broker — <span className="font-semibold">{form.selectedBrokerName || "a selected broker"}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-700">
                          Find Truck — broadcast to every available driver within <span className="font-semibold">{form.searchRadiusKm} km</span>
                        </p>
                      )}
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
                    // Revisiting Review via the Negotiation screen's back arrow means the
                    // booking already exists — just return to it instead of re-running
                    // handleConfirm, which would POST a second, duplicate booking.
                    else if (createdBooking) setStep(5);
                    else handleConfirm();
                  }}
                  disabled={!canContinue || confirming || validatingLocation}
                  className="group px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2"
                >
                  {step === 4
                    ? (confirming
                        ? "Confirming..."
                        : createdBooking
                          ? (createdBooking.isScheduled ? "Back to Booking" : "Back to Negotiation")
                          : (form.bookingMode === "later" ? "Schedule Booking" : "Confirm & Proceed to Negotiation"))
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
