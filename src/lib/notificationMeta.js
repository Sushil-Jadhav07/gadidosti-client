import { Truck, Wrench, MessageCircle, Receipt, ShieldAlert, ShieldCheck, Bell } from "lucide-react";

// Groups the backend's notification `type` values (see gadidosti-backend's NotificationModel —
// the only real values it ever writes are booking/incident/chat/payment/dispute/kyc/general)
// into the tabs the Notifications page shows — derived client-side, no backend category column
// exists or is needed for this. Mirrors gadidosti-broker-driver's own lib/notificationMeta.js.
const NOTIFICATION_CATEGORY = {
  booking: "operations",
  incident: "operations",
  chat: "operations",
  payment: "financial",
  dispute: "system",
  kyc: "system",
  general: "system",
};

const NOTIFICATION_META = {
  booking: { Icon: Truck, color: "primary" },
  incident: { Icon: Wrench, color: "warning" },
  chat: { Icon: MessageCircle, color: "primary" },
  payment: { Icon: Receipt, color: "success" },
  dispute: { Icon: ShieldAlert, color: "danger" },
  kyc: { Icon: ShieldCheck, color: "primary" },
  general: { Icon: Bell, color: "slate" },
};

// Fully literal class strings (never string-interpolated) — Tailwind's JIT scanner needs each
// class to appear verbatim in source, so `color` above is just a lookup key into this, not
// spliced into a class name like `bg-${color}-50` (which Tailwind wouldn't generate).
export const COLOR_CLASSES = {
  primary: { icon: "bg-primary-50 text-primary", border: "border-primary" },
  warning: { icon: "bg-warning/10 text-warning", border: "border-warning" },
  success: { icon: "bg-success/10 text-success", border: "border-success" },
  danger: { icon: "bg-danger/10 text-danger", border: "border-danger" },
  slate: { icon: "bg-neutral-100 text-neutral-400", border: "border-neutral-300" },
};

export const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "operations", label: "Operations" },
  { id: "system", label: "System" },
  { id: "financial", label: "Financial" },
];

export const categoryFor = (type) => NOTIFICATION_CATEGORY[type] || "system";
export const metaFor = (type) => NOTIFICATION_META[type] || NOTIFICATION_META.general;
