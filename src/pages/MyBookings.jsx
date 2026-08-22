import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertTriangle, RefreshCw, Download, Plus, Route as RouteIcon, Eye, ChevronLeft, ChevronRight, Search, ClipboardList } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { api, getToken } from "../services/api";
import { adaptBooking, bookingRef } from "../utils";

const FILTER_TABS = ["All", "Active", "In Transit", "Delivered", "Cancelled"];
// Raw backend status values (see utils.js's STATUS_LABELS) sent as the `status` query param —
// letting the server filter+paginate together instead of slicing a client-side page out of
// whatever the current page happened to fetch, which would silently show wrong counts.
const FILTER_STATUSES = {
  Active: "confirmed,assigned,en_route_pickup,picked_up,in_transit",
  "In Transit": "in_transit",
  Delivered: "delivered",
  Cancelled: "cancelled",
};
const PAGE_SIZE = 10;

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

// List-only — tapping a row/card navigates to /bookings/:id (BookingDetail.jsx) instead of
// opening an in-page modal, so there's room for a real map and the booking gets a shareable URL.
export default function MyBookings() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const token = getToken();

  // Debounced — commits searchInput to searchQuery (the value loadBookings actually reads)
  // 350ms after typing stops, and jumps back to page 1 since a new search could easily have
  // fewer matches than whatever page was showing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadBookings = async () => {
    setLoading(true);
    setError(false);
    try {
      // No backend text-search endpoint — searching pulls a larger real page (still capped at
      // what the server allows) and filters/paginates it client-side by booking ref/route,
      // instead of only ever searching whatever 10 rows the current page already has loaded.
      const isSearching = !!searchQuery;
      const params = new URLSearchParams({
        page: isSearching ? "1" : String(page),
        limit: isSearching ? "100" : String(PAGE_SIZE),
      });
      if (FILTER_STATUSES[activeFilter]) params.set("status", FILTER_STATUSES[activeFilter]);
      const response = await api.get(`/api/bookings?${params.toString()}`, token);
      if (!response?.success) throw new Error(response?.message || "Failed to load bookings");
      const adapted = (response.data?.bookings || []).map(adaptBooking);

      if (isSearching) {
        const q = searchQuery.toLowerCase();
        const matches = adapted.filter((b) =>
          bookingRef(b).toLowerCase().includes(q)
          || (b.pickup || "").toLowerCase().includes(q)
          || (b.drop || "").toLowerCase().includes(q)
        );
        setTotal(matches.length);
        setBookings(matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      } else {
        setBookings(adapted);
        setTotal(response.data?.total || 0);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, page, searchQuery]);

  // Changing filter always jumps back to page 1 — staying on, say, page 3 of "All" when
  // switching to "Cancelled" could land past that filter's own last page.
  const changeFilter = (tab) => {
    setActiveFilter(tab);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const openBooking = (booking) => navigate(`/bookings/${booking.id}`);

  // Exports exactly what's currently on screen (this page, this filter) — real rows, not a
  // separate full-dataset fetch, matching Home.jsx's own Export button.
  const handleExport = () => {
    const rows = [
      ["Booking ID", "Date", "Pickup", "Drop-off", "Truck Type", "Status"],
      ...bookings.map((b) => [bookingRef(b), b.date, b.pickup || "", b.drop || "", b.truckType || "", b.status]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-neutral-800">My Bookings</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Manage and review your fleet transportation schedules.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={bookings.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-neutral-200 rounded-full text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => navigate("/book")}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </div>
      </div>

      {/* Filter Tabs + Search — same row, plain-text tabs on the left, search on the right */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => changeFilter(tab)}
              className={`pb-1 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
                activeFilter === tab
                  ? "text-primary border-primary"
                  : "text-neutral-400 border-transparent hover:text-neutral-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 flex-shrink-0">
          <Search className="w-4 h-4 text-neutral-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Filter by ID or route..."
            className="w-full bg-white border border-neutral-200 rounded-full pl-9 pr-4 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_3px_rgba(25,118,255,0.1)] transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-400">Loading your bookings...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <AlertTriangle className="w-12 h-12 text-danger/40 mb-3" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">Couldn't load bookings</h3>
          <p className="text-sm text-neutral-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={loadBookings}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <Package className="w-14 h-14 text-neutral-200 mb-4" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">No bookings found</h3>
          <p className="text-sm text-neutral-400">No bookings match the selected filter</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100">
                  {["Booking ID", "Date & Time", "Route", "Truck Type", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors duration-100"
                    onClick={() => openBooking(booking)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <ClipboardList className="w-3.5 h-3.5 text-primary" />
                        </span>
                        <p className="text-sm font-mono font-medium text-neutral-700">{bookingRef(booking)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-neutral-700">{booking.date}</p>
                      {booking.scheduledAt && !Number.isNaN(new Date(booking.scheduledAt).getTime()) && (
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {new Date(booking.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 max-w-[280px]">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wide">Origin</p>
                          <p className="text-sm font-semibold text-neutral-700 truncate max-w-[110px]" title={booking.pickup}>{booking.pickup}</p>
                        </div>
                        <RouteIcon className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wide">Destination</p>
                          <p className="text-sm font-semibold text-neutral-700 truncate max-w-[110px]" title={booking.drop}>{booking.drop}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">{booking.truckType}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openBooking(booking);
                        }}
                        className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-primary hover:border-primary/30 hover:bg-primary-50 transition-colors"
                        aria-label="View booking"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100">
              <p className="text-xs text-neutral-400">
                Showing {rangeStart} to {rangeEnd} of {total} results
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      n === page ? "bg-primary text-white" : "text-neutral-500 hover:bg-neutral-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                onClick={() => openBooking(booking)}
                className="bg-white rounded-2xl shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 mr-3">
                    <p className="text-[10px] font-mono text-neutral-400">{bookingRef(booking)}</p>
                    <p className="text-sm font-semibold text-neutral-700 mt-0.5">
                      {booking.pickup} → {booking.drop}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-50">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{booking.truckType}</span>
                    <span>·</span>
                    <span>{booking.date}</span>
                  </div>
                  <span className="font-poppins font-bold text-sm text-neutral-800">
                    ₹{booking.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-neutral-500 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <p className="text-xs text-neutral-400">Page {page} of {totalPages}</p>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-neutral-500 disabled:opacity-30"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
