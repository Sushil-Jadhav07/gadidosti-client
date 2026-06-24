import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Route, Search, ArrowUpDown, Star, Check, Truck, CreditCard, Smartphone, Landmark,
  ArrowRight, Package, Weight, Hash, FileText, ChevronDown, MapPin,
} from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import { CITIES, MATERIAL_TYPES, TRUCK_OPTIONS, calculatePrice, generateBookingId } from "../data/mockData";
import { useToast } from "../context/ToastContext";

export default function BookTruck() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    transportType: null,
    pickup: "",
    drop: "",
    weight: 1,
    quantity: 1,
    materialType: "",
    notes: "",
    truckType: null,
    paymentMethod: "upi",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const priceBreakdown = useMemo(() => {
    if (step !== 5 || !form.truckType || !form.pickup || !form.drop) return null;
    return calculatePrice(form.truckType, form.pickup, form.drop, form.transportType);
  }, [step, form.truckType, form.pickup, form.drop, form.transportType]);

  const handleConfirm = () => {
    const id = generateBookingId();
    setBookingId(id);
    setShowSuccess(true);
    toast.success(`Booking ${id} confirmed!`, "Booking Confirmed");
  };

  const canContinue =
    (step === 1 && !!form.transportType) ||
    (step === 2 && !!form.pickup && !!form.drop) ||
    step === 3 ||
    (step === 4 && !!form.truckType) ||
    step === 5;

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

  const truck = form.truckType ? TRUCK_OPTIONS.find((t) => t.id === form.truckType) : null;

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="max-w-2xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Form Card */}
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
                  {CITIES.map((city) => (
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
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                    Weight (Tons)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateForm("weight", Math.max(0.5, form.weight - 0.5))}
                      className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors"
                    >
                      −
                    </button>
                    <div className="flex-1 bg-neutral-50 border border-neutral-100 rounded-lg py-3 text-center">
                      <p className="font-poppins font-bold text-xl text-neutral-800">{form.weight}</p>
                      <p className="text-xs text-neutral-400">Tons</p>
                    </div>
                    <button
                      onClick={() => updateForm("weight", Math.min(50, form.weight + 0.5))}
                      className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-300 mt-2">Recommended: 2–5 Tons for your route</p>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                    Number of Items
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateForm("quantity", Math.max(1, form.quantity - 1))}
                      className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors"
                    >
                      −
                    </button>
                    <div className="flex-1 bg-neutral-50 border border-neutral-100 rounded-lg py-3 text-center">
                      <p className="font-poppins font-bold text-xl text-neutral-800">{form.quantity}</p>
                      <p className="text-xs text-neutral-400">items</p>
                    </div>
                    <button
                      onClick={() => updateForm("quantity", Math.min(100, form.quantity + 1))}
                      className="w-10 h-10 rounded-lg bg-primary-50 text-primary font-bold text-lg flex items-center justify-center hover:bg-primary/15 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Material Type */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                    Material Type
                  </label>
                  <div className="relative">
                    <select
                      value={form.materialType}
                      onChange={(e) => updateForm("materialType", e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-700 outline-none appearance-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all"
                    >
                      <option value="">Select material type</option>
                      {MATERIAL_TYPES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                    Additional Notes <span className="text-neutral-300 normal-case font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={form.notes}
                      onChange={(e) => updateForm("notes", e.target.value.slice(0, 200))}
                      placeholder="Any special instructions..."
                      rows={3}
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
                {TRUCK_OPTIONS.map((truckOpt) => (
                  <button
                    key={truckOpt.id}
                    onClick={() => updateForm("truckType", truckOpt.id)}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left relative ${
                      form.truckType === truckOpt.id
                        ? truckOpt.id === "part"
                          ? "border-success/40 bg-green-50"
                          : "border-primary bg-primary-50"
                        : "border-neutral-100 bg-neutral-50 hover:border-neutral-200"
                    }`}
                  >
                    {truckOpt.featured && (
                      <span className="absolute top-3 right-3 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded">
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
                      <p className="font-poppins font-bold text-base text-primary mt-2">
                        ₹{truckOpt.basePrice.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-neutral-400 ml-1">base</span>
                      </p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {/* Left: Summary */}
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

                  {/* Payment Method */}
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Payment Method</p>
                    <div className="space-y-2">
                      {[
                        { id: "upi", label: "UPI", Icon: Smartphone },
                        { id: "card", label: "Card", Icon: CreditCard },
                        { id: "netbanking", label: "Net Banking", Icon: Landmark },
                      ].map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          onClick={() => updateForm("paymentMethod", id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                            form.paymentMethod === id
                              ? "border-primary bg-primary-50"
                              : "border-neutral-100 bg-white hover:border-neutral-200"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${form.paymentMethod === id ? "text-primary" : "text-neutral-300"}`} />
                          <span className={`text-sm font-medium ${form.paymentMethod === id ? "text-primary" : "text-neutral-500"}`}>
                            {label}
                          </span>
                          {form.paymentMethod === id && (
                            <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Pricing */}
                <div>
                  <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Price Breakdown</p>
                  {priceBreakdown ? (
                    <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-500">Base Fare</span>
                        <span className="text-sm font-medium text-neutral-700">
                          ₹{priceBreakdown.baseFare.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-500">
                          Distance <span className="text-neutral-300">(~{priceBreakdown.distance} km)</span>
                        </span>
                        <span className="text-sm font-medium text-neutral-700">
                          ₹{priceBreakdown.distanceFare.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-neutral-500">Platform Fee (10%)</span>
                        <span className="text-sm font-medium text-neutral-700">
                          ₹{priceBreakdown.platformFee.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="border-t border-neutral-200 pt-3 mt-1">
                        <div className="flex justify-between items-center">
                          <span className="font-poppins font-semibold text-base text-neutral-800">Total</span>
                          <span className="font-poppins font-bold text-2xl text-primary">
                            ₹{priceBreakdown.total.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-neutral-50 rounded-xl p-6 text-center">
                      <p className="text-sm text-neutral-400">Price will appear here</p>
                    </div>
                  )}
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
            disabled={!canContinue}
            className="px-6 md:px-8 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {step === 5 ? "Confirm Booking" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
