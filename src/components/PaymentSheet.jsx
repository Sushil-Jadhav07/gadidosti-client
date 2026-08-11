import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Check, Sparkles, Smartphone, CreditCard, Landmark, Wallet, Clock, Phone,
  Delete, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import {
  GooglePayImageLogo, PhonePeLogo, PaytmImageLogo, VisaLogo, MastercardLogo,
  AmazonPayImageLogo, MobikwikLogo, FreechargeLogo, BankLogo, PayPalImageLogo,
} from "./PaymentLogos";

// Simulated checkout — there's no real payment gateway wired up yet, so this mimics a
// Razorpay-style payment sheet (category list -> method detail -> PIN/processing -> success)
// purely for UX/demo purposes. It never talks to a bank or card network; the parent creates
// the booking with payment_status "paid" once onSuccess fires, or "pending" via onPayLater.
const CATEGORIES = [
  { id: "recommended", label: "Recommended", Icon: Sparkles },
  { id: "upi", label: "UPI", Icon: Smartphone },
  { id: "cards", label: "Cards", Icon: CreditCard },
  { id: "netbanking", label: "Netbanking", Icon: Landmark },
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "later", label: "Pay Later", Icon: Clock },
];

const UPI_APPS = [
  { id: "gpay", label: "Google Pay", Logo: GooglePayImageLogo, ring: true },
  { id: "phonepe", label: "PhonePe", Logo: PhonePeLogo },
  { id: "paytm", label: "PayTM", Logo: PaytmImageLogo },
];

const BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Bank", "Other Banks"];
const WALLETS = [
  { id: "paytm", label: "Paytm", Logo: PaytmImageLogo },
  { id: "amazonpay", label: "Amazon Pay", Logo: AmazonPayImageLogo },
  { id: "mobikwik", label: "Mobikwik", Logo: MobikwikLogo },
  { id: "freecharge", label: "Freecharge", Logo: FreechargeLogo },
  { id: "paypal", label: "PayPal", Logo: PayPalImageLogo },
];

