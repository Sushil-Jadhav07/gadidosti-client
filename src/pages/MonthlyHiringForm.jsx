import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Truck, CalendarDays, IndianRupee, FileText, Send } from "lucide-react";
import SelectDropdown from "../components/SelectDropdown";
import DatePicker from "../components/DatePicker";
import { api, getToken } from "../services/api";
import { useToast } from "../context/ToastContext";
import { TRUCK_TYPES } from "../lib/truckTypes";

const TRUCK_CATEGORIES = [{ value: "", label: "Any category" }, ...TRUCK_TYPES.map((t) => ({ value: t.value, label: t.label }))];

const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { location: "", truck_category: "", start_date: "", end_date: "", pricing_type: "fixed", budget_amount: "", description: "" };

// A standalone lead-capture form — deliberately NOT part of the booking wizard. Submitting just
// records an enquiry for the admin team to follow up on manually; nothing here matches it to a
// driver/broker automatically (see gadidosti-backend's monthlyHiring.controller.js). Its own page
// (routed at /monthly-hiring/new) rather than inline on the list, same split as AddressForm.jsx.
export default function MonthlyHiringForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.location.trim()) return toast.error("Please tell us where you need the vehicle");
    if (!form.start_date || !form.end_date) return toast.error("Please select both a start and end date");
    if (new Date(form.end_date) <= new Date(form.start_date)) return toast.error("End date must be after the start date");
    setSubmitting(true);
    try {
      const res = await api.post("/api/monthly-hiring/enquiries", {
        location: form.location.trim(),
        truck_category: form.truck_category || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        pricing_type: form.pricing_type,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : undefined,
        description: form.description.trim() || undefined,
      }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to submit enquiry");
      toast.success("Enquiry submitted — our team will get in touch soon");
      navigate("/monthly-hiring");
    } catch (err) {
      toast.error(err?.message || "Failed to submit enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/monthly-hiring")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-card text-neutral-500 hover:text-neutral-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">New Enquiry</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Tell us what you need — our team will get back to you with options.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5 md:p-8">
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

          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <Truck className="w-3.5 h-3.5" /> Truck Category
            </label>
            <SelectDropdown
              options={TRUCK_CATEGORIES}
              value={form.truck_category}
              onChange={(v) => setForm((f) => ({ ...f, truck_category: v }))}
              placeholder="Any category"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Start Date
            </label>
            <DatePicker
              value={form.start_date}
              min={todayStr()}
              placeholder="Select start date"
              onChange={(v) => setForm((f) => ({ ...f, start_date: v, end_date: f.end_date && f.end_date <= v ? "" : f.end_date }))}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> End Date
            </label>
            <DatePicker
              value={form.end_date}
              min={form.start_date || todayStr()}
              placeholder="Select end date"
              onChange={(v) => setForm((f) => ({ ...f, end_date: v }))}
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

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={() => navigate("/monthly-hiring")}
            className="px-6 py-3 border border-neutral-200 text-neutral-600 rounded-lg text-sm font-semibold hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Enquiry"}
          </button>
        </div>
      </div>
    </div>
  );
}
