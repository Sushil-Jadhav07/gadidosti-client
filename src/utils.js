export const TIMELINE_STEPS = [
  "Requested",
  "Confirmed",
  "Assigned",
  "En Route",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Completed",
];

const STATUS_LABELS = {
  pending: "Requested",
  confirmed: "Confirmed",
  assigned: "Assigned",
  en_route_pickup: "En Route",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS = {
  paid: "Paid",
  pending: "Pending",
  refunded: "Refunded",
};

export const formatBookingStatus = (status) => STATUS_LABELS[status] || status || "Requested";
export const formatPaymentStatus = (status) => PAYMENT_LABELS[status] || status || "Pending";

// Shortens a UUID for display (e.g. "80000000-0000-0000-0000-000000000003" -> "#00000003").
// Only used as a fallback for records that predate the booking_number column.
const shortId = (id) => (id ? `#${String(id).replace(/-/g, "").slice(-8).toUpperCase()}` : "-");

// Prefers the real "BKG-202412-003" style reference the backend generates; falls back to a
// shortened UUID for any older record that doesn't have one yet.
export const bookingRef = (booking) => (booking && (booking.bookingNumber || shortId(booking.id))) || "-";

export const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Bridges a booking to its in-flight direct-driver request (POST /api/bookings/:id/request-truck).
// There's no backend endpoint to look up "the driver request for booking X" as a client (only
// GET /api/driver-requests/:id by the request's own id, or driver/broker-scoped list endpoints) —
// so the id is stashed here the moment BookTruck.jsx creates it, and MyBookings.jsx reads it back
// to resume polling/negotiating if the user navigates away and returns via the bookings list.
const driverRequestStorageKey = (bookingId) => `ssk_driver_request_${bookingId}`;

export const getStoredDriverRequestId = (bookingId) => {
  if (!bookingId) return null;
  try { return localStorage.getItem(driverRequestStorageKey(bookingId)); } catch { return null; }
};

export const setStoredDriverRequestId = (bookingId, requestId) => {
  if (!bookingId || !requestId) return;
  try { localStorage.setItem(driverRequestStorageKey(bookingId), requestId); } catch { /* ignore */ }
};

export const clearStoredDriverRequestId = (bookingId) => {
  if (!bookingId) return;
  try { localStorage.removeItem(driverRequestStorageKey(bookingId)); } catch { /* ignore */ }
};

// Lets BookTruck.jsx survive a page reload once past Step 4 (the booking already exists by
// then, so restarting the whole wizard on reload — as it did before — would strand the client
// mid-negotiation with no way back to that screen short of finding the booking in "My
// Bookings" and it not actually resuming the negotiation view). sessionStorage (not
// localStorage) is deliberate — this should only survive a reload of the same tab/session, not
// linger indefinitely across days once the booking is long since resolved one way or another.
const BOOKING_WIZARD_STORAGE_KEY = "ssk_booking_wizard";

export const getStoredBookingWizardState = () => {
  try {
    const raw = sessionStorage.getItem(BOOKING_WIZARD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setStoredBookingWizardState = (bookingId, step) => {
  if (!bookingId) return;
  try { sessionStorage.setItem(BOOKING_WIZARD_STORAGE_KEY, JSON.stringify({ bookingId, step })); } catch { /* ignore */ }
};

export const clearStoredBookingWizardState = () => {
  try { sessionStorage.removeItem(BOOKING_WIZARD_STORAGE_KEY); } catch { /* ignore */ }
};

// Holds this device's current FCM push token (see src/lib/firebase.js and
// usePushNotifications) so AuthContext's logout() can unregister it (DELETE
// /api/users/device-token) without the hook and the auth context needing to know about
// each other directly.
const FCM_TOKEN_STORAGE_KEY = "ssk_fcm_token";

export const getStoredFcmToken = () => {
  try { return localStorage.getItem(FCM_TOKEN_STORAGE_KEY); } catch { return null; }
};

export const setStoredFcmToken = (token) => {
  if (!token) return;
  try { localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token); } catch { /* ignore */ }
};

export const clearStoredFcmToken = () => {
  try { localStorage.removeItem(FCM_TOKEN_STORAGE_KEY); } catch { /* ignore */ }
};

// Straight-line distance between two coordinates (Haversine formula), in km, scaled by a
// standard road-distance correction factor since real roads are never perfectly straight.
// Used in BookTruck.jsx as a client-side distance estimate whenever pickup/drop coordinates
// are already known (from the address autocomplete selection) — bypasses the backend's
// POST /api/config/distance, whose LOCATION_PROVIDER=fake stub only recognizes a short
// hardcoded list of city-name pairs (no entry at all for two points in the same city) and
// 404s on most real addresses.
const EARTH_RADIUS_KM = 6371;
const ROAD_DISTANCE_FACTOR = 1.3;

export const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const straightLineKm = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(straightLineKm * ROAD_DISTANCE_FACTOR * 10) / 10;
};

// Shares a PDF via the browser's native share sheet (attaches the actual file on phones where
// WhatsApp/etc. are registered share targets); falls back to a wa.me text-only link on desktop
// or browsers without file-sharing support. No backend WhatsApp API involved.
export const shareInvoicePdf = async ({ blob, filename, text }) => {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Invoice", text });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
};

export const adaptBooking = (booking) => {
  if (!booking) return null;
  const timeline = Array.isArray(booking.timeline) ? booking.timeline.map(formatBookingStatus) : [];
  const currentLabel = formatBookingStatus(booking.status);
  const currentStep = Math.max(
    timeline.findIndex((step) => step === currentLabel),
    TIMELINE_STEPS.findIndex((step) => step === currentLabel),
    0
  );

  return {
    ...booking,
    status: currentLabel,
    paymentStatus: formatPaymentStatus(booking.paymentStatus),
    timeline: timeline.length ? timeline : [currentLabel],
    currentStep,
    date: formatDate(booking.date || booking.createdAt),
    // The raw ISO instant, kept alongside the display-formatted `date` above (which drops
    // time-of-day) — for anything that needs to show/compare an actual time, not just a date.
    scheduledAt: booking.date || booking.createdAt || null,
    amount: Number(booking.amount || 0),
    distance: Number(booking.distance || 0),
    weight: Number(booking.weight || 0),
  };
};
