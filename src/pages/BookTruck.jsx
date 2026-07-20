import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Route, ArrowUpDown, Star, Check, Truck,
  ArrowRight, MapPin, Package, Weight, Hash, ClipboardList, Tag,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import PaymentSheet from "../components/PaymentSheet";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { api, getToken } from "../services/api";
import { bookingRef } from "../utils";

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


export default function BookTruck() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const token = getToken();
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState(FALLBACK_CITIES);
  const [materialTypes, setMaterialTypes] = useState(FALLBACK_MATERIALS);
  const [truckOptions, setTruckOptions] = useState(FALLBACK_TRUCKS);
  const [configError, setConfigError] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Negotiation — instead of the system-calculated price, the client can propose their own
  // starting ask. Brokers still see this as the opening offer and can counter it (see JobRequests
  // on the broker side, and the offers panel on My Bookings for the back-and-forth).
  const [proposeOwnPrice, setProposeOwnPrice] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [form, setForm] = useState({
    transportType: null,
    pickup: "",
    drop: "",
    weight: 1,
    quantity: 1,
    materialType: "",
    notes: "",
    truckType: null,
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [focusedField, setFocusedField] = useState(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

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
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingQuote(true);
      try {
        const distanceRes = await api.post("/api/config/distance", { pickup: form.pickup, drop: form.drop });
        const distance = distanceRes?.data?.distance || 0;
        const pricingRes = await api.post("/api/pricing/estimate", {
          truck_category: form.truckType,
          transport_type: form.transportType,
          distance,
        }, token);
        if (!cancelled) {
          const pricing = pricingRes?.data?.pricing || pricingRes?.data || {};
          setPriceBreakdown({ ...pricing, distance });
        }
      } catch {
        if (!cancelled) setPriceBreakdown(null);
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.truckType, form.pickup, form.drop, form.transportType, token]);

  // Client's chosen ask: either the system-calculated price, or their own proposed price —
  // whichever is active drives what brokers see as the opening offer.
  const finalAmount = proposeOwnPrice && Number(customAmount) > 0 ? Number(customAmount) : priceBreakdown?.total;

  const handleConfirm = () => {
    if (!priceBreakdown?.total) {
      toast.error("Price quote isn't ready yet — please wait a moment and try again.");
      return;
    }
    if (proposeOwnPrice && !(Number(customAmount) > 0)) {
      toast.error("Enter the price you'd like to propose, or switch back to the system price.");
      return;
    }
    setShowPaymentSheet(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentSheet(false);
    await submitBooking("paid");
  };

  const handlePayLater = async () => {
    setShowPaymentSheet(false);
    await submitBooking("pending");
  };

  const submitBooking = async (paymentStatus) => {
    setConfirming(true);
    try {
      const response = await api.post("/api/bookings", {
        pickup_location: form.pickup,
        drop_location: form.drop,
        truck_category: form.truckType,
        transport_type: form.transportType,
        weight: form.weight,
        quantity: form.quantity,
        material: form.materialType,
        amount: finalAmount,
        distance: priceBreakdown.distance,
        payment_status: paymentStatus,
      }, token);

      if (!response?.success) throw new Error(response?.message || "Failed to confirm booking");

      const ref = bookingRef(response.data?.booking);
      setBookingId(ref);
      setShowSuccess(true);
      toast.success(`Booking ${ref} confirmed!`, "Booking Confirmed");
    } catch (err) {
      toast.error(err?.message || "Failed to confirm booking");
    } finally {
      setConfirming(false);
    }
  };

  const canContinue =
    (step === 1 && !!form.transportType) ||
    (step === 2 && !!form.pickup && !!form.drop) ||
    step === 3 ||
    (step === 4 && !!form.truckType) ||
    (step === 5 && !!priceBreakdown?.total && !loadingQuote);

  if (showSuccess) {
    return (
      <div className="min-h-full flex items-center justify-center p-4 md:p-8 animate-page-enter">
        <div className="bg-white rounded-2xl shadow-card p-8 md:p-12 max-w-md w-full text-center">
          <div className="animate-bounce-in mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center shadow-glow-green">
              <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
            </div>
          </div>
          <h1 className="font-poppins font-bold text-2xl text-success mb-2">Booking Confirmed!</h1>
          <p className="text-sm text-neutral-400 mb-8">Your booking has been successfully placed.</p>

          <div className="bg-neutral-50 rounded-xl p-5 mb-8">
            <p className="text-xs text-neutral-400 mb-1">Booking ID</p>
            <p className="font-poppins font-bold text-2xl text-neutral-800">{bookingId}</p>
            <p className="text-sm text-neutral-400 mt-2">We'll notify you once a driver is assigned.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/track")}
              className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Track Booking
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const truck = form.truckType ? truckOptions.find((t) => t.id === form.truckType) : null;
  const hasSummaryContent = form.transportType || form.pickup || form.drop || form.truckType;

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="max-w-6xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator currentStep={step} onStepClick={(s) => setStep(s)} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Form */}
          <div className="lg:col-span-2">
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
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                        form.transportType === "intra"
                          ? "border-primary bg-primary-50 shadow-glow-blue"
                          : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
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
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left ${
                        form.transportType === "inter"
                          ? "border-primary bg-primary-50 shadow-glow-blue"
                          : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        form.transportType === "inter" ? "bg-success/10" : "bg-white"
                      }`}>
                        <Route className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-poppins font-semibold text-base text-neutral-800">Inter-City</h3>
                        <p className="text-xs text-neutral-400 mt-1">Transport between different cities</p>
                      </div>
                      {form.transportType === "inter" && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 - Pickup & Drop */}
              {step === 2 && (
                <div>
                  <h2 className="font-poppins font-semibold text-lg md:text-xl text-neutral-800 mb-6">Pickup &amp; Drop</h2>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-end mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                        Pickup From
                      </label>
                      <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                        <MapPin className="w-4 h-4 text-neutral-300 mr-2 flex-shrink-0" />
                        <input
                          type="text"
                          value={form.pickup}
                          onChange={(e) => updateForm("pickup", e.target.value)}
                          onFocus={() => setFocusedField("pickup")}
                          placeholder="Enter pickup city"
                          className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const temp = form.pickup;
                        updateForm("pickup", form.drop);
                        updateForm("drop", temp);
                      }}
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-primary bg-white flex items-center justify-center hover:bg-primary-50 transition-colors mb-0.5 flex-shrink-0"
                    >
                      <ArrowUpDown className="w-4 h-4 text-primary" />
                    </button>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                        Drop To
                      </label>
                      <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                        <MapPin className="w-4 h-4 text-neutral-300 mr-2 flex-shrink-0" />
                        <input
                          type="text"
                          value={form.drop}
                          onChange={(e) => updateForm("drop", e.target.value)}
                          onFocus={() => setFocusedField("drop")}
                          placeholder="Enter drop city"
                          className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Popular Cities</p>
                    <div className="flex flex-wrap gap-2">
                      {cities.map((city) => (
                        <button
                          key={city}
                          onClick={() => {
                            if (focusedField === "drop" || (!form.pickup && focusedField !== "pickup")) {
                              updateForm("drop", city);
                            } else {
                              updateForm("pickup", city);
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

              {/* Step 3 - Load Information */}
              {step === 3 && (
                <div>
                  <h2 className="font-poppins font-semibold text-lg md:text-xl text-neutral-800 mb-6">Load Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
                    {/* Weight */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                        <Weight className="w-3.5 h-3.5 text-primary" /> Weight (Tons)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateForm("weight", Math.max(0.5, Number((form.weight - 0.5).toFixed(1))))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors flex-shrink-0"
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
                            className="w-full bg-transparent text-center font-poppins font-bold text-xl text-neutral-800 outline-none"
                          />
                          <p className="text-xs text-neutral-400">Tons</p>
                        </div>
                        <button
                          onClick={() => updateForm("weight", Math.min(50, Number((form.weight + 0.5).toFixed(1))))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-300 mt-2">Recommended: 2–5 Tons for your route</p>
                    </div>

                    {/* Quantity */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                        <Hash className="w-3.5 h-3.5 text-primary" /> Number of Items
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateForm("quantity", Math.max(1, form.quantity - 1))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors flex-shrink-0"
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
                            className="w-full bg-transparent text-center font-poppins font-bold text-xl text-neutral-800 outline-none"
                          />
                          <p className="text-xs text-neutral-400">items</p>
                        </div>
                        <button
                          onClick={() => updateForm("quantity", Math.min(100, form.quantity + 1))}
                          className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Material Type */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                        <Package className="w-3.5 h-3.5 text-primary" /> Material Type
                      </label>
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

                    {/* Notes */}
                    <div className="border border-neutral-100 rounded-xl p-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                        <ClipboardList className="w-3.5 h-3.5 text-primary" /> Additional Notes
                        <span className="text-neutral-300 normal-case font-normal">(Optional)</span>
                      </label>
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
                  <h2 className="font-poppins font-semibold text-lg md:text-xl text-neutral-800 mb-1">Choose Your Truck</h2>
                  <p className="text-sm text-neutral-400 mb-6">Select the best option for your load</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {truckOptions.map((truckOpt) => (
                      <button
                        key={truckOpt.id}
                        onClick={() => updateForm("truckType", truckOpt.id)}
                        className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                          form.truckType === truckOpt.id
                            ? truckOpt.id === "part"
                              ? "border-success/40 bg-green-50"
                              : "border-primary bg-primary-50"
                            : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
                        }`}
                      >
                        {truckOpt.featured && (
                          <span className="absolute -top-2 -right-2 z-10 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-card">
                            SAVE {truckOpt.savePercent}%
                          </span>
                        )}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          truckOpt.id === "part" ? "bg-success/10" : "bg-primary-50"
                        }`}>
                          <Truck className={`w-6 h-6 ${truckOpt.id === "part" ? "text-success" : "text-primary"}`} />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h4 className="font-poppins font-semibold text-sm text-neutral-800">{truckOpt.name}</h4>
                            {truckOpt.featured && <Star className="w-3.5 h-3.5 text-warning fill-warning flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-neutral-400">{truckOpt.capacity}</p>
                          {truckOpt.basePrice != null ? (
                            <p className="font-poppins font-bold text-base text-primary mt-2">
                              ₹{truckOpt.basePrice.toLocaleString("en-IN")}
                              <span className="text-xs font-normal text-neutral-400 ml-1">base</span>
                            </p>
                          ) : (
                            <p className="font-poppins font-semibold text-sm text-primary mt-2">Billed by capacity used</p>
                          )}
                        </div>
                        <div
                          className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            form.truckType === truckOpt.id
                              ? truckOpt.id === "part"
                                ? "border-success bg-success"
                                : "border-primary bg-primary"
                              : "border-neutral-200"
                          }`}
                        >
                          {form.truckType === truckOpt.id && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5 - Review & Pay */}
              {step === 5 && (
                <div>
                  <h2 className="font-poppins font-semibold text-lg md:text-xl text-neutral-800 mb-6">Review &amp; Confirm</h2>

                  <div className="space-y-4">
                    <div className="bg-neutral-50 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Shipment Details</p>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-poppins font-bold text-base md:text-lg text-neutral-800">{form.pickup}</span>
                        <ArrowRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                        <span className="font-poppins font-bold text-base md:text-lg text-neutral-800">{form.drop}</span>
                      </div>
                      <span className="inline-block text-[11px] font-medium bg-primary-50 text-primary px-2.5 py-0.5 rounded-full capitalize">
                        {form.transportType === "intra" ? "Intra-City" : "Inter-City"}
                      </span>

                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Truck</span>
                          <span className="text-xs font-medium text-neutral-700">{truck?.name}</span>
                        </div>
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
                    </div>

                    <div className="bg-primary-50 border border-primary/10 rounded-xl p-4 text-center">
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
                  className="px-5 md:px-6 py-3 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (step < 5) setStep(step + 1);
                  else handleConfirm();
                }}
                disabled={!canContinue || confirming}
                className="px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {step === 5 ? (confirming ? "Confirming..." : "Proceed to Payment") : "Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Live Booking Summary */}
          <div className="lg:col-span-1">
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
                        {form.transportType === "intra" ? "Intra-City" : "Inter-City"}
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
                        <p className={`font-poppins font-bold text-2xl ${proposeOwnPrice ? "text-neutral-300 line-through" : "text-primary"}`}>
                          ₹{Number(priceBreakdown.total).toLocaleString("en-IN")}
                        </p>
                        {!!priceBreakdown.distance && (
                          <p className="text-[11px] text-neutral-300 mt-0.5">~{priceBreakdown.distance} km</p>
                        )}

                        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={proposeOwnPrice}
                            onChange={(e) => {
                              setProposeOwnPrice(e.target.checked);
                              if (!e.target.checked) setCustomAmount("");
                            }}
                            className="w-3.5 h-3.5 rounded border-neutral-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Propose your own price
                          </span>
                        </label>

                        {proposeOwnPrice && (
                          <div className="mt-2">
                            <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all">
                              <span className="text-neutral-400 text-sm mr-1">₹</span>
                              <input
                                type="number"
                                min={1}
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                placeholder={`e.g. ${Math.round(priceBreakdown.total)}`}
                                className="flex-1 bg-transparent text-sm font-semibold text-neutral-800 outline-none placeholder:text-neutral-300 placeholder:font-normal min-w-0"
                              />
                            </div>
                            <p className="text-[11px] text-neutral-300 mt-1.5">Brokers will see this as your opening offer and can counter it.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-300">Complete route &amp; truck selection to see price</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaymentSheet
        open={showPaymentSheet}
        amount={finalAmount}
        phone={user?.phone}
        onClose={() => setShowPaymentSheet(false)}
        onSuccess={handlePaymentSuccess}
        onPayLater={handlePayLater}
      />
    </div>
  );
}
