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
    amount: Number(booking.amount || 0),
    distance: Number(booking.distance || 0),
    weight: Number(booking.weight || 0),
  };
};
