import React, { useState, useMemo } from "react";
import { Search, Phone, Check, Truck, MapPin, ArrowRight, Clock } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { BOOKINGS, TIMELINE_STEPS } from "../data/mockData";

export default function TrackShipment() {
  const [searchId, setSearchId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const activeBooking = useMemo(() => {
    if (searchQuery) {
      return BOOKINGS.find((b) => b.id.toLowerCase() === searchQuery.toLowerCase()) || null;
    }
    return BOOKINGS.find((b) => b.id === "BKG-202412-001") || BOOKINGS[0];
  }, [searchQuery]);

  const handleSearch = () => {
    if (!searchId.trim()) return;
    setSearching(true);
    setTimeout(() => {
      setSearchQuery(searchId.trim());
      setSearching(false);
    }, 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

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

      {activeBooking ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6">
          {/* Left Panel */}
          <div className="lg:col-span-2 space-y-4 md:space-y-5">
            {/* Booking Summary Card */}
            <div className="bg-white rounded-xl shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-neutral-400 font-medium mb-0.5">{activeBooking.id}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-poppins font-bold text-base text-neutral-800">
                      {activeBooking.pickup}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="font-poppins font-bold text-base text-neutral-800">
                      {activeBooking.drop}
                    </span>
                  </div>
                </div>
                <StatusBadge status={activeBooking.status} />
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
              {activeBooking.driver && (
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

            {/* Status Timeline */}
            <div className="bg-white rounded-xl shadow-card p-5">
              <h3 className="font-poppins font-semibold text-base text-neutral-800 mb-4">Shipment Timeline</h3>
              <div className="space-y-0">
                {TIMELINE_STEPS.map((step, index) => {
                  const isCompleted = index < activeBooking.currentStep;
                  const isCurrent = index === activeBooking.currentStep;
                  const isVisible = index <= Math.min(activeBooking.currentStep + 1, TIMELINE_STEPS.length - 1);
                  if (!isVisible) return null;

                  return (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
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
                        {index < TIMELINE_STEPS.length - 1 && index <= activeBooking.currentStep && (
                          <div className={`w-0.5 h-8 ${isCompleted ? "bg-success" : "bg-neutral-100"}`} />
                        )}
                      </div>
                      <div className="pt-0.5 pb-4">
                        <span
                          className={`text-sm font-medium ${
                            isCompleted ? "text-success" : isCurrent ? "text-primary font-semibold" : "text-neutral-300"
                          }`}
                        >
                          {step}
                        </span>
                        {isCurrent && (
                          <span className="block text-[11px] text-neutral-400 mt-0.5">Current Status</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              {/* Map Grid Background */}
              <div className="absolute inset-0 bg-[#F0F4F8]">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="mapgrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#CBD5E1" strokeWidth="0.6" />
                    </pattern>
                    <pattern id="bigGrid" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                      <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#B8C5D6" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#mapgrid)" />
                  <rect width="100%" height="100%" fill="url(#bigGrid)" />
                  {/* Road lines */}
                  <line x1="0" y1="45%" x2="100%" y2="45%" stroke="#DDE4ED" strokeWidth="8" />
                  <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#DDE4ED" strokeWidth="5" />
                  <line x1="30%" y1="0" x2="30%" y2="100%" stroke="#DDE4ED" strokeWidth="5" />
                  <line x1="65%" y1="0" x2="65%" y2="100%" stroke="#DDE4ED" strokeWidth="8" />
                  <line x1="15%" y1="0" x2="15%" y2="100%" stroke="#DDE4ED" strokeWidth="3" />
                  <line x1="80%" y1="0" x2="80%" y2="100%" stroke="#DDE4ED" strokeWidth="3" />
                  <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#DDE4ED" strokeWidth="3" />
                  <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#DDE4ED" strokeWidth="3" />
                </svg>
              </div>

              {/* Live chip */}
              <div className="absolute top-4 left-4 z-10 bg-success text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-white animate-green-pulse" />
                Live Tracking
              </div>

              {/* Booking ID chip */}
              <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-card">
                <p className="text-[11px] text-neutral-400">Tracking</p>
                <p className="text-xs font-semibold text-neutral-700">{activeBooking.id}</p>
              </div>

              {/* Pickup Pin */}
              <div className="absolute top-[35%] left-[20%] z-10">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-glow-blue">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white text-[10px] font-semibold text-neutral-700 px-2 py-0.5 rounded shadow-card mt-1 whitespace-nowrap">
                    {activeBooking.pickup}
                  </div>
                </div>
              </div>

              {/* Drop Pin */}
              <div className="absolute top-[50%] right-[20%] z-10">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-glow-green">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white text-[10px] font-semibold text-neutral-700 px-2 py-0.5 rounded shadow-card mt-1 whitespace-nowrap">
                    {activeBooking.drop}
                  </div>
                </div>
              </div>

              {/* Dashed route line */}
              <svg className="absolute inset-0 w-full h-full z-[5] pointer-events-none" preserveAspectRatio="none">
                <line
                  x1="22%"
                  y1="38%"
                  x2="78%"
                  y2="52%"
                  stroke="#1976FF"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.5"
                />
              </svg>

              {/* Animated Truck Pin — midpoint */}
              <div className="absolute top-[42%] left-[50%] -translate-x-1/2 -translate-y-full z-20">
                <div className="animate-float">
                  <div className="relative">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-glow-blue border-2 border-white">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
                  </div>
                </div>
              </div>

              {/* ETA Chip */}
              <div className="absolute bottom-5 right-5 z-10 bg-white rounded-xl px-4 md:px-5 py-3 shadow-card flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400">Estimated Arrival</p>
                  <p className="font-poppins font-bold text-base text-neutral-800">2h 45min</p>
                </div>
              </div>

              {/* Material info chip */}
              <div className="absolute bottom-5 left-5 z-10 bg-white/95 rounded-lg px-3 py-2 shadow-card">
                <p className="text-[10px] text-neutral-400 mb-0.5">Cargo</p>
                <p className="text-xs font-semibold text-neutral-700">{activeBooking.material}</p>
                <p className="text-[10px] text-neutral-400">{activeBooking.weight} {activeBooking.weightUnit}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 md:py-32 bg-white rounded-xl shadow-card">
          <MapPin className="w-16 h-16 text-neutral-200 mb-4" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">Booking not found</h3>
          <p className="text-sm text-neutral-400 text-center px-4">
            No booking found with ID &quot;{searchQuery}&quot;. Please check and try again.
          </p>
        </div>
      )}
    </div>
  );
}
