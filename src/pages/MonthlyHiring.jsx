import React, { useEffect, useState } from "react";
import { CalendarClock, MapPin, Truck, IndianRupee, FileText, Send } from "lucide-react";
import { api, getToken } from "../services/api";
import { useToast } from "../context/ToastContext";

const TRUCK_CATEGORIES = [
  { value: "", label: "Any category" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "part", label: "Part Load" },
];

const STATUS_LABEL = { open: "Open", contacted: "Contacted", closed: "Closed" };
const STATUS_CLASS = {
  open: "bg-primary-50 text-primary",
  contacted: "bg-amber-50 text-warning",
  closed: "bg-neutral-100 text-neutral-500",
};

const EMPTY_FORM = { location: "", truck_category: "", duration_months: "", pricing_type: "fixed", budget_amount: "", description: "" };

const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// A standalone lead-capture form — deliberately NOT part of the booking wizard. Submitting just
// records an enquiry for the admin team to follow up on manually; nothing here matches it to a
// driver/broker automatically (see gadidosti-backend's monthlyHiring.controller.js).
export default function MonthlyHiring() {
  const toast = useToast();
  const token = getToken();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEnquiries = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/monthly-hiring/enquiries/mine", token);
      if (res?.success) setEnquiries(res.data?.enquiries || []);
    } catch {
      /* list just stays empty on failure — the form above still works */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!form.location.trim()) return toast.error("Please tell us where you need the vehicle");
    setSubmitting(true);
    try {
      const res = await api.post("/api/monthly-hiring/enquiries", {
        location: form.location.trim(),
        truck_category: form.truck_category || undefined,
        duration_months: form.duration_months ? Number(form.duration_months) : undefined,
        pricing_type: form.pricing_type,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : undefined,
        description: form.description.trim() || undefined,
      }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to submit enquiry");
      toast.success("Enquiry submitted — our team will get in touch soon");
      setForm(EMPTY_FORM);
      loadEnquiries();
    } catch (err) {
      toast.error(err?.message || "Failed to submit enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" />
        </span>
        <div>
          <h1 className="font-poppins font-bold text-2xl md:text-[28px] text-neutral-800">Monthly Vehicle Hiring</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Need a truck on a monthly basis? Raise an enquiry and our team will get in touch.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5 md:p-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location / Route
            </label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Pune, or Pune to Mumbai corridor"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <Truck className="w-3.5 h-3.5" /> Truck Category
            </label>
            <select
              value={form.truck_category}
              onChange={(e) => setForm((f) => ({ ...f, truck_category: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {TRUCK_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-500 mb-1.5 block">Duration (months)</label>
            <input
              type="number"
              min="1"
              value={form.duration_months}
              onChange={(e) => setForm((f) => ({ ...f, duration_months: e.target.value }))}
              placeholder="e.g. 3"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-neutral-500 mb-1.5 block">Pricing Preference</label>
            <div className="flex gap-2">
              {[{ value: "fixed", label: "Fixed Rate" }, { value: "per_km", label: "Per KM Rate" }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, pricing_type: opt.value }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.pricing_type === opt.value ? "bg-primary text-white border-primary" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <IndianRupee className="w-3.5 h-3.5" /> {form.pricing_type === "per_km" ? "Budget (₹ per km)" : "Monthly Budget (₹)"} <span className="text-neutral-300 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              value={form.budget_amount}
              onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))}
              placeholder="Your expected budget"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <FileText className="w-3.5 h-3.5" /> Additional Details <span className="text-neutral-300 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Anything else that would help — cargo type, expected daily runs, etc."
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-5 w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Enquiry"}
        </button>
      </div>

      <h2 className="font-poppins font-semibold text-lg text-neutral-800 mt-8 mb-3">My Enquiries</h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 skeleton-shimmer animate-shimmer rounded-xl" />)}
        </div>
      ) : enquiries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-neutral-400">You haven't raised any monthly hiring enquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{e.location}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {e.truckCategory ? `${e.truckCategory.charAt(0).toUpperCase()}${e.truckCategory.slice(1)} truck · ` : ""}
                    {e.durationMonths ? `${e.durationMonths} month${e.durationMonths === 1 ? "" : "s"} · ` : ""}
                    {e.pricingType === "per_km" ? "Per KM" : "Fixed Rate"}
                    {e.budgetAmount != null ? ` · ₹${e.budgetAmount.toLocaleString("en-IN")}` : ""}
                  </p>
                  {e.description && <p className="text-xs text-neutral-400 mt-1.5">{e.description}</p>}
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_CLASS[e.status] || STATUS_CLASS.open}`}>
                  {STATUS_LABEL[e.status] || e.status}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 mt-2">Submitted {fmtDate(e.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
