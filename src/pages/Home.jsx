import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Package, Wallet, Truck, MapPin, Receipt, Headphones,
  ArrowRight, CheckCircle, TrendingUp, AlertTriangle, RefreshCw,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef } from "../utils";

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
  const [error, setError] = useState(false);
  const [bookings, setBookings] = useState([]);
  const token = getToken();

  const stats = useMemo(
    () => ({
      active: bookings.filter((b) => ["Assigned", "In Transit", "En Route", "Picked Up", "Confirmed"].includes(b.status)).length,
      total: bookings.length,
      spent: bookings.filter((b) => b.status !== "Cancelled").reduce((sum, b) => sum + b.amount, 0),
      delivered: bookings.filter((b) => b.status === "Delivered" || b.status === "Completed").length,
    }),
    [bookings]
  );

  const recentBookings = useMemo(() => bookings.slice(0, 5), [bookings]);

  const loadBookings = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get("/api/bookings?limit=100", token);
      if (!response?.success) throw new Error(response?.message || "Failed to load bookings");
      setBookings((response.data?.bookings || response.data || []).map(adaptBooking));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickActions = [
    { label: "Book a Truck", icon: Truck, color: "bg-primary", desc: "New booking", path: "/book" },
    { label: "Track Shipment", icon: MapPin, color: "bg-primary", desc: "Live tracking", path: "/track" },
    { label: "My Invoices", icon: Receipt, color: "bg-primary", desc: "View invoices", path: "/bookings" },
    { label: "Support", icon: Headphones, color: "bg-primary", desc: "Get help", path: "/profile" },
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
      color: "text-primary",
      bg: "bg-primary/10",
      trend: "All time",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      display: null,
      icon: CheckCircle,
      color: "text-primary",
      bg: "bg-primary/10",
      trend: "Successfully",
    },
    {
      label: "Total Spent",
      value: null,
      display: `₹${Math.round(stats.spent / 1000) / 10}L`,
      icon: Wallet,
      color: "text-primary",
      bg: "bg-primary/10",
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
            className="relative bg-white rounded-xl shadow-card p-4 md:p-5 flex items-start gap-3 md:gap-4 hover:shadow-card-hover transition-shadow duration-200"
          >
            <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-card" title={card.trend}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
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
              <p className="text-[10px] md:text-xs text-neutral-300 mt-1 hidden sm:block">
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
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="w-10 h-10 text-danger/40 mb-3" />
                <p className="text-sm text-neutral-400 mb-3">Couldn't load recent bookings</p>
                <button
                  onClick={loadBookings}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Package className="w-10 h-10 text-neutral-200 mb-3" />
                <p className="text-sm text-neutral-400">No bookings yet</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    className="cursor-pointer hover:bg-neutral-50 transition-colors duration-150"
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-4 items-center">
                      <div className="min-w-0">
                        <p className="text-[11px] text-neutral-400 font-medium mb-0.5">{bookingRef(booking)}</p>
                        <p
                          className="text-sm font-semibold text-neutral-700 truncate max-w-[220px]"
                          title={`${booking.pickup} → ${booking.drop}`}
                        >
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
                          <p className="text-[10px] text-neutral-400 mb-0.5">{bookingRef(booking)}</p>
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
            style={{ background: "linear-gradient(135deg, #1565C0 0%, #1976FF 100%)" }}
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
                { label: "In Transit", count: bookings.filter(b => b.status === "In Transit").length, color: "bg-warning" },
                { label: "Delivered", count: bookings.filter(b => b.status === "Delivered" || b.status === "Completed").length, color: "bg-success" },
                { label: "Assigned", count: bookings.filter(b => b.status === "Assigned").length, color: "bg-primary" },
                { label: "Cancelled", count: bookings.filter(b => b.status === "Cancelled").length, color: "bg-danger" },
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
                        style={{ width: `${bookings.length ? (item.count / bookings.length) * 100 : 0}%` }}
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
    </div>
  );
}
