import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { api } from "../../services/api";

// Public, unauthenticated — reachable from app-store listing requirements (Privacy Policy,
// Terms, Account Deletion, etc.) without needing an account. No WebLayout/sidebar chrome, same
// reasoning as PublicTracking.jsx: whoever lands here may not have — or need — one at all.
const AUDIENCE = "client";

const LEGAL_NAV = [
  { key: "privacy_policy", label: "Privacy Policy" },
  { key: "terms_conditions", label: "Terms & Conditions" },
  { key: "account_deletion", label: "Account Deletion" },
  { key: "contact_support", label: "Contact / Support" },
  { key: "refund_policy", label: "Cancellation & Refund" },
  { key: "safety_policy", label: "Safety Policy" },
];

function AccountDeletionForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok: boolean, message: string }

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setResult({ ok: false, message: "Please provide an email or phone number so we can follow up." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post(`/api/legal-pages/${AUDIENCE}/account-deletion-request`, {
        name: form.name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        reason: form.reason.trim() || undefined,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to submit request");
      setResult({ ok: true, message: res.message || "Your request has been received." });
      setForm({ name: "", email: "", phone: "", reason: "" });
    } catch (err) {
      setResult({ ok: false, message: err?.message || "Failed to submit request. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-5 md:p-6 mt-6 space-y-4">
      <h2 className="font-poppins font-bold text-lg text-neutral-800">Request Account Deletion</h2>
      <p className="text-sm text-neutral-500">
        Fill this out and our team will follow up to verify and complete your request.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit number"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)]"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Reason (optional)</label>
        <textarea
          value={form.reason}
          onChange={(e) => update("reason", e.target.value.slice(0, 2000))}
          rows={3}
          className="w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700 outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(22,101,52,0.1)]"
        />
      </div>

      {result && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm ${result.ok ? "bg-green-50 text-success" : "bg-red-50 text-danger"}`}>
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
      >
        <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Request"}
      </button>
    </form>
  );
}

export default function LegalPage() {
  const { pageKey } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.get(`/api/legal-pages/${AUDIENCE}/${pageKey}`)
      .then((res) => {
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.message);
        setPage(res.data?.page || null);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageKey]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <Link to="/legal" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-primary transition-colors mb-5">
          <ArrowLeft className="w-4 h-4" /> All Legal Pages
        </Link>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-card p-10 flex items-center justify-center">
            <span className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error || !page ? (
          <div className="bg-white rounded-2xl shadow-card p-10 text-center">
            <FileText className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-500">Couldn't load this page. Please try again later.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-card p-5 md:p-8">
              <h1 className="font-poppins font-bold text-2xl text-neutral-800 mb-4">{page.title}</h1>
              {page.content?.trim() ? (
                <div
                  className="text-sm text-neutral-700 leading-relaxed [&_h2]:text-lg [&_h2]:font-poppins [&_h2]:font-semibold [&_h2]:text-neutral-800 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:first:mt-0 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: page.content }}
                />
              ) : (
                <p className="text-sm text-neutral-400 italic">Content coming soon.</p>
              )}
            </div>

            {pageKey === "account_deletion" && <AccountDeletionForm />}
          </>
        )}

        <div className="flex flex-wrap gap-2 mt-6">
          {LEGAL_NAV.filter((item) => item.key !== pageKey).map((item) => (
            <Link
              key={item.key}
              to={`/legal/${item.key}`}
              className="text-xs font-medium text-neutral-500 hover:text-primary bg-white border border-neutral-200 rounded-full px-3 py-1.5 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
