import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, X, Loader2, IndianRupee } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { useBillingAccount } from "../context/BillingAccountContext";
import { api, getToken } from "../services/api";
import PaymentSheet from "../components/PaymentSheet";

const STATUS_META = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700" },
  paid: { label: "Paid", className: "bg-success/10 text-success" },
};

export default function MyBills() {
  const navigate = useNavigate();
  const toast = useToast();
  const { outstanding, creditLimit, refresh: refreshBillingAccount } = useBillingAccount();
  const token = getToken();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [detailTarget, setDetailTarget] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [payTarget, setPayTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/bills?limit=50", token);
      if (res?.success) setBills(res.data.bills || []);
    } catch {
      toast.error("Could not load your bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (bill) => {
    setDetailTarget(bill);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/bills/${bill.id}`, token);
      if (res?.success) setDetailItems(res.data.items || []);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePaySuccess = () => {
    setPayTarget(null);
    toast.success("Bill paid successfully");
    load();
    refreshBillingAccount();
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-2xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-poppins font-bold text-2xl text-neutral-800">My Bills</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Your postpaid account — bookings billed monthly.</p>
        </div>
      </div>

      <div
        className="rounded-2xl p-6 mb-5 text-white"
        style={{ background: "linear-gradient(155deg, #166534 0%, #14532D 65%, #0f3d22 100%)" }}
      >
        <div className="flex items-center gap-2 mb-2 text-white/70">
          <Receipt className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Outstanding Balance</span>
        </div>
        <p className="font-poppins font-bold text-3xl mb-1">₹{outstanding.toLocaleString("en-IN")}</p>
        {creditLimit != null && (
          <p className="text-xs text-white/50">of ₹{creditLimit.toLocaleString("en-IN")} credit limit</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-sm text-neutral-800">Bill History</h3>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400">No bills yet</div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {bills.map((b) => (
              <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <button onClick={() => openDetail(b)} className="text-left min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800">₹{Number(b.total_amount).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-neutral-400">{new Date(b.created_at).toLocaleDateString("en-IN")}</p>
                </button>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_META[b.status]?.className}`}>
                  {STATUS_META[b.status]?.label}
                </span>
                {b.status === "pending" && (
                  <button
                    onClick={() => setPayTarget(b)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex-shrink-0"
                  >
                    <IndianRupee size={12} /> Pay Now
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
              <div>
                <h3 className="font-poppins font-semibold text-lg text-neutral-800">₹{Number(detailTarget.total_amount).toLocaleString("en-IN")}</h3>
                <p className="text-xs text-neutral-400">{STATUS_META[detailTarget.status]?.label}</p>
              </div>
              <button onClick={() => setDetailTarget(null)} className="text-neutral-400 hover:text-neutral-600"><X size={18} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {detailLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
              ) : detailItems.length === 0 ? (
                <div className="p-10 text-center text-sm text-neutral-400">No line items</div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {detailItems.map((item) => (
                    <div key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800">{item.booking_number}</p>
                        <p className="text-xs text-neutral-400 truncate">{item.pickup_location} → {item.drop_location}</p>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0">₹{Number(item.amount).toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PaymentSheet
        open={!!payTarget}
        amount={payTarget?.total_amount}
        token={token}
        title="Pay Bill"
        allowPayLater={false}
        orderUrl={payTarget ? `/api/bills/${payTarget.id}/payment/order` : undefined}
        orderBody={{}}
        verifyUrl={payTarget ? `/api/bills/${payTarget.id}/payment/verify` : undefined}
        onClose={() => setPayTarget(null)}
        onSuccess={handlePaySuccess}
      />
    </div>
  );
}
