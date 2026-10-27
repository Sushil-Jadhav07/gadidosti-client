import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Wallet as WalletIcon, Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw,
  IndianRupee, Sparkles,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import PaymentSheet from "../components/PaymentSheet";

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

const TXN_META = {
  recharge: { label: "Recharge", Icon: ArrowDownCircle, className: "text-success bg-success/10" },
  booking_payment: { label: "Booking Payment", Icon: ArrowUpCircle, className: "text-danger bg-danger/10" },
  refund: { label: "Refund", Icon: RotateCcw, className: "text-primary bg-primary/10" },
};

const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// Buckets real transactions into Today/Yesterday/older date groups — purely a presentation
// grouping over data already returned by GET /api/wallet/transactions, nothing fabricated.
const groupByDate = (transactions) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = [];
  const indexByKey = {};
  transactions.forEach((t) => {
    const d = new Date(t.created_at);
    const dayKey = d.toDateString();
    const label = dayKey === today ? "Today" : dayKey === yesterday ? "Yesterday"
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (!(label in indexByKey)) {
      indexByKey[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[indexByKey[label]].items.push(t);
  });
  return groups;
};

export default function Wallet() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [balRes, txnRes] = await Promise.all([
        api.get("/api/wallet", token),
        api.get("/api/wallet/transactions", token),
      ]);
      if (!balRes?.success || !txnRes?.success) throw new Error();
      setBalance(Number(balRes.data.balance));
      setTransactions(txnRes.data.transactions || []);
    } catch {
      setError(true);
      toast.error("Could not load your wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const orderBody = useMemo(() => ({ amount: Number(rechargeAmount) }), [rechargeAmount]);
  const groupedTransactions = useMemo(() => groupByDate(transactions), [transactions]);
  const lastRecharge = useMemo(() => transactions.find((t) => t.type === "recharge"), [transactions]);

  const handleRechargeSuccess = (data) => {
    setShowRecharge(false);
    setBalance(Number(data?.balance ?? balance));
    toast.success("Wallet recharged successfully");
    load();
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-[430px] w-full md:max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-poppins font-bold text-2xl text-neutral-800">Wallet</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Recharge and pay for bookings from your balance.</p>
        </div>
      </div>

      {/* Balance card — a soft radial glow + an oversized, barely-visible wallet glyph give it
          some depth instead of a flat gradient fill, same "hero card" treatment as Login/
          Register's gradient panel, scaled down for a single compact card. */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 mb-5 text-white shadow-card-hover"
        style={{ background: "linear-gradient(155deg, #166534 0%, #14532D 65%, #0f3d22 100%)" }}
      >
        <WalletIcon className="absolute -right-6 -bottom-8 w-40 h-40 text-white/[0.07] rotate-[-12deg] pointer-events-none" strokeWidth={1} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2 text-white/70">
            <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <WalletIcon className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">Available Balance</span>
          </div>
          <p className="font-poppins font-bold text-4xl mb-1 tabular-nums">
            {loading ? (
              <span className="inline-block h-9 w-32 bg-white/15 rounded-lg animate-pulse align-middle" />
            ) : (
              `₹${(balance ?? 0).toLocaleString("en-IN")}`
            )}
          </p>
          {!loading && lastRecharge && (
            <p className="text-xs text-white/50 mb-5">
              Last recharged {new Date(lastRecharge.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          )}
          {!loading && !lastRecharge && <div className="mb-5" />}
          <button
            onClick={() => setShowRecharge(true)}
            className="flex items-center gap-2 bg-white text-primary font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" /> Recharge Wallet
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-poppins font-semibold text-sm text-neutral-800">Transaction History</h3>
          {!loading && transactions.length > 0 && (
            <span className="text-[11px] font-medium text-neutral-400">{transactions.length} total</span>
          )}
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-100 animate-pulse flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-neutral-100 rounded animate-pulse" />
                </div>
                <div className="h-3.5 w-14 bg-neutral-100 rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-neutral-400 mb-3">Couldn't load your transaction history</p>
            <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Retry</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-poppins font-semibold text-sm text-neutral-800 mb-1">No transactions yet</h4>
            <p className="text-xs text-neutral-400">Recharge your wallet to start paying for bookings instantly.</p>
          </div>
        ) : (
          <div>
            {groupedTransactions.map((group) => (
              <div key={group.label}>
                <p className="px-5 pt-4 pb-1.5 text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="divide-y divide-neutral-50">
                  {group.items.map((t) => {
                    const meta = TXN_META[t.type] || TXN_META.recharge;
                    const credit = t.type === "recharge" || t.type === "refund";
                    return (
                      <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50/60 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.className}`}>
                            <meta.Icon className="w-4.5 h-4.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-800 truncate">{meta.label}</p>
                            <p className="text-xs text-neutral-400">{fmtTime(t.created_at)}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-semibold flex-shrink-0 tabular-nums ${credit ? "text-success" : "text-danger"}`}>
                          {credit ? "+" : "-"}₹{Number(t.amount).toLocaleString("en-IN")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRecharge === true && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.6)" }}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6 animate-bounce-in">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-4.5 h-4.5 text-primary" />
              </span>
              <h3 className="font-poppins font-semibold text-lg text-neutral-800">Recharge Amount</h3>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setRechargeAmount(amt)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    rechargeAmount === amt ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-600 hover:border-neutral-200"
                  }`}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
            <label className="text-xs font-semibold text-neutral-500 mb-1.5 block">Or enter a custom amount</label>
            <div className="relative mb-5">
              <IndianRupee className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                min={100}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl pl-9 pr-3.5 py-3 text-sm text-neutral-800 outline-none focus:border-primary focus:bg-white transition-colors tabular-nums"
              />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowRecharge(false)} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setShowRecharge("sheet")}
                disabled={rechargeAmount < 100}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentSheet
        open={showRecharge === "sheet"}
        payType="full"
        amount={rechargeAmount}
        token={token}
        title="Wallet Recharge"
        allowPayLater={false}
        orderUrl="/api/wallet/recharge/order"
        orderBody={orderBody}
        verifyUrl="/api/wallet/recharge/verify"
        onClose={() => setShowRecharge(false)}
        onSuccess={handleRechargeSuccess}
      />
    </div>
  );
}
