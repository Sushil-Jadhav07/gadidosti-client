import React from "react";
import { formatBookingStatus } from "../utils";

const STATUS_STYLES = {
  Requested: "bg-neutral-50 text-neutral-400 border border-neutral-100",
  Confirmed: "bg-green-50 text-success border border-green-200",
  Accepted: "bg-primary-50 text-primary border border-primary-100",
  Assigned: "bg-primary-50 text-primary border border-primary-100",
  "En Route": "bg-primary-50 text-primary border border-primary-100",
  "Picked Up": "bg-orange-50 text-warning border border-yellow-200",
  "In Transit": "bg-primary-50 text-primary border border-primary-100",
  Delivered: "bg-green-50 text-success border border-green-200",
  Completed: "bg-green-50 text-success border border-green-200",
  Cancelled: "bg-red-50 text-danger border border-red-200",
};

export default function StatusBadge({ status, className = "" }) {
  const label = formatBookingStatus(status);
  const style = STATUS_STYLES[label] || STATUS_STYLES.Requested;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
