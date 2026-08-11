import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, AlertTriangle, Receipt, PackagePlus, Search, SlidersHorizontal,
  RefreshCw, Package, TrendingUp, MapPin, Headphones, Download, Eye,
} from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import RouteProgressCard from "../components/RouteProgressCard";
import RowMenu from "../components/RowMenu";
import SpeedDialFab from "../components/SpeedDialFab";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef, TIMELINE_STEPS } from "../utils";

const PAGE_SIZE = 5;
const TERMINAL_STATUSES = ["Delivered", "Completed", "Cancelled"];
const INVOICE_READY_STATUSES = ["Delivered", "Completed"];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [routeSearch, setRouteSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [bookingsRes, analyticsRes] = await Promise.all([
        api.get("/api/bookings?limit=100", token),
        api.get("/api/analytics/client", token),
      ]);
      if (!bookingsRes?.success) throw new Error(bookingsRes?.message || "Failed to load bookings");
      setBookings((bookingsRes.data?.bookings || []).map(adaptBooking));
      if (analyticsRes?.success) setAnalytics(analyticsRes.data);
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

  const activeBookings = useMemo(
    () => bookings.filter((b) => !TERMINAL_STATUSES.includes(b.status)),
    [bookings]
  );

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    if (!q) return activeBookings;
    return activeBookings.filter((b) =>
      bookingRef(b).toLowerCase().includes(q) ||
      b.pickup?.toLowerCase().includes(q) ||
      b.drop?.toLowerCase().includes(q)
    );
  }, [activeBookings, routeSearch]);

  // Highlight whichever active route is furthest along — a meaningful "most worth watching"
  // pick rather than an arbitrary position in the list.
  const mostAdvancedId = useMemo(() => {
    if (!filteredRoutes.length) return null;
    return filteredRoutes.reduce((best, b) => (b.currentStep > (best?.currentStep ?? -1) ? b : best), null)?.id;
  }, [filteredRoutes]);

  const totalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
  const pagedBookings = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === pagedBookings.length && pagedBookings.length > 0 ? new Set() : new Set(pagedBookings.map((b) => b.id))));
  };
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  const quickActions = [
    { label: "Book a Truck", icon: Truck, onClick: () => navigate("/book") },
    { label: "Track Shipment", icon: MapPin, onClick: () => navigate("/track") },
    { label: "My Invoices", icon: Receipt, onClick: () => navigate("/bookings") },
    { label: "Support", icon: Headphones, onClick: () => navigate("/profile") },
  ];

  const statCards = [
    { label: "Total Bookings", value: analytics?.totalBookings ?? 0, icon: PackagePlus, sub: "All time" },
    { label: "Total Cancelled", value: analytics?.cancelledBookings ?? 0, icon: AlertTriangle, sub: "All time" },
    { label: "Total Paid", value: analytics?.paidInvoices ?? 0, icon: Receipt, sub: "All time" },
    { label: "Active Bookings", value: analytics?.activeBookings ?? 0, icon: Truck, sub: "Right now" },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-8 animate-page-enter">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-6">
          <div className="xl:col-span-2 space-y-5">
            <div className="h-7 w-44 skeleton-shimmer animate-shimmer rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton-shimmer animate-shimmer rounded-xl" />)}
            </div>
            <div className="h-64 skeleton-shimmer animate-shimmer rounded-xl" />
            <div className="h-56 skeleton-shimmer animate-shimmer rounded-xl" />
          </div>
          <div className="h-[520px] skeleton-shimmer animate-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 h-full animate-page-enter">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-6 items-stretch">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-5 md:space-y-6">
          <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Recent Activities</h1>

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
              {/* Stat boxes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className="relative bg-white rounded-xl shadow-card p-4 md:p-5 flex items-start gap-3 md:gap-4 hover:shadow-card-hover transition-shadow duration-200"
                  >
                    <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-card" title={card.sub}>
                      <TrendingUp className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <card.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-poppins font-bold text-xl md:text-2xl text-neutral-800 leading-tight">
                        <CountUp end={card.value} />
                      </p>
                      <p className="text-xs md:text-sm text-neutral-500 mt-0.5">{card.label}</p>
                      <p className="text-[10px] md:text-xs text-neutral-300 mt-1 hidden sm:block">{card.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Booking information */}
              <div className="bg-white rounded-xl shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-50">
                  <h3 className="font-poppins font-semibold text-base text-neutral-800">Booking information</h3>
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

                {!bookings.length ? (
                  <div className="flex flex-col items-center justify-center py-14">
                    <Package className="w-9 h-9 text-neutral-200 mb-2" />
                    <p className="text-sm text-neutral-400">No bookings yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-50">
                          <th className="px-5 py-3 w-8">
                            <input
                              type="checkbox"
                              checked={pagedBookings.length > 0 && selectedIds.size === pagedBookings.length}
                              onChange={toggleSelectAll}
                              className="rounded border-neutral-300"
                            />
                          </th>
                          {["Driver", "Truck Type", "Route", "Status"].map((h) => (
                            <th key={h} className="text-left px-3 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {pagedBookings.map((booking) => (
                          <tr
                            key={booking.id}
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                            className="hover:bg-neutral-50 transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(booking.id)}
                                onChange={() => toggleSelect(booking.id)}
                                className="rounded border-neutral-300"
                              />
                            </td>
                            <td className="px-3 py-3.5 text-neutral-700 font-medium whitespace-nowrap">{booking.driver?.name || "—"}</td>
                            <td className="px-3 py-3.5 text-neutral-500 whitespace-nowrap">{booking.truckType || "—"}</td>
                            <td className="px-3 py-3.5 text-neutral-500 font-mono text-xs whitespace-nowrap">{bookingRef(booking)}</td>
                            <td className="px-3 py-3.5"><StatusBadge status={booking.status} /></td>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </>
          )}
        </div>

        {/* Right: Active Rides — h-full + flex-col so this column stretches to match the left
            column's height (grid's items-stretch above) instead of stopping short partway down
            the page; the route list is the flexible part that grows/scrolls to fill it. */}
        <div className="h-full flex flex-col space-y-4">
          <h2 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Active Rides</h2>

          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-3 py-2.5 shadow-card flex-shrink-0">
            <Search className="w-4 h-4 text-neutral-300 flex-shrink-0" />
            <input
              type="text"
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              placeholder="Search by name or route #"
              className="flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300 min-w-0"
            />
            <SlidersHorizontal className="w-4 h-4 text-neutral-300 flex-shrink-0" />
          </div>

          <div className="flex-1 min-h-[200px] overflow-y-auto pr-0.5">
            {!filteredRoutes.length ? (
              <div className="h-full min-h-[200px] bg-white rounded-xl shadow-card p-8 flex flex-col items-center justify-center text-center">
                <Truck className="w-8 h-8 text-neutral-200 mb-2" />
                <p className="text-sm text-neutral-400">No active shipments right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRoutes.map((booking) => (
                  <RouteProgressCard
                    key={booking.id}
                    booking={booking}
                    highlighted={booking.id === mostAdvancedId}
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Quick actions — pinned to the bottom-right of the viewport, stays put while the
          page scrolls (see SpeedDialFab.jsx). */}
      <SpeedDialFab actions={quickActions} />
    </div>
  );
}
