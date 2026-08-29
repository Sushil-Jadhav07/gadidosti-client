import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Star, Trash2, AlertCircle, Smartphone, CreditCard, Landmark,
  Lock, ShieldCheck, HelpCircle, User,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { detectCardBrand, formatCardNumber } from "../lib/cardBrand";
import {
  VisaLogo, MastercardLogo, AmexLogo, DiscoverLogo, JcbLogo, RupayLogo, GenericCardLogo, BankLogo,
} from "../components/PaymentLogos";
import { INDIAN_BANKS, bankIconUrl } from "../lib/indianBanks";

// Same 3 categories the "Add Payment Method" reference design uses — Card / UPI / Bank. Live
// card-brand detection uses the `credit-card-type` library (npm) plus a small RuPay-specific
// supplement (see lib/cardBrand.js — the library doesn't know about RuPay at all).
const TYPES = [
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "upi", label: "UPI", Icon: Smartphone },
  { id: "netbanking", label: "Bank", Icon: Landmark },
];

// All 33 RBI-scheduled public/private sector banks, real logos — see lib/indianBanks.js for
// where this data actually comes from (extracted from the banks-in-india npm package, which
// isn't kept as a live dependency — its own package.json declares astro + @astrojs/netlify +
// an unrelated @new-ui/foundations package as runtime `dependencies` for what's really just a
// JSON+icon data file, which pulled in 699 packages and 6 high-severity advisories that have
// nothing to do with anything this app runs. The data itself is genuinely good and real, so it
// was extracted once into a local file + copied icons instead of carrying that dependency tree.)
const BANKS = INDIAN_BANKS;

// Keyed by credit-card-type's `type` (+ our own "rupay") — falls back to a plain generic mark
// for anything neither source recognizes (diners-club, jcb variants not listed, etc. still get
// a card-shaped icon rather than nothing).
const CARD_BRAND_LOGOS = {
  visa: VisaLogo,
  mastercard: MastercardLogo,
  "american-express": AmexLogo,
  discover: DiscoverLogo,
  jcb: JcbLogo,
  rupay: RupayLogo,
};
const cardBrandLogo = (brand) => CARD_BRAND_LOGOS[brand] || GenericCardLogo;

const TYPE_ICON = { upi: Smartphone, card: CreditCard, netbanking: Landmark };

const EMPTY_FORM = {
  methodType: "card",
  cardNumber: "", cardExpiry: "", cardCvv: "", cardholderName: "",
  upiId: "", upiNickname: "",
  bank: BANKS[0].name, accountNumber: "", ifsc: "",
  note: "",
  setDefault: false,
};

