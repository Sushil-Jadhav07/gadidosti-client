import React, { useEffect, useRef, useState } from "react";
import {
  Building2, Route, ArrowUpDown, Check, Truck,
  ArrowRight, ArrowLeft, MapPin, Package, Weight, Hash, ClipboardList, Zap,
  Ban, Navigation, Pencil,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import NearbyTrucksMap from "../components/NearbyTrucksMap";
import ChooseBroker from "./ChooseBroker";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { bookingRef } from "../utils";
import { TRUCK_IMAGES } from "../lib/truckImages";

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
  drop: "",
  dropLat: null,
  dropLng: null,
  weight: 1,
  quantity: 1,
  materialType: "",
  notes: "",
  truckType: null,
};

function TipItem({ icon: Icon, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

// Lazily fetched once and reused across every mount — public/data/india-cities.json is a
// pre-flattened, India-only extract (~4.2k cities, 176KB) of the react-country-state-city
// package's dataset. That package's own city lookups (GetCity/GetAllCities) always fetch
// its full *global* citiesminified.json (41.6MB, every country) from GitHub Pages on every
// call, which is a non-starter to load in a booking flow — so the India subset is computed
// once (see the extraction this was generated with) and shipped as a static asset instead.
let indiaCitiesPromise = null;
const loadIndiaCities = () => {
  if (!indiaCitiesPromise) {
    indiaCitiesPromise = fetch("/data/india-cities.json")
      .then((res) => res.json())
      .catch(() => []);
  }
  return indiaCitiesPromise;
};

// A search-as-you-type city picker over the full India city list, styled like
// PlacesAutocompleteInput's suggestion list for visual consistency.
function CityAutocompleteInput({ value, onChange, placeholder = "Search for a city" }) {
  const [allCities, setAllCities] = useState(null); // null = still loading
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadIndiaCities().then((data) => { if (!cancelled) setAllCities(data); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const matches = !allCities ? [] : !query
    ? allCities.slice(0, 8)
    // Cities starting with the typed text rank above cities merely containing it —
    // typing "pun" should surface Pune before, say, Kanpur.
    : [
        ...allCities.filter((c) => c.name.toLowerCase().startsWith(query)),
        ...allCities.filter((c) => !c.name.toLowerCase().startsWith(query) && c.name.toLowerCase().includes(query)),
      ].slice(0, 30);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={allCities === null ? "Loading cities..." : placeholder}
        disabled={allCities === null}
        autoComplete="off"
        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all disabled:opacity-60"
      />

      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-card border border-neutral-100 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {matches.map((city) => (
              <button
                key={`${city.name}-${city.state}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(city.name); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors border-b border-neutral-50 last:border-b-0 ${
                  value === city.name ? "bg-primary-50 text-primary font-medium" : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                  <span className="truncate">{city.name}</span>
                </span>
                <span className="text-xs text-neutral-300 flex-shrink-0">{city.state}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SidePanel({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <p className="font-poppins font-semibold text-base text-neutral-800 mb-4">{title}</p>
      <div className="space-y-4">{children}</div>
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
  // Set once the booking is created at Review-confirm; drives step 6 (Choose Broker), which
  // renders inline in this same wizard instead of navigating to a separate route.
  const [createdBooking, setCreatedBooking] = useState(null);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
        const distanceRes = await api.post("/api/config/distance", { pickup: form.pickup, drop: form.drop });
        if (!distanceRes?.success) throw new Error(distanceRes?.message || "Distance unavailable");
        const distance = distanceRes.data?.distance || 0;
        // Traffic-aware pricing: feeding these through is what makes the estimate's
        // trafficMultiplier/trafficSurcharge actually reflect live traffic instead of
        // defaulting to "no surge" (see PricingModel.estimate).
        const durationMin = distanceRes.data?.durationMin;
        const durationInTrafficMin = distanceRes.data?.durationInTrafficMin;
        const pricingRes = await api.post("/api/pricing/estimate", {
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
  }, [form.truckType, form.pickup, form.drop, form.transportType, token, quoteRetryToken]);

  // The system-calculated price is the opening ask every broker sees — negotiating from there
  // happens per-broker on the Choose Broker screen (counter-offers), not at booking time.
  const finalAmount = priceBreakdown?.total;

  // Booking is created here, at Review-confirm — *before* a broker is chosen and *before*
  // payment. Both of those happen next, on the Choose Broker screen, using the id this
  // returns. payment_status starts 'pending' regardless of what the client intends to do
  // later; PATCH /api/bookings/:id/pay is what actually records payment, once a broker's
  // locked in.
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
      setStep(6);
    } catch (err) {
      toast.error(err?.message || "Failed to confirm booking");
    } finally {
      setConfirming(false);
    }
  };

  // Gate for leaving Step 2: the backend is the source of truth on whether pickup/drop
  // are valid for the chosen transport type (e.g. both inside the selected intra-city
  // city) — only advance to Step 3 once it confirms that.
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
        // the near-universal cause is one of the two addresses falling outside the chosen
        // city, so surface that reason directly instead of the opaque backend message.
        const message = form.transportType === "intra" && form.city
          ? `Pickup and drop must both be within ${form.city} for an Intra-City booking. Please choose a location inside ${form.city}.`
          : response?.message || "These pickup/drop locations aren't valid for this trip";
        throw new Error(message);
      }
      setStep(3);
    } catch (err) {
      toast.error(err?.message || "These pickup/drop locations aren't valid for this trip");
    } finally {
      setValidatingLocation(false);
    }
  };

  // The booking's already been created by the time step 6 (Choose Broker) is showing — there's
  // no safe "previous step" to rewind to (Review's Confirm button would just create a second,
  // duplicate booking). So going back from Choose Broker restarts the whole wizard fresh instead.
  const resetFlow = () => {
    setStep(1);
    setCreatedBooking(null);
    setForm(INITIAL_FORM);
    setPriceBreakdown(null);
  };

  const canContinue =
    (step === 1 && !!form.transportType && (form.transportType !== "intra" || !!form.city)) ||
    (step === 2 && !!form.pickup && !!form.drop) ||
    step === 3 ||
    (step === 4 && !!form.truckType) ||
    (step === 5 && !!priceBreakdown?.total && !loadingQuote);

  // No success screen here anymore — creating the booking just moves on to Choose Broker.
  // "Booking Confirmed" now shows at the end of that screen, after a broker is locked in
  // and payment (if any) is recorded — see ChooseBroker.jsx.

  const truck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;
  const hasSummaryContent = form.transportType || form.pickup || form.drop || form.truckType;

  // Defined once and rendered in whichever column fits the step: stacked under the
  // contextual tips panel on steps 1-4 (so there's one left column, not two mostly-empty
  // ones), and as its own column next to the review card on step 5.
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

          {step >= 3 && (
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

        {step === 6 && createdBooking ? (
          <ChooseBroker
            bookingId={createdBooking.id}
            bookingNumber={createdBooking.bookingNumber}
            askingPrice={createdBooking.askingPrice}
            pickup={createdBooking.pickup}
            drop={createdBooking.drop}
            onBack={resetFlow}
          />
        ) : (
        <div className={`grid grid-cols-1 gap-6 items-start ${step === 5 ? "lg:grid-cols-3" : "lg:grid-cols-[300px_1fr]"}`}>
          {/* Left: contextual tips / trip recap stacked above the live Booking Summary — one
              column instead of a second, mostly-empty sidebar, dropped on Review where the
              full-width summary + fare column takes over instead. */}
          {step !== 5 && (
            <div className="space-y-6">
              {step === 1 && (
                <SidePanel title="Before you begin">
                  <TipItem icon={Route} title="Same city or across cities">
                    Intra-City suits local moves; Inter-City is for longer, cross-city freight.
                  </TipItem>
                  <TipItem icon={Zap} title="Instant pricing">
                    Your fare estimate updates live as you complete each step.
                  </TipItem>
                  <TipItem icon={Truck} title="Flexible truck options">
                    Choose from mini trucks to shared part-load on a later step.
                  </TipItem>
                </SidePanel>
              )}
              {step === 2 && (
                <SidePanel title="Things to keep in mind">
                  <TipItem icon={Navigation} title="Accurate addresses">
                    Add complete addresses so your driver can find the location easily.
                  </TipItem>
                  <TipItem icon={MapPin} title="Popular cities">
                    Pick from the quick city list or search any address directly.
                  </TipItem>
                  <TipItem icon={ArrowUpDown} title="Swap in one tap">
                    Use the swap button to flip pickup and drop instantly.
                  </TipItem>
                </SidePanel>
              )}
              {step === 3 && (
                <SidePanel title="Package guidelines">
                  <TipItem icon={Weight} title="Weight matters">
                    Accurate weight helps us suggest the right vehicle and fare.
                  </TipItem>
                  <TipItem icon={Package} title="Pack securely">
                    We don't provide packaging — please pack items securely.
                  </TipItem>
                  <TipItem icon={Ban} title="Restricted items">
                    Please don't ship hazardous, flammable, or illegal items.
                  </TipItem>
                </SidePanel>
              )}
              {/* No step-4 tips panel: the Booking Summary right below already shows the
                  route, load and (once picked) truck — a second recap would just repeat it. */}
              {bookingSummaryPanel}
            </div>
          )}

          {/* Center: Form */}
          <div className={step === 5 ? "lg:col-span-2" : ""}>
            <div className="bg-white rounded-2xl shadow-card p-5 md:p-8">
              {/* Step 1 - Transport Type */}
              {step === 1 && (
                <div>
                  <h2 className="font-poppins font-semibold text-lg md:text-xl text-neutral-800 mb-1">
                    Select Transport Type
                  </h2>
                  <p className="text-sm text-neutral-400 mb-6">Choose the type of transport service you need</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => updateForm("transportType", "intra")}
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left active:scale-[0.98] ${
                        form.transportType === "intra"
                          ? "border-primary bg-primary-50 shadow-glow-blue"
                          : "border-neutral-100 bg-neutral-50 hover:border-neutral-200 hover:bg-white hover:shadow-card"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        form.transportType === "intra" ? "bg-primary/15" : "bg-white"
                      }`}>
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-poppins font-semibold text-base text-neutral-800">Intra-City</h3>
                        <p className="text-xs text-neutral-400 mt-1">Transport within the same city</p>
                      </div>
                      {form.transportType === "intra" && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => updateForm("transportType", "inter")}
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left active:scale-[0.98] ${
                        form.transportType === "inter"
                          ? "border-success bg-green-50 shadow-glow-green"
                          : "border-neutral-100 bg-neutral-50 hover:border-neutral-200 hover:bg-white hover:shadow-card"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        form.transportType === "inter" ? "bg-success/15" : "bg-white"
                      }`}>
                        <Route className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-poppins font-semibold text-base text-neutral-800">Inter-City</h3>
                        <p className="text-xs text-neutral-400 mt-1">Transport between different cities</p>
                      </div>
                      {form.transportType === "inter" && (
                        <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Only intra-city trips need this — inter-city pickup/drop can be any two
                      cities, so there's nothing to pin down here. Picking the city up front
                      lets Step 2 restrict the address search to it (see restrictToCity below). */}
                  {form.transportType === "intra" && (
                    <div className="mt-5">
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                        Select City
                      </label>
                      <CityAutocompleteInput
                        value={form.city}
                        onChange={(city) => updateForm("city", city)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 - Pickup & Drop */}
              {step === 2 && (
                <div>
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">
                    Where should we pick up and deliver?
                  </h2>
                  <p className="text-sm text-neutral-400 mb-6">Add accurate addresses to help your driver reach you on time.</p>

                  {/* Pickup/drop entry: a connected rail (dot → dashed line → pin) mirrors the
                      route itself, so the two fields read as one trip instead of two unrelated
                      boxes — the same visual language as most ride-hailing/logistics apps. */}
                  <div className="flex gap-3 mb-6">
                    <div className="flex flex-col items-center pt-8 pb-8 flex-shrink-0 w-4">
                      {/* Blue pickup / green drop matches MapView's own marker colors (see
                          RouteRenderer below and TrackShipment's map) — same trip, same colors. */}
                      <span className="w-3 h-3 rounded-full bg-primary ring-[3px] ring-primary/20 flex-shrink-0" />
                      <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1.5" />
                      <MapPin className="w-4 h-4 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                          Pickup From
                        </label>
                        <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                          <PlacesAutocompleteInput
                            value={form.pickup}
                            onChange={(v) => {
                              updateForm("pickup", v);
                              updateForm("pickupLat", null);
                              updateForm("pickupLng", null);
                            }}
                            onPlaceSelect={({ address, lat, lng }) => {
                              updateForm("pickup", address);
                              updateForm("pickupLat", lat);
                              updateForm("pickupLng", lng);
                            }}
                            restrictToCity={form.transportType === "intra" ? form.city : null}
                            inputProps={{ onFocus: () => setFocusedField("pickup") }}
                            placeholder={form.transportType === "intra" && form.city ? `Enter pickup address in ${form.city}` : "Enter pickup address or city"}
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
                            }}
                            onPlaceSelect={({ address, lat, lng }) => {
                              updateForm("drop", address);
                              updateForm("dropLat", lat);
                              updateForm("dropLng", lng);
                            }}
                            restrictToCity={form.transportType === "intra" ? form.city : null}
                            inputProps={{ onFocus: () => setFocusedField("drop") }}
                            placeholder={form.transportType === "intra" && form.city ? `Enter drop address in ${form.city}` : "Enter drop address or city"}
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
                            drop: prev.pickup,
                            dropLat: prev.pickupLat,
                            dropLng: prev.pickupLng,
                          }));
                        }}
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-primary bg-white flex items-center justify-center hover:bg-primary-50 transition-colors"
                      >
                        <ArrowUpDown className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Intra-city trips already locked in a single city on Step 1 — a
                      city-picker chip row here would be redundant, so it's inter-city only. */}
                  {form.transportType !== "intra" && (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Popular Cities</p>
                    <div className="flex flex-wrap gap-2">
                      {cities.map((city) => (
                        <button
                          key={city}
                          onClick={() => {
                            const target = focusedField === "drop" || (!form.pickup && focusedField !== "pickup") ? "drop" : "pickup";
                            updateForm(target, city);
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
                  )}
                </div>
              )}

              {/* Step 3 - Load Information */}
              {step === 3 && (
                <div>
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Tell us about your package</h2>
                  <p className="text-sm text-neutral-400 mb-6">Accurate details help us suggest the right vehicle and fare.</p>

                  {/* Package category — driven by the same admin-configured materialTypes list
                      the old free-text field used (never a hardcoded set), just presented as
                      selectable cards instead of a datalist input. */}
                  <div className="border border-neutral-100 rounded-xl p-4 hover:border-neutral-200 transition-colors mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-primary" />
                      </span>
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Material Type</label>
                    </div>
                    <input
                      type="text"
                      list="material-type-suggestions"
                      value={form.materialType}
                      onChange={(e) => updateForm("materialType", e.target.value)}
                      placeholder="e.g. Electronics, Furniture, Textiles..."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all"
                    />
                    <datalist id="material-type-suggestions">
                      {materialTypes.map((option) => <option key={option} value={option} />)}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                    {/* Weight */}
                    <div className="border border-neutral-100 rounded-xl p-4 hover:border-neutral-200 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <Weight className="w-4 h-4 text-primary" />
                        </span>
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Weight (Tons)</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateForm("weight", Math.max(0.5, Number((form.weight - 0.5).toFixed(1))))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"
                        >
                          −
                        </button>
                        <div className="flex-1 bg-neutral-50 border border-neutral-100 rounded-lg py-1.5 px-2 text-center">
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
                            className="w-full bg-transparent text-center font-poppins font-bold text-xl text-neutral-800 outline-none tabular-nums"
                          />
                          <p className="text-xs text-neutral-400">Tons</p>
                        </div>
                        <button
                          onClick={() => updateForm("weight", Math.min(50, Number((form.weight + 0.5).toFixed(1))))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-300 mt-2">Recommended: 2–5 Tons for your route</p>
                    </div>

                    {/* Quantity */}
                    <div className="border border-neutral-100 rounded-xl p-4 hover:border-neutral-200 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <Hash className="w-4 h-4 text-primary" />
                        </span>
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Number of Items</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateForm("quantity", Math.max(1, form.quantity - 1))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"
                        >
                          −
                        </button>
                        <div className="flex-1 bg-neutral-50 border border-neutral-100 rounded-lg py-1.5 px-2 text-center">
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
                            className="w-full bg-transparent text-center font-poppins font-bold text-xl text-neutral-800 outline-none tabular-nums"
                          />
                          <p className="text-xs text-neutral-400">items</p>
                        </div>
                        <button
                          onClick={() => updateForm("quantity", Math.min(100, form.quantity + 1))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="border border-neutral-100 rounded-xl p-4 hover:border-neutral-200 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-4 h-4 text-primary" />
                        </span>
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                          Additional Notes <span className="text-neutral-300 normal-case font-normal">(Optional)</span>
                        </label>
                      </div>
                      <div className="relative">
                        <textarea
                          value={form.notes}
                          onChange={(e) => updateForm("notes", e.target.value.slice(0, 200))}
                          placeholder="Any special instructions..."
                          rows={2}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all resize-none"
                        />
                        <span className="absolute bottom-2 right-3 text-[10px] text-neutral-300">
                          {form.notes.length}/200
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4 - Select Truck */}
              {step === 4 && (
                <div>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 mb-1">Choose a vehicle</h2>
                  <p className="text-sm text-neutral-400 mb-4">Select the best option for your load.</p>

                  {/* Compact category selector — still drives form.truckType (needed for the
                      price estimate, the nearby-trucks filter below, and truck_category on
                      submit), just no longer the large per-category card grid. */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {truckOptions.map((truckOpt) => (
                      <button
                        key={truckOpt.id}
                        onClick={() => updateForm("truckType", truckOpt.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                          form.truckType === truckOpt.id
                            ? truckOpt.id === "part"
                              ? "border-success/40 bg-green-50 text-success"
                              : "border-primary bg-primary-50 text-primary"
                            : "border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200 hover:bg-white"
                        }`}
                      >
                        {TRUCK_IMAGES[truckOpt.id] ? (
                          <img src={TRUCK_IMAGES[truckOpt.id]} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                        ) : (
                          <Truck className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{truckOpt.name}</span>
                        <span className="text-xs text-neutral-400">· {truckOpt.capacity}</span>
                        {form.truckType === truckOpt.id && <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>

                  <NearbyTrucksMap
                    pickupLat={form.pickupLat}
                    pickupLng={form.pickupLng}
                    dropLat={form.dropLat}
                    dropLng={form.dropLng}
                    truckCategory={form.truckType}
                    capacity={truck?.capacity}
                  />
                </div>
              )}

              {/* Step 5 - Review & Pay */}
              {step === 5 && (
                <div>
                  <button
                    onClick={() => setStep(4)}
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
                            onClick={() => setStep(2)}
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
                              onClick={() => setStep(4)}
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
                  if (step === 2) handleValidateLocation();
                  else if (step < 5) setStep(step + 1);
                  else handleConfirm();
                }}
                disabled={!canContinue || confirming || validatingLocation}
                className="group px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2"
              >
                {step === 5 ? (confirming ? "Confirming..." : "Confirm & Choose Broker")
                  : step === 2 ? (validatingLocation ? "Validating..." : "Continue")
                  : "Continue"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Right: Live Booking Summary — only its own column on Review, where there's no
              left tips panel to stack it under instead. */}
          {step === 5 && (
            <div className="lg:col-span-1">
              {bookingSummaryPanel}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
