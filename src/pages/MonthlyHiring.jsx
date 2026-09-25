import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Plus, MapPin } from "lucide-react";
import { api, getToken } from "../services/api";

const STATUS_LABEL = { open: "Open", contacted: "Contacted", closed: "Closed" };
const STATUS_CLASS = {
  open: "bg-primary-50 text-primary",
  contacted: "bg-amber-50 text-warning",
  closed: "bg-neutral-100 text-neutral-500",
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// The list view — the actual enquiry form now lives on its own page (see MonthlyHiringForm.jsx,
// routed at /monthly-hiring/new), same list-page/add-page split as SavedAddresses.jsx.
export default function MonthlyHiring() {
  const navigate = useNavigate();
  const token = getToken();

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/monthly-hiring/enquiries/mine", token);
      if (!res?.success) throw new Error(res?.message);
      setEnquiries(res.data?.enquiries || []);
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

  const openNew = () => navigate("/monthly-hiring/new");

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5 text-primary" />
          </span>
          <div>
            <h1 className="font-poppins font-bold text-2xl md:text-[28px] text-neutral-800">Monthly Vehicle Hiring</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Need a truck on a monthly basis? Raise an enquiry and our team will get in touch.</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg border border-primary
          hover:bg-white hover:text-primary hover:ring-1 hover:ring-primary
          transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New Enquiry
        </button>
      </div>

      <h2 className="font-poppins font-semibold text-lg text-neutral-800 mt-8 mb-3">My Enquiries</h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 skeleton-shimmer animate-shimmer rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-neutral-400 mb-3">Couldn't load your enquiries</p>
          <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : enquiries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-poppins font-semibold text-neutral-800 mb-1">You haven't raised any enquiries yet</h3>
          <p className="text-sm text-neutral-400 mb-5">Tell us where and for how long you need a truck, and our team will follow up.</p>
          <button onClick={openNew} className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
            Raise Your First Enquiry
          </button>
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