const formatExpiry = (v) => {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

// Standard IFSC shape: 4-letter bank code, a literal 0, 6 alphanumeric branch chars.
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Only ever collects/stores non-sensitive display data — a UPI ID, a card's last 4 digits +
// detected brand + expiry, a bank name. Never a full card number or CVV/PIN — there's no real
// gateway behind this yet, but the fields here are shaped the same way a real one's tokenized
// "saved card" reference would be, not a raw card capture form. The CVV field below exists only
// for a realistic add-card flow and is read into local state alone — it's never part of the
// payload sent to the backend (see handleSave: `details` never references cardCvv).
export default function PaymentMethods() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bankSearch, setBankSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const detectedBrand = useMemo(() => detectCardBrand(form.cardNumber), [form.cardNumber]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/payment-methods", token);
      if (!res?.success) throw new Error(res?.message);
      setMethods(res.data?.paymentMethods || []);
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

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setBankSearch("");
    setShowSheet(true);
  };

  const handleSave = async () => {
    setFormError("");
    let label, details;

    if (form.methodType === "card") {
      const digits = form.cardNumber.replace(/\D/g, "");
      const last4 = digits.slice(-4);
      if (last4.length !== 4) return setFormError("Enter a valid card number");
      if (!/^\d{2}\/\d{2}$/.test(form.cardExpiry)) return setFormError("Enter the expiry as MM/YY");
      if (!form.cardholderName.trim()) return setFormError("Enter the cardholder's name");
      const brand = detectedBrand?.type || "unknown";
      const niceType = detectedBrand?.niceType || "Card";
      label = `${niceType} ending in ${last4}`;
      details = { brand, last4, expiry: form.cardExpiry, cardholderName: form.cardholderName.trim() };
    } else if (form.methodType === "upi") {
      if (!/^[\w.-]+@[\w.-]+$/.test(form.upiId.trim())) return setFormError("Enter a valid UPI ID, e.g. name@okhdfc");
      const nickname = form.upiNickname.trim();
      label = nickname ? `${nickname} (UPI)` : form.upiId.trim();
      details = { upi_id: form.upiId.trim(), nickname: nickname || undefined };
    } else {
      const acct = form.accountNumber.replace(/\D/g, "");
      if (acct.length < 9 || acct.length > 18) return setFormError("Enter a valid account number");
      const ifsc = form.ifsc.trim().toUpperCase();
      if (!IFSC_PATTERN.test(ifsc)) return setFormError("Enter a valid IFSC code, e.g. HDFC0001234");
      label = form.bank;
      details = { bank: form.bank, ifsc, account_last4: acct.slice(-4), account_number: acct };
    }
    if (form.note.trim()) details.note = form.note.trim();

    setSaving(true);
    try {
      const res = await api.post("/api/payment-methods", { method_type: form.methodType, label, details }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to save payment method");
      let saved = res.data.paymentMethod;

      // The create endpoint has no is_default field of its own — "Set as default" is a real
      // checkbox, just composed from create + the existing PATCH .../default call.
      if (form.setDefault && !saved.isDefault) {
        try {
          const defaultRes = await api.patch(`/api/payment-methods/${saved.id}/default`, {}, token);
          if (defaultRes?.success && defaultRes.data?.paymentMethod) saved = defaultRes.data.paymentMethod;
        } catch { /* saved fine either way — just didn't become default */ }
      }

      setMethods((current) => [saved, ...current.map((m) => (form.setDefault ? { ...m, isDefault: false } : m))]);
      toast.success("Payment method saved");
      setShowSheet(false);
    } catch (err) {
      setFormError(err.message || "Failed to save payment method");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      const res = await api.patch(`/api/payment-methods/${id}/default`, {}, token);
      if (!res?.success) throw new Error(res?.message);
      setMethods((current) => current.map((m) => ({ ...m, isDefault: m.id === id })));
    } catch (err) {
      toast.error(err.message || "Failed to set default");
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await api.delete(`/api/payment-methods/${id}`, null, token);
      if (!res?.success) throw new Error(res?.message);
      await load();
      toast.success("Payment method removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove payment method");
    } finally {
      setDeletingId(null);
    }
  };

  const renderCardFace = (m) => {
    const Logo = cardBrandLogo(m.details?.brand);
    return (
      <>
        <div className="flex items-start justify-between mb-3">
          <Logo className="h-5" />
          {m.isDefault && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">DEFAULT</span>}
        </div>
        <h3 className="font-poppins font-semibold text-[15px] text-neutral-800 leading-snug">{m.label}</h3>
        {m.details?.expiry && <p className="text-xs text-neutral-400 mt-0.5">Expires {m.details.expiry}</p>}
      </>
    );
  };

  const renderOtherFace = (m) => {
    const Icon = TYPE_ICON[m.methodType] || CreditCard;
    const bank = m.methodType === "netbanking" ? BANKS.find((b) => b.name === m.label) : null;
    return (
      <>
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center overflow-hidden">
            {bank ? (
              <img src={bankIconUrl(bank.icon)} alt={bank.name} className="w-full h-full object-contain p-1" />
            ) : m.methodType === "netbanking" ? (
              <BankLogo className="w-5 h-5" />
            ) : (
              <Icon className="w-4 h-4 text-primary" />
            )}
          </div>
          {m.isDefault && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">DEFAULT</span>}
        </div>
        <h3 className="font-poppins font-semibold text-[15px] text-neutral-800 leading-snug">{m.label}</h3>
        {m.details?.upi_id && m.details?.nickname && <p className="text-xs text-neutral-400 mt-0.5">{m.details.upi_id}</p>}
        {m.details?.account_last4 && (
          <p className="text-xs text-neutral-400 mt-0.5">Account •••• {m.details.account_last4}{m.details.ifsc ? ` · ${m.details.ifsc}` : ""}</p>
        )}
      </>
    );
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-poppins font-bold text-2xl md:text-[28px] text-neutral-800">Payment Methods</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Manage your saved cards and payment options for billing.</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New Payment Method
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 skeleton-shimmer animate-shimmer rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-neutral-400 mb-3">Couldn't load your payment methods</p>
          <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : methods.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-poppins font-semibold text-neutral-800 mb-1">No saved payment methods yet</h3>
          <p className="text-sm text-neutral-400 mb-5">Save a card, UPI ID, or bank so checkout remembers it next time.</p>
          <button onClick={openAdd} className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
            Add Your First Method
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {methods.map((m) => (
            <div key={m.id} className="group relative bg-white rounded-2xl shadow-card border border-neutral-100 p-4 hover:shadow-card-hover transition-shadow">
              {m.methodType === "card" ? renderCardFace(m) : renderOtherFace(m)}

              {m.details?.note && (
                <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-neutral-50">{m.details.note}</p>
              )}

              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 bg-white/95 rounded-lg shadow-card transition-opacity">
                {!m.isDefault && (
                  <button
                    onClick={() => handleSetDefault(m.id)}
                    title="Set as default"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-primary hover:bg-primary-50 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  title="Remove"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-danger hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={openAdd}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-center p-4 min-h-[144px] hover:border-primary hover:bg-primary-50/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-primary">Add Payment Method</p>
            <p className="text-xs text-neutral-400">Credit, Debit, or Bank Transfer</p>
          </button>
        </div>
      )}

      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)}>
        <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-5">Add Payment Method</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setForm((f) => ({ ...f, methodType: id }))}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                  form.methodType === id ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-500 hover:border-neutral-200"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {form.methodType === "card" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Card Number</label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <CreditCard className="w-4 h-4 text-neutral-300 mr-2.5 flex-shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cardNumber}
                    onChange={(e) => setForm((f) => ({ ...f, cardNumber: formatCardNumber(e.target.value) }))}
                    placeholder="0000 0000 0000 0000"
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 font-mono tracking-wide"
                  />
                  {detectedBrand && (
                    <span className="flex-shrink-0 ml-2" title={detectedBrand.niceType}>
                      {(() => { const Logo = cardBrandLogo(detectedBrand.type); return <Logo className="h-4" />; })()}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Expiry Date</label>
                  <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.cardExpiry}
                      onChange={(e) => setForm((f) => ({ ...f, cardExpiry: formatExpiry(e.target.value) }))}
                      placeholder="MM/YY"
                      className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                    CVV
                    <HelpCircle className="w-3 h-3 text-neutral-300" title="Never stored — only used to verify the card in a real checkout, which this demo doesn't run against yet." />
                  </label>
                  <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                    <input
                      type="password"
                      inputMode="numeric"
                      value={form.cardCvv}
                      onChange={(e) => setForm((f) => ({ ...f, cardCvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      placeholder="123"
                      className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Cardholder Name</label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <User className="w-4 h-4 text-neutral-300 mr-2.5 flex-shrink-0" />
                  <input
                    type="text"
                    value={form.cardholderName}
                    onChange={(e) => setForm((f) => ({ ...f, cardholderName: e.target.value }))}
                    placeholder="J. Doe"
                    className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                </div>
              </div>
            </>
          )}

          {form.methodType === "upi" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                  Display Name <span className="text-neutral-300 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <input
                    type="text"
                    value={form.upiNickname}
                    onChange={(e) => setForm((f) => ({ ...f, upiNickname: e.target.value }))}
                    placeholder="e.g. Google Pay, Work UPI"
                    className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">UPI ID</label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <Smartphone className="w-4 h-4 text-neutral-300 mr-2.5 flex-shrink-0" />
                  <input
                    type="text"
                    value={form.upiId}
                    onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                    placeholder="yourname@upi"
                    className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                </div>
              </div>
            </>
          )}

          {form.methodType === "netbanking" && (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Bank</label>
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Search 33 banks..."
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-2.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary transition-all mb-2"
              />
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {BANKS.filter((b) => b.name.toLowerCase().includes(bankSearch.trim().toLowerCase())).map(({ name, icon }) => (
                  <button
                    key={name}
                    onClick={() => setForm((f) => ({ ...f, bank: name }))}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                      form.bank === name ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-600 hover:border-neutral-200"
                    }`}
                  >
                    <img src={bankIconUrl(icon)} alt={name} className="w-6 h-6 flex-shrink-0 object-contain" />
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>

              {/* Once a bank is picked, this is what actually identifies the account to pay
                  into — account number + IFSC only ever enable a deposit, not a withdrawal
                  (unlike a card's PAN+CVV), so unlike the card form above, the full account
                  number is stored, not just its last 4 digits (needed either way to actually
                  identify which account this is — the list view still only ever displays the
                  masked last 4, see renderOtherFace below). */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Account Number</label>
                  <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.accountNumber}
                      onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) }))}
                      placeholder="e.g. 123456789012"
                      className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">IFSC Code</label>
                  <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                    <input
                      type="text"
                      value={form.ifsc}
                      onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase().slice(0, 11) }))}
                      placeholder="e.g. HDFC0001234"
                      className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
              Note <span className="text-neutral-300 font-normal normal-case">(optional)</span>
            </label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Corporate Account, Backup Funding"
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                maxLength={60}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.setDefault}
              onChange={(e) => setForm((f) => ({ ...f, setDefault: e.target.checked }))}
              className="w-4 h-4 rounded border-neutral-300 text-primary focus:ring-primary/30"
            />
            <span className="text-sm text-neutral-600">Set as default payment method</span>
          </label>

          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : (
              <><Lock className="w-4 h-4" />Securely Add Method</>
            )}
          </button>

          {/* An honest reassurance line, not a compliance badge — this app doesn't have a real
              PCI-scoped card gateway behind it yet, so it would be wrong to display "PCI-DSS
              Compliant"/"256-bit Encryption" badges the way a checkout page with a real
              processor could. What's actually true: the card number and CVV above never leave
              this form — only the brand, last 4 digits, and expiry get saved. */}
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-success flex-shrink-0" />
            We only store display details like your card's last 4 digits — never your full number or CVV.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}
