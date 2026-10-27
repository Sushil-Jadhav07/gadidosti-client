import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet as WalletIcon, Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import PaymentSheet from "../components/PaymentSheet";

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

const TXN_META = {
  recharge: { label: "Recharge", Icon: ArrowDownCircle, className: "text-success" },
  booking_payment: { label: "Booking Payment", Icon: ArrowUpCircle, className: "text-danger" },
  refund: { label: "Refund", Icon: RotateCcw, className: "text-primary" },
};

export default function Wallet() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);

  const load = async () => {
    setLoading(true);
    try {
      const [balRes, txnRes] = await Promise.all([
        api.get("/api/wallet", token),
        api.get("/api/wallet/transactions", token),
      ]);
      if (balRes?.success) setBalance(Number(balRes.data.balance));
      if (txnRes?.success) setTransactions(txnRes.data.transactions || []);
    } catch {
      toast.error("Could not load your wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const orderBody = useMemo(() => ({ amount: Number(rechargeAmount) }), [rechargeAmount]);

  const handleRechargeSuccess = (data) => {
    setShowRecharge(false);
    setBalance(Number(data?.balance ?? balance));
    toast.success("Wallet recharged successfully");
    load();
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-xl mx-auto">
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

      <div className="rounded-2xl p-6 mb-5 text-white" style={{ background: "linear-gradient(160deg, #166534 0%, #14532D 100%)" }}>
        <div className="flex items-center gap-2 mb-2 text-white/70">
          <WalletIcon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Available Balance</span>
        </div>
        <p className="font-poppins font-bold text-3xl mb-5">
          {loading ? "—" : `₹${(balance ?? 0).toLocaleString("en-IN")}`}
        </p>
        <button
          onClick={() => setShowRecharge(true)}
          className="flex items-center gap-2 bg-white text-primary font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Recharge Wallet
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-sm text-neutral-800">Transaction History</h3>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400">No transactions yet</div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {transactions.map((t) => {
              const meta = TXN_META[t.type] || TXN_META.recharge;
              const credit = t.type === "recharge" || t.type === "refund";
              return (
                <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <meta.Icon className={`w-5 h-5 flex-shrink-0 ${meta.className}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800">{meta.label}</p>
                      <p className="text-xs text-neutral-400">{new Date(t.created_at).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold flex-shrink-0 ${credit ? "text-success" : "text-danger"}`}>
                    {credit ? "+" : "-"}₹{Number(t.amount).toLocaleString("en-IN")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showRecharge === true && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.6)" }}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6">
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-4">Recharge Amount</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setRechargeAmount(amt)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    rechargeAmount === amt ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-600"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={100}
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl px-3.5 py-3 text-sm text-neutral-800 outline-none focus:border-primary mb-4"
            />
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
