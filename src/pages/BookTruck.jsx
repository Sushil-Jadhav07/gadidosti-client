import React, { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  Building2, Route, ArrowUpDown, Check, Truck,
  ArrowRight, ArrowLeft, MapPin, Package, Weight, Hash, ClipboardList, Zap,
  Pencil, LocateFixed,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import NearbyTrucksMap from "../components/NearbyTrucksMap";
import ChooseBroker from "./ChooseBroker";
import RequestDriver from "./RequestDriver";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { bookingRef, setStoredDriverRequestId, haversineDistanceKm } from "../utils";
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
  const [step, setStep] = useState(1);
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
  const [form, setForm] = useState(INITIAL_FORM);
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

  // Loaded here (not just inside PlacesAutocompleteInput) so "Use my current location" knows
  // whether window.google.maps.Geocoder is actually ready before it lets the user click it.
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
        // estimate computed entirely client-side, no backend call needed. Falls back to the
        // backend's distance lookup only when coordinates still aren't known (geocoding failed
        // or Maps wasn't loaded yet).
        if (pickupLat != null && pickupLng != null && dropLat != null && dropLng != null) {
          distance = haversineDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
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

  // Defined once, rendered as its own sticky right-hand column on every step.
  const bookingSummaryPanel = (
    <div className="bg-white rounded-2xl shadow-card p-5 md:p-6 lg:sticky lg:top-6">
      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-4">Booking Summary</p>

      {!hasSummaryContent ? (
        <p className="text-sm text-neutral-300 text-center py-6">Your selections will appear here as you go</p>
      ) : (
        <div className="space-y-4">
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
            <div className="pt-3 border-t border-neutral-100">
              <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Route</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-neutral-800">{form.pickup || "—"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                <span className="text-sm font-semibold text-neutral-800">{form.drop || "—"}</span>
              </div>
            </div>
          )}

          {step >= 2 && (
            <div className="pt-3 border-t border-neutral-100 space-y-1.5">
              <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Load</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Weight</span>
                <span className="text-xs font-medium text-neutral-700">{form.weight} Tons</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Items</span>
                <span className="text-xs font-medium text-neutral-700">{form.quantity}</span>
              </div>
              {form.materialType && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Material</span>
                  <span className="text-xs font-medium text-neutral-700">{form.materialType}</span>
                </div>
              )}
            </div>
          )}

          {truck && (
            <div className="pt-3 border-t border-neutral-100">
              <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide mb-1.5">Truck</p>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-neutral-700">{truck.name}</span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-neutral-100">
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
              <p className="text-xs text-neutral-300">Complete route &amp; truck selection to see price</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="max-w-6xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator currentStep={step} onStepClick={createdBooking ? undefined : (s) => setStep(s)} />

        {step === 5 && createdBooking && driverRequest && !showBrokerFallback ? (
          <RequestDriver
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            initialRequest={driverRequest}
            onBack={resetFlow}
            onFallbackToBrokers={() => setShowBrokerFallback(true)}
          />
        ) : step === 5 && createdBooking ? (
          <ChooseBroker
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            onBack={resetFlow}
          />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Center: Form — wide 2/3-width form + Booking Summary as its own right column,
              the same layout on every step now (no more narrow-sidebar special case). */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-card p-5 md:p-8">
              {/* Step 1 - Location (pickup/drop; transport type is auto-detected from the
                  two cities, not chosen here) */}
              {step === 1 && (
                <div className="animate-page-enter">
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">
                    Where should we pick up and deliver?
                  </h2>
                  <p className="text-sm text-neutral-400 mb-4">Add accurate addresses — we'll work out Intra vs Inter-City automatically.</p>

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
                            Pickup From
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
                        <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
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
                          Drop To
                        </label>
                        <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
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
                          onClick={() => {
                            const target = focusedField === "drop" || (!form.pickup && focusedField !== "pickup") ? "drop" : "pickup";
                            updateForm(target, city);
                            // A city chip already tells us the address's city directly — no
                            // geocoding needed to know pickupCity/dropCity for this one.
                            updateForm(target === "drop" ? "dropCity" : "pickupCity", city);
                            // Coordinates are only known once resolved via Autocomplete/geocoding — a
                            // quick city-chip pick doesn't carry them, so clear any stale lat/lng.
                            updateForm(target === "drop" ? "dropLat" : "pickupLat", null);
                            updateForm(target === "drop" ? "dropLng" : "pickupLng", null);
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
                    selectedTruckId={form.selectedTruckId}
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
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Booking summary</h2>
                  <p className="text-sm text-neutral-400 mb-6">Please review your booking details before confirming.</p>

                  <div className="space-y-4">
                    <div className="bg-neutral-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Shipment Details</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-block text-[11px] font-medium bg-primary-50 text-primary px-2.5 py-0.5 rounded-full">
                            {form.transportType === "intra" ? "Intra-City" : "Inter-City"}
                          </span>
                          <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        </div>
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
                          <p className="font-poppins font-semibold text-sm text-neutral-800 truncate">{form.pickup}</p>
                          <p className="font-poppins font-semibold text-sm text-neutral-800 truncate">{form.drop}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-neutral-400"><Truck className="w-3.5 h-3.5" /> Truck</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-medium text-neutral-700">{truck?.name}</span>
                            <button
                              onClick={() => setStep(3)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-neutral-400"><Weight className="w-3.5 h-3.5" /> Weight</span>
                          <span className="text-xs font-medium text-neutral-700 tabular-nums">{form.weight} Tons</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs text-neutral-400"><Hash className="w-3.5 h-3.5" /> Items</span>
                          <span className="text-xs font-medium text-neutral-700 tabular-nums">{form.quantity}</span>
                        </div>
                        {form.materialType && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs text-neutral-400"><Package className="w-3.5 h-3.5" /> Material</span>
                            <span className="text-xs font-medium text-neutral-700">{form.materialType}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-primary-50 border border-primary/10 rounded-xl p-4 flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
                        <Zap className="w-4 h-4 text-primary" />
                      </span>
                      <p className="text-sm text-neutral-600">Choose how to pay in the next step — UPI, cards, netbanking, wallet, or pay later.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-5 md:mt-6 justify-end">
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
                  else handleConfirm();
                }}
                disabled={!canContinue || confirming || validatingLocation}
                className="group px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2"
              >
                {step === 4 ? (confirming ? "Confirming..." : "Confirm & Choose Broker")
                  : step === 1 ? (validatingLocation ? "Validating..." : "Continue")
                  : "Continue"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Right: Live Booking Summary — its own column on every step. */}
          <div className="lg:col-span-1">
            {bookingSummaryPanel}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