const formatCardNumber = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function PaymentSheet({ open, amount, phone, onClose, onSuccess, onPayLater, initialCategory = "recommended" }) {
  const [stage, setStage] = useState("methods"); // methods -> pin -> processing -> success
  const [category, setCategory] = useState(initialCategory);
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [bank, setBank] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage("methods");
    setCategory(initialCategory);
    setUpiId("");
    setCard({ number: "", expiry: "", cvv: "", name: "" });
    setBank(null);
    setWallet(null);
    setPin("");
    setShowPin(false);
  }, [open]);

  useEffect(() => {
    if (stage !== "processing") return;
    const t = setTimeout(() => setStage("success"), 900);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage !== "success") return;
    const t = setTimeout(() => onSuccess(category === "recommended" ? "upi" : category), 1300);
    return () => clearTimeout(t);
  }, [stage, onSuccess]);

  if (!open) return null;

  const amountLabel = `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  const goToPin = () => setStage("pin");
  const goToProcessing = () => setStage("processing");

  const pressDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) setTimeout(() => setStage("processing"), 200);
  };

  const cardValid = card.number.replace(/\D/g, "").length >= 12 && card.expiry.length === 5 && card.cvv.length === 3 && card.name.trim();

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.6)" }}>
      <div className="w-full max-w-3xl h-[600px] max-h-[92vh] bg-white rounded-2xl shadow-modal overflow-hidden flex">
        {/* Left summary panel */}
        {stage === "methods" && (
          <div
            className="hidden md:flex w-64 flex-shrink-0 flex-col text-white p-5"
            style={{ background: "linear-gradient(160deg, #1976FF 0%, #0D3B85 100%)" }}
          >
            <div className="flex items-center gap-2.5 mb-6">
              <img src="/gadidost-logo.png" alt="GadiDost" className="w-8 h-8 rounded-lg bg-white/90 p-1 flex-shrink-0" />
              <span className="font-semibold text-sm">GadiDost Logistics</span>
            </div>

            <div className="bg-white/10 rounded-xl p-4 mb-3">
              <p className="text-[11px] text-white/70 mb-1">Price Summary</p>
              <p className="font-poppins font-bold text-2xl">{amountLabel}</p>
            </div>

            {phone && (
              <div className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                <span className="text-xs text-white/90">Using as +91 {phone}</span>
              </div>
            )}

            <div className="mt-auto flex items-center gap-1.5 text-[11px] text-white/60">
              <ShieldCheck className="w-3.5 h-3.5" /> Secured Checkout (Demo)
            </div>
          </div>
        )}

        {/* Right side */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 flex-shrink-0">
            <p className="font-semibold text-sm text-neutral-800">
              {stage === "methods" ? "Payment Options" : stage === "pin" ? "Enter UPI PIN" : ""}
            </p>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-neutral-100 flex-shrink-0">
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {stage === "methods" && (
            <div className="flex flex-1 min-h-0">
              <div className="w-32 sm:w-40 flex-shrink-0 border-r border-neutral-100 overflow-y-auto bg-neutral-50/60 py-2">
                {CATEGORIES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setCategory(id)}
                    className={`w-full flex items-center gap-2 px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium transition-colors border-l-2 ${
                      category === id
                        ? "border-primary bg-white text-primary"
                        : "border-transparent text-neutral-500 hover:bg-white/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0 overflow-y-auto p-5">
                {(category === "recommended" || category === "upi") && (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Pay via UPI App</p>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {UPI_APPS.map(({ id, label, Logo, ring }) => (
                        <button
                          key={id}
                          onClick={goToPin}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-neutral-100 hover:border-primary transition-all"
                        >
                          <div className={`w-9 h-9 rounded-full overflow-hidden ${ring ? "border border-neutral-200" : ""}`}>
                            <Logo className="w-9 h-9" />
                          </div>
                          <span className="text-[10px] text-neutral-500 text-center leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Or enter UPI ID</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@upi"
                        className="flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary transition-all"
                      />
                      <button
                        onClick={goToPin}
                        disabled={!upiId.trim()}
                        className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        Verify &amp; Pay
                      </button>
                    </div>
                  </div>
                )}

                {category === "cards" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">Add a new card</p>
                      <div className="flex items-center gap-2">
                        <VisaLogo className="h-3.5" />
                        <MastercardLogo className="w-6 h-4" />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={card.number}
                      onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                      placeholder="1234 1234 1234 1234"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-primary transition-all font-mono tracking-wide"
                    />
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={card.expiry}
                        onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                        placeholder="MM/YY"
                        className="w-24 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-primary transition-all font-mono"
                      />
                      <input
                        type="password"
                        value={card.cvv}
                        onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                        placeholder="CVV"
                        className="w-24 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-primary transition-all font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      value={card.name}
                      onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Cardholder name"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-3 text-sm outline-none focus:border-primary transition-all"
                    />
                    <button
                      onClick={goToProcessing}
                      disabled={!cardValid}
                      className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-lg transition-colors"
                    >
                      Pay {amountLabel}
                    </button>
                  </div>
                )}

                {category === "netbanking" && (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Select your bank</p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {BANKS.map((b) => (
                        <button
                          key={b}
                          onClick={() => setBank(b)}
                          className={`px-3 py-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                            bank === b ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-600 hover:border-neutral-200"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={goToProcessing}
                      disabled={!bank}
                      className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-lg transition-colors"
                    >
                      Pay {amountLabel}
                    </button>
                  </div>
                )}

                {category === "wallet" && (
                  <div>
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Select a wallet</p>
                    <div className="space-y-2 mb-5">
                      {WALLETS.map(({ id, label, Logo }) => (
                        <button
                          key={id}
                          onClick={() => setWallet(label)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                            wallet === label ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-600 hover:border-neutral-200"
                          }`}
                        >
                          <Logo className="w-6 h-6 rounded flex-shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={goToProcessing}
                      disabled={!wallet}
                      className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-lg transition-colors"
                    >
                      Pay {amountLabel}
                    </button>
                  </div>
                )}

                {category === "later" && (
                  <div>
                    <div className="bg-neutral-50 rounded-xl p-4 mb-5">
                      <p className="text-sm font-semibold text-neutral-800 mb-1">No payment required now</p>
                      <p className="text-xs text-neutral-500">Your booking will be confirmed and the amount can be settled directly with the driver or broker once delivered.</p>
                    </div>
                    <button
                      onClick={onPayLater}
                      className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-medium py-3 rounded-lg transition-colors"
                    >
                      Confirm Booking — Pay Later
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === "pin" && (
            <div className="flex-1 flex flex-col">
              <div
                className="mx-5 mt-4 rounded-xl px-4 py-3 flex items-center justify-between text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #1565C0 0%, #1976FF 100%)" }}
              >
                <span className="text-sm font-medium tracking-wide">{upiId || "UPI App"}</span>
                <span className="font-poppins font-bold">{amountLabel}</span>
              </div>

              <div className="flex flex-col items-center py-8 flex-1">
                <p className="text-xs text-neutral-400 mb-4">Demo only — any 4 digits work</p>
                <button onClick={() => setShowPin((v) => !v)} className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold uppercase tracking-wide mb-4">
                  {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPin ? "Hide" : "Show"}
                </button>
                <div className="flex items-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white ${
                      i < pin.length ? "bg-primary border-primary" : "border-neutral-300"
                    }`}>
                      {showPin && i < pin.length ? pin[i] : ""}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-neutral-100 border-t border-neutral-100 flex-shrink-0">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) => (
                  <button
                    key={i}
                    disabled={key === ""}
                    onClick={() => (key === "del" ? setPin((p) => p.slice(0, -1)) : key && pressDigit(key))}
                    className="bg-white py-4 flex items-center justify-center text-lg font-semibold text-neutral-700 hover:bg-neutral-50 disabled:bg-white transition-colors"
                  >
                    {key === "del" ? <Delete className="w-4 h-4 text-neutral-400" /> : key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(stage === "processing" || stage === "success") && (
            <div className="flex-1 flex flex-col items-center justify-center">
              {stage === "processing" ? (
                <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-5" />
              ) : (
                <div className="animate-bounce-in w-16 h-16 rounded-full bg-success flex items-center justify-center mb-5 shadow-glow-green">
                  <Check className="w-8 h-8 text-white" strokeWidth={3} />
                </div>
              )}
              <p className="font-poppins font-semibold text-lg text-neutral-800">
                {stage === "processing" ? "Processing payment..." : "Payment successful"}
              </p>
              {stage === "success" && <p className="text-sm text-neutral-400 mt-1">{amountLabel} paid</p>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
