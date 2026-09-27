import { useState } from "react";
import { useToast } from "../context/ToastContext";

// Asks for a reason before rejecting a driver's proof-of-delivery photos — shared by
// BookingDetail.jsx and TrackShipment.jsx, since both surface the same POD approve/reject flow.
export default function RejectPodSheet({ onSubmit, onCancel }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please tell the driver what's wrong with the photos");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      toast.error(err?.message || "Failed to reject proof of delivery");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Reject proof of delivery?</h3>
      <p className="text-sm text-neutral-400 mb-5">The driver will be asked to upload new photos before the trip can be completed.</p>

      <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Reason for rejecting</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Photos are blurry/too dark, doesn't show the delivered cargo..."
        maxLength={500}
        rows={4}
        className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
      />

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-2.5 bg-danger text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
