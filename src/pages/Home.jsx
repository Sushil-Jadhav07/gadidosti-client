import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Package, Wallet, Truck, MapPin, Receipt, Headphones,
  ArrowRight, CheckCircle, TrendingUp,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import StatusBadge from "../components/StatusBadge";
import { BOOKINGS, TIMELINE_STEPS } from "../data/mockData";

function CountUp({ end, duration = 800, prefix = "", suffix = "" }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span>
      {prefix}
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const stats = useMemo(
    () => ({
      active: BOOKINGS.filter((b) => b.status === "Assigned" || b.status === "In Transit").length,
      total: BOOKINGS.length,
      spent: BOOKINGS.filter((b) => b.status !== "Cancelled").reduce((sum, b) => sum + b.amount, 0),
      delivered: BOOKINGS.filter((b) => b.status === "Delivered").length,
    }),
    []
  );

  const recentBookings = useMemo(() => BOOKINGS.slice(0, 6), []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const quickActions = [
    { label: "Book a Truck", icon: Truck, color: "bg-primary", desc: "New booking", path: "/book" },
    { label: "Track Shipment", icon: MapPin, color: "bg-success", desc: "Live tracking", path: "/track" },
    { label: "My Invoices", icon: Receipt, color: "bg-secondary", desc: "View invoices", path: "/bookings" },
    { label: "Support", icon: Headphones, color: "bg-warning", desc: "Get help", path: "/profile" },
  ];

  const statCards = [
    {
      label: "Active Shipments",
      value: stats.active,
      display: null,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
      trend: "+2 this week",
    },
    {
      label: "Total Bookings",
      value: stats.total,
      display: null,
      icon: Package,
      color: "text-success",
      bg: "bg-success/10",
      trend: "All time",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      display: null,
      icon: CheckCircle,
      color: "text-tertiary",
      bg: "bg-tertiary/10",
      trend: "Successfully",
    },
    {
      label: "Total Spent",
      value: null,
      display: `₹${Math.round(stats.spent / 1000) / 10}L`,
      icon: Wallet,
      color: "text-warning",
      bg: "bg-warning/10",
      trend: "All time value",
    },
  ];

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-card p-4 md:p-5 flex items-start gap-3 md:gap-4 hover:shadow-card-hover transition-shadow duration-200"
          >
            <div
              className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}
            >
              <card.icon className={`w-5 h-5 md:w-6 md:h-6 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 leading-tight">
                {card.display ? (
                  card.display
                ) : (
                  <CountUp end={card.value} />
                )}
              </p>
              <p className="text-xs md:text-sm text-neutral-500 mt-0.5">{card.label}</p>
              <p className="text-[10px] md:text-xs text-neutral-300 mt-1 hidden sm:flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {card.trend}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        {/* Recent Bookings */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-base md:text-lg text-neutral-800">Recent Bookings</h3>
            <button
              onClick={() => navigate("/bookings")}
              className="text-sm font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-3 bg-neutral-50 border-b border-neutral-100">
              {["Booking / Route", "Truck Type", "Date", "Amount", "Status"].map((h) => (
                <span key={h} className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                  {h}
                </span>
              ))}
            </div>

            {loading ? (
              <div className="divide-y divide-neutral-50">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="px-4 py-3 md:px-5 md:py-4">
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-4 skeleton-shimmer animate-shimmer rounded" />
                      ))}
                    </div>
                    <div className="md:hidden space-y-2">
                      <div className="h-4 skeleton-shimmer animate-shimmer rounded w-3/4" />
                      <div className="h-3 skeleton-shimmer animate-shimmer rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className="cursor-pointer hover:bg-neutral-50 transition-colors duration-150"
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-4 items-center">
                      <div>
                        <p className="text-[11px] text-neutral-400 font-medium mb-0.5">{booking.id}</p>
                        <p className="text-sm font-semibold text-neutral-700">
                          {booking.pickup} → {booking.drop}
                        </p>
                      </div>
                      <span className="text-sm text-neutral-600">{booking.truckType}</span>
                      <span className="text-sm text-neutral-600">{booking.date}</span>
                      <span className="font-poppins font-semibold text-neutral-800 text-sm">
                        ₹{booking.amount.toLocaleString("en-IN")}
                      </span>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 mr-3">
                          <p className="text-[10px] text-neutral-400 mb-0.5">{booking.id}</p>
                          <p className="text-sm font-semibold text-neutral-700 truncate">
                            {booking.pickup} → {booking.drop}
                          </p>
                        </div>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
                        <span>{booking.truckType}</span>
                        <span>·</span>
                        <span>{booking.date}</span>
                        <span className="ml-auto font-semibold text-neutral-700 text-sm">
                          ₹{booking.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5 md:space-y-6">
          {/* Quick Actions */}
          <div>
            <h3 className="font-poppins font-semibold text-base md:text-lg text-neutral-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`${action.color} rounded-xl p-4 flex flex-col items-start gap-2.5 text-left hover:opacity-90 active:scale-[0.97] transition-all duration-150`}
                >
                  <action.icon className="w-5 h-5 text-white" />
                  <div>
                    <p className="font-poppins font-semibold text-sm text-white leading-tight">{action.label}</p>
                    <p className="text-[11px] text-white/70 mt-0.5">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Promotional Banner */}
          <div
            className="relative rounded-xl overflow-hidden h-[160px] md:h-[180px] cursor-pointer hover:scale-[1.01] transition-transform duration-200"
            style={{ background: "linear-gradient(135deg, #17D86B 0%, #0EA5A0 100%)" }}
            onClick={() => navigate("/book")}
          >
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                    <circle cx="15" cy="15" r="1.5" fill="white" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
            </div>
            <div className="relative z-10 p-5 h-full flex flex-col justify-between">
              <div>
                <p className="text-white/70 text-xs font-medium mb-1 uppercase tracking-wide">Limited Offer</p>
                <h2 className="font-poppins font-bold text-2xl text-white leading-tight">Save up to 30%</h2>
                <p className="text-sm text-white/80 mt-1">with Part Truck sharing!</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white text-primary text-xs font-semibold px-4 py-2 rounded-md w-fit hover:bg-white/95 transition-colors">
                Book Now <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="bg-white rounded-xl shadow-card p-5">
            <h4 className="font-poppins font-semibold text-base text-neutral-800 mb-4">Shipment Summary</h4>
            <div className="space-y-3">
              {[
                { label: "In Transit", count: BOOKINGS.filter(b => b.status === "In Transit").length, color: "bg-warning" },
                { label: "Delivered", count: BOOKINGS.filter(b => b.status === "Delivered").length, color: "bg-success" },
                { label: "Assigned", count: BOOKINGS.filter(b => b.status === "Assigned").length, color: "bg-primary" },
                { label: "Cancelled", count: BOOKINGS.filter(b => b.status === "Cancelled").length, color: "bg-danger" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-sm text-neutral-600">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 md:w-24 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(item.count / BOOKINGS.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-neutral-700 w-4 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Detail Modal */}
      <BottomSheet isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)}>
        {selectedBooking && <BookingDetailContent booking={selectedBooking} />}
      </BottomSheet>
    </div>
  );
}

function BookingDetailContent({ booking }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5 pr-8">
        <div>
          <h3 className="font-poppins font-semibold text-lg text-neutral-800">{booking.id}</h3>
          <p className="text-sm text-neutral-400 mt-0.5">
            {booking.pickup} → {booking.drop}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Status Timeline */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">Status Timeline</p>
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, index) => {
            const isCompleted = index < booking.currentStep;
            const isCurrent = index === booking.currentStep;
            const isVisible = index <= booking.currentStep + 1;
            if (!isVisible) return null;

            return (
              <div key={step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? "bg-success"
                        : isCurrent
                        ? "bg-primary animate-pulse"
                        : "border-2 border-neutral-200"
                    }`}
                  >
                    {isCompleted && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && index <= booking.currentStep && (
                    <div className={`w-0.5 h-6 ${index < booking.currentStep ? "bg-success" : "bg-neutral-200"}`} />
                  )}
                </div>
                <span
                  className={`text-xs pt-0.5 ${
                    isCompleted ? "text-success font-medium" : isCurrent ? "text-primary font-semibold" : "text-neutral-300"
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Truck Type</p>
          <p className="text-sm font-medium text-neutral-700">{booking.truckType}</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Weight</p>
          <p className="text-sm font-medium text-neutral-700">
            {booking.weight} {booking.weightUnit}
          </p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Material</p>
          <p className="text-sm font-medium text-neutral-700">{booking.material}</p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Quantity</p>
          <p className="text-sm font-medium text-neutral-700">{booking.quantity} items</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-neutral-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-neutral-400">Total Amount</span>
          <span className="font-poppins font-bold text-xl text-primary">
            ₹{booking.amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-neutral-400">Payment Status</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              booking.paymentStatus === "Paid" ? "bg-green-50 text-success" : "bg-orange-50 text-warning"
            }`}
          >
            {booking.paymentStatus}
          </span>
        </div>
      </div>

      {booking.driver && (
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-[10px] text-neutral-400 mb-1">Driver</p>
          <p className="text-sm font-medium text-neutral-700">{booking.driver.name}</p>
          <p className="text-xs text-neutral-400">{booking.driver.phone}</p>
        </div>
      )}
    </div>
  );
}
