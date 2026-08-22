import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, AlertTriangle, Receipt, Package, CheckCircle2, SlidersHorizontal,
  RefreshCw, MapPin, Headphones, Download, Eye, ArrowRight,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import RowMenu from "../components/RowMenu";
import SpeedDialFab from "../components/SpeedDialFab";
import MapView from "../components/MapView";
import { TRUCK_IMAGES } from "../lib/truckImages";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef } from "../utils";

const PAGE_SIZE = 5;
const LIVE_STATUSES = ["Assigned", "En Route", "Picked Up", "In Transit"];
const TERMINAL_STATUSES = ["Delivered", "Completed", "Cancelled"];
const INVOICE_READY_STATUSES = ["Delivered", "Completed"];
const TABLE_FILTERS = ["All", "Active", "Delivered", "Cancelled"];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Bounded so the dashboard never fires off dozens of parallel tracking calls at once — a
// handful of live pins is plenty for an overview map (the full picture is one click away
// via "View Full Map" -> /track).
const MAX_LIVE_TRACKED = 6;

const formatUpcoming = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${time}`;
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

// Same eased count-up used on this page before the redesign — kept for the stat boxes below.
function CountUp({ end, duration = 800 }) {
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
  return <span>{value.toLocaleString("en-IN")}</span>;
}

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [page, setPage] = useState(1);
  const [tableFilter, setTableFilter] = useState("All");
  const [downloadingId, setDownloadingId] = useState(null);
  const [liveTrucks, setLiveTrucks] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [bookingsRes, analyticsRes, disputesRes] = await Promise.all([
        api.get("/api/bookings?limit=100", token),
        api.get("/api/analytics/client", token),
        api.get("/api/disputes?limit=100", token),
      ]);
      if (!bookingsRes?.success) throw new Error(bookingsRes?.message || "Failed to load bookings");
      setBookings((bookingsRes.data?.bookings || []).map(adaptBooking));
      if (analyticsRes?.success) setAnalytics(analyticsRes.data);
      // "Pending Issues" = disputes not yet resolved (open or under_review) — real data, not
      // a fabricated count; disputesRes failing is non-fatal, the rest of the page still works.
      if (disputesRes?.success) {
        setOpenIssueCount((disputesRes.data?.disputes || []).filter((d) => d.status !== "resolved").length);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live positions for the "Live Shipment Map" panel — reuses the same per-booking tracking
  // endpoint TrackShipment.jsx polls, just fetched once (not on an interval) for a bounded
  // handful of currently-live bookings, since this is an overview, not the live tracking screen.
  useEffect(() => {
    const liveBookings = bookings.filter((b) => LIVE_STATUSES.includes(b.status)).slice(0, MAX_LIVE_TRACKED);
    if (!liveBookings.length) {
      setLiveTrucks([]);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    Promise.all(
      liveBookings.map(async (b) => {
        try {
          const res = await api.get(`/api/bookings/${b.id}/track`, token);
          const data = res?.data || {};
          if (data.driverLat == null || data.driverLng == null) return null;
          return {
            id: b.id,
            lat: Number(data.driverLat),
            lng: Number(data.driverLng),
            category: b.truckCategory,
            hasIncident: !!data.incident,
            status: b.status,
          };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!cancelled) setLiveTrucks(results.filter(Boolean));
    }).finally(() => {
      if (!cancelled) setLiveLoading(false);
    });
    return () => { cancelled = true; };
  }, [bookings, token]);

  const movingCount = liveTrucks.filter((t) => !t.hasIncident && ["En Route", "Picked Up", "In Transit"].includes(t.status)).length;
  const idleCount = liveTrucks.filter((t) => !t.hasIncident && t.status === "Assigned").length;
  const delayedCount = liveTrucks.filter((t) => t.hasIncident).length;

  const upcomingBookings = useMemo(
    () => bookings
      .filter((b) => ["Requested", "Confirmed"].includes(b.status))
      .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0))
      .slice(0, 4),
    [bookings]
  );

  const tableFilteredBookings = useMemo(() => {
    if (tableFilter === "All") return bookings;
    if (tableFilter === "Active") return bookings.filter((b) => !TERMINAL_STATUSES.includes(b.status));
    if (tableFilter === "Delivered") return bookings.filter((b) => ["Delivered", "Completed"].includes(b.status));
    return bookings.filter((b) => b.status === "Cancelled");
  }, [bookings, tableFilter]);

  useEffect(() => setPage(1), [tableFilter]);

  const totalPages = Math.max(1, Math.ceil(tableFilteredBookings.length / PAGE_SIZE));
  const pagedBookings = tableFilteredBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDownloadInvoice = async (booking) => {
    if (downloadingId) return;
    setDownloadingId(booking.id);
    try {
      const blobUrl = await api.getFileBlobUrl(`${API_BASE}/api/bookings/${booking.id}/invoice`, token);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `invoice-${bookingRef(booking)}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(err?.message || "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExport = () => {
    const rows = [
      ["Tracking ID", "Driver", "Vehicle", "Route", "Status", "Date", "Amount"],
      ...tableFilteredBookings.map((b) => [
        bookingRef(b), b.driver?.name || "", b.truckReg || b.truckType || "",
        `${b.pickup || ""} -> ${b.drop || ""}`, b.status, b.date, b.amount,
      ]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const quickActions = [
    { label: "Book a Truck", icon: Truck, onClick: () => navigate("/book") },
    { label: "Track Shipment", icon: MapPin, onClick: () => navigate("/track") },
    { label: "My Invoices", icon: Receipt, onClick: () => navigate("/bookings") },
    { label: "Support", icon: Headphones, onClick: () => navigate("/profile") },
  ];

  const today = new Date().toDateString();
  const deliveredToday = bookings.filter(
    (b) => ["Delivered", "Completed"].includes(b.status) && b.updatedAt && new Date(b.updatedAt).toDateString() === today
  ).length;

  const statCards = [
    { label: "Total Shipments", value: analytics?.totalBookings ?? 0, icon: Package, sub: "All time" },
    { label: "Active Bookings", value: analytics?.activeBookings ?? 0, icon: Truck, sub: "Right now" },
    { label: "Delivered Today", value: deliveredToday, icon: CheckCircle2, sub: "So far today" },
    {
      label: "Pending Issues", value: openIssueCount, icon: AlertTriangle,
      sub: openIssueCount > 0 ? "Requires immediate attention" : "No open issues",
      danger: openIssueCount > 0,
    },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-8 animate-page-enter">
        <div className="h-7 w-44 skeleton-shimmer animate-shimmer rounded mb-5" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton-shimmer animate-shimmer rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-6 mb-5 md:mb-6">
          <div className="xl:col-span-2 h-80 skeleton-shimmer animate-shimmer rounded-xl" />
          <div className="h-80 skeleton-shimmer animate-shimmer rounded-xl" />
        </div>
        <div className="h-72 skeleton-shimmer animate-shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 animate-page-enter">
      <div className="mb-5 md:mb-6">
        <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Overview</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Live operations status and metrics.</p>
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-card p-8 flex flex-col items-center text-center">
          <AlertTriangle className="w-8 h-8 text-danger/40 mb-2" />
          <p className="text-sm text-neutral-400 mb-3">Couldn't load your dashboard</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl p-4 md:p-5 transition-shadow duration-200 ${
                  card.danger ? "bg-red-50" : "bg-white shadow-card hover:shadow-card-hover"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${card.danger ? "text-danger/70" : "text-neutral-400"}`}>
                    {card.label}
                  </p>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${card.danger ? "bg-danger/10" : "bg-primary/10"}`}>
                    <card.icon className={`w-3.5 h-3.5 ${card.danger ? "text-danger" : "text-primary"}`} />
                  </div>
                </div>
                <p className={`font-poppins font-bold text-2xl md:text-3xl leading-tight ${card.danger ? "text-danger" : "text-neutral-800"}`}>
                  <CountUp end={card.value} />
                </p>
                <p className={`text-xs mt-1 ${card.danger ? "text-danger/70 font-medium" : "text-neutral-400"}`}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Live map + Upcoming bookings */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-6 items-stretch mb-5 md:mb-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-50">
                <h3 className="font-poppins font-semibold text-base text-neutral-800">Live Shipment Map</h3>
                <button
                  onClick={() => navigate("/track")}
                  className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  View Full Map <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {liveTrucks.length > 0 && (
                <div className="px-5 pt-3 flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-success flex-shrink-0" /> Moving ({movingCount})</span>
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" /> Idle ({idleCount})</span>
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-danger flex-shrink-0" /> Delayed ({delayedCount})</span>
                </div>
              )}

              <div className="flex-1 min-h-[260px] p-3">
                {liveLoading && !liveTrucks.length ? (
                  <div className="h-full min-h-[240px] rounded-lg bg-neutral-50 flex items-center justify-center">
                    <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : liveTrucks.length === 0 ? (
                  <div className="h-full min-h-[240px] rounded-lg bg-neutral-50 flex flex-col items-center justify-center text-center">
                    <Truck className="w-7 h-7 text-neutral-200 mb-2" />
                    <p className="text-sm text-neutral-400">No active shipments right now</p>
                  </div>
                ) : (
                  <MapView
                    markers={liveTrucks.map((t) => ({
                      id: t.id,
                      position: { lat: t.lat, lng: t.lng },
                      iconUrl: TRUCK_IMAGES[t.category] || TRUCK_IMAGES.medium,
                      iconSize: 32,
                      title: t.hasIncident ? "Delayed" : "En route",
                    }))}
                    height="100%"
                    className="rounded-lg overflow-hidden"
                  />
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-card flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-50">
                <h3 className="font-poppins font-semibold text-base text-neutral-800">Upcoming Bookings</h3>
                <button onClick={() => navigate("/bookings")} className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors flex-shrink-0">
                  View All
                </button>
              </div>
              <div className="flex-1 min-h-[200px] p-3 space-y-1 overflow-y-auto">
                {upcomingBookings.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-10">No upcoming bookings</p>
                ) : (
                  upcomingBookings.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/bookings/${b.id}`)}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{bookingRef(b)}</p>
                        <p className="text-xs text-neutral-500 truncate">{b.pickup} → {b.drop}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-neutral-400">{formatUpcoming(b.scheduledAt)}</span>
                          {b.truckType && (
                            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">{b.truckType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-neutral-50 flex-shrink-0">
                <button
                  onClick={() => navigate("/book")}
                  className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Book New Truck
                </button>
              </div>
            </div>
          </div>

          {/* Recent Shipments */}
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-50 flex-wrap gap-3">
              <h3 className="font-poppins font-semibold text-base text-neutral-800">Recent Shipments</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    className="appearance-none pl-8 pr-6 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer bg-white"
                  >
                    {TABLE_FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 disabled:opacity-40 hover:bg-neutral-50 transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 disabled:opacity-40 hover:bg-neutral-50 transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!tableFilteredBookings.length ? (
              <div className="flex flex-col items-center justify-center py-14">
                <Package className="w-9 h-9 text-neutral-200 mb-2" />
                <p className="text-sm text-neutral-400">No shipments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-50">
                      {["Tracking ID", "Driver / Vehicle", "Route", "Status", "ETA"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {pagedBookings.map((booking) => {
                      const driverInitials = (booking.driver?.name || "—").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <tr
                          key={booking.id}
                          onClick={() => navigate(`/bookings/${booking.id}`)}
                          className="hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3.5 text-neutral-700 font-mono text-xs whitespace-nowrap">{bookingRef(booking)}</td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-primary">{driverInitials}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-neutral-700 font-medium truncate">{booking.driver?.name || "—"}</p>
                                <p className="text-[11px] text-neutral-400 truncate">{booking.truckReg || booking.truckType || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-neutral-500 max-w-[200px] truncate" title={`${booking.pickup || ""} → ${booking.drop || ""}`}>
                            {booking.pickup} → {booking.drop}
                          </td>
                          <td className="px-3 py-3.5"><StatusBadge status={booking.status} /></td>
                          <td className="px-3 py-3.5 text-neutral-500 whitespace-nowrap">{booking.date}</td>
                          <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <RowMenu
                              items={[
                                { label: "View Details", icon: Eye, onClick: () => navigate(`/bookings/${booking.id}`) },
                                INVOICE_READY_STATUSES.includes(booking.status)
                                  ? {
                                      label: "Download Invoice",
                                      pendingLabel: "Downloading...",
                                      icon: Download,
                                      disabled: downloadingId === booking.id,
                                      onClick: () => handleDownloadInvoice(booking),
                                    }
                                  : { disabledLabel: "Invoice available after delivery" },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-4 border-t border-neutral-50 text-center">
              <button onClick={() => navigate("/bookings")} className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
                View All Shipments
              </button>
            </div>
          </div>
        </>
      )}

      {/* Quick actions — pinned to the bottom-right of the viewport, stays put while the
          page scrolls (see SpeedDialFab.jsx). */}
      <SpeedDialFab actions={quickActions} />
    </div>
  );
}
