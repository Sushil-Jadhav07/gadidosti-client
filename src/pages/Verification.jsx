import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ReceiptText, FileText, Fingerprint, ShieldCheck, ShieldAlert, Loader2, ScanLine } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useKycStatus } from "../context/KycStatusContext";
import { api, getToken } from "../services/api";

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
const VERIFICATION_VALUES_KEY = "ssk_client_verification_values";

function Badge({ status, message }) {
  if (status === "loading") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400"><Loader2 size={13} className="animate-spin" /> Checking...</span>;
  if (status === "verified") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><ShieldCheck size={13} /> Verified</span>;
  if (status === "failed" || status === "error") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger"><ShieldAlert size={13} /> {message || "Couldn't verify, try again"}</span>;
  if (status === "missing") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><ShieldAlert size={13} /> Not found via DigiLocker — enter it manually</span>;
  return <span className="text-xs text-neutral-400">Not verified yet</span>;
}

const verifyBtnCls = "flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

// Mandatory for every client, no exceptions — PAN + Aadhaar (one DigiLocker session covers both)
// + GST (always a manual GSTIN lookup, DigiLocker has no GST document). Nothing here needs an
// explicit "Submit" button: the backend auto-finalizes (kyc.controller.js's
// maybeAutoFinalizeClientKyc) the instant all three are verified, so this page just keeps
// re-checking GET /api/kyc/status after every successful action. The real lock is server-side,
// in booking.controller.js's createBooking.
export default function Verification() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const token = getToken();
  const { refresh: refreshGlobalKycStatus } = useKycStatus();

  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [gst, setGst] = useState({ status: "idle" });
  const [pan, setPan] = useState({ status: "idle" });
  const [aadhaar, setAadhaar] = useState({ status: "idle" });
  const [dgLoading, setDgLoading] = useState(false);

  const fetchStatus = async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/kyc/status", token);
      if (res?.success) {
        setKycStatus(res.data.kyc_status);
        refreshGlobalKycStatus();
        const results = res.data.submission?.verification_results || {};
        if (results.gst) setGst({ status: results.gst.status, message: results.gst.details?.message });
        if (results.pan) setPan({ status: results.pan.status, message: results.pan.details?.message });
        if (results.aadhaar) setAadhaar({ status: results.aadhaar.status, message: results.aadhaar.details?.message });
      }
    } catch {
      // Leave whatever state we already have — the page still works, just without a fresh read.
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // After DigiLocker redirects back here with ?verification_id=..., resolve it and restore
  // whatever the client had typed before leaving (stashed in sessionStorage) — mirrors the
  // same pattern the broker/driver onboarding wizard uses.
  const checkDigilocker = async (verificationId, attempt = 0) => {
    setDgLoading(true);
    setAadhaar((a) => ({ ...a, status: "loading", message: null }));
    try {
      const res = await api.get(`/api/kyc/verify/digilocker/status?verification_id=${encodeURIComponent(verificationId)}`, token);
      if (!res?.success) throw new Error(res?.message);
      const { status, message, documents } = res.data;
      if (status === "pending") {
        if (attempt < 4) {
          setTimeout(() => checkDigilocker(verificationId, attempt + 1), 3000);
          return;
        }
        setAadhaar({ status: "error", message: "DigiLocker hasn't confirmed yet — please try again." });
        setDgLoading(false);
        return;
      }
      if (status === "failed") {
        setAadhaar({ status: "error", message: message || "DigiLocker didn't complete — please start again." });
        setDgLoading(false);
        return;
      }
      const aadhaarDoc = documents?.aadhaar;
      const panDoc = documents?.pan;
      setAadhaar(aadhaarDoc ? { status: aadhaarDoc.status, message: aadhaarDoc.details?.message } : { status: "idle" });
      if (panDoc) setPan({ status: panDoc.status, message: panDoc.details?.message });
      setDgLoading(false);
      await fetchStatus({ silent: true });
    } catch (err) {
      setAadhaar({ status: "error", message: err.message });
      setDgLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchStatus();
      const returnedId = new URLSearchParams(window.location.search).get("verification_id");
      if (returnedId) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(VERIFICATION_VALUES_KEY) || "null");
          if (stored?.gstin) setGstin(stored.gstin);
          if (stored?.panNumber) setPanNumber(stored.panNumber);
        } catch { /* ignore a corrupt/blocked stash */ }
        window.history.replaceState({}, "", window.location.pathname);
        checkDigilocker(returnedId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDigilocker = async () => {
    setDgLoading(true);
    setAadhaar((a) => ({ ...a, status: "loading", message: null }));
    try {
      try { sessionStorage.setItem(VERIFICATION_VALUES_KEY, JSON.stringify({ gstin, panNumber })); } catch { /* ignore */ }
      const res = await api.post("/api/kyc/verify/digilocker/start", { redirect_url: `${window.location.origin}/verify` }, token);
      if (!res?.success) throw new Error(res?.message);
      window.location.href = res.data.url;
    } catch (err) {
      setAadhaar({ status: "error", message: err.message });
      setDgLoading(false);
    }
  };

  const verifyGst = async () => {
    const trimmed = gstin.trim().toUpperCase();
    if (!GST_REGEX.test(trimmed)) {
      toast.error("Enter a valid 15-character GSTIN");
      return;
    }
    setGst({ status: "loading" });
    try {
      const res = await api.post("/api/kyc/verify/gst", { gstin: trimmed }, token);
      if (!res?.success) throw new Error(res?.message);
      setGst({ status: res.data.status, message: res.data.details?.message });
      await fetchStatus({ silent: true });
    } catch (err) {
      setGst({ status: "error", message: err.message });
    }
  };

  const verifyPan = async () => {
    const trimmed = panNumber.trim().toUpperCase();
    if (!PAN_REGEX.test(trimmed)) {
      toast.error("Enter a valid PAN (e.g. ABCDE1234F)");
      return;
    }
    setPan({ status: "loading" });
    try {
      const res = await api.post("/api/kyc/verify/pan", { pan: trimmed, name: user?.name || undefined }, token);
      if (!res?.success) throw new Error(res?.message);
      setPan({ status: res.data.status, message: res.data.details?.message });
      await fetchStatus({ silent: true });
    } catch (err) {
      setPan({ status: "error", message: err.message });
    }
  };

  // PAN's manual fallback only shows once DigiLocker either hasn't been tried yet or couldn't
  // supply it — not up front, so the primary path (one DigiLocker tap covers PAN + Aadhaar) has
  // nothing extra to type.
  const showPanFallback = ["idle", "missing", "failed", "error"].includes(pan.status);

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
          <h1 className="font-poppins font-bold text-2xl text-neutral-800">Verification</h1>
          <p className="text-sm text-neutral-400 mt-0.5">PAN, Aadhaar and GST — required once before you can use most of the app.</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : kycStatus === "verified" ? (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-6 text-center py-10">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-success" />
          </div>
          <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">You're verified</h3>
          <p className="text-sm text-neutral-400 mb-6">PAN, Aadhaar and GST are all confirmed — you're all set.</p>
          <button onClick={() => navigate("/book")} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors">
            Book a Truck
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <ScanLine size={16} className="text-primary" />
            <h3 className="font-bold text-slate-900 text-[15px]">Automated Verification</h3>
          </div>
          <p className="text-xs text-neutral-400 mb-5">All three are required to unlock the app.</p>

          <div className="space-y-3">
            {/* Aadhaar + PAN via DigiLocker — the primary path */}
            <div className="bg-neutral-50 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <Fingerprint className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">Aadhaar + PAN</p>
                  <Badge status={aadhaar.status} message={aadhaar.message} />
                </div>
              </div>
              {aadhaar.status !== "verified" && (
                <button type="button" onClick={startDigilocker} disabled={dgLoading} className={verifyBtnCls}>
                  Verify with DigiLocker
                </button>
              )}
            </div>

            {/* PAN manual fallback */}
            {showPanFallback && (
              <div className="bg-neutral-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-neutral-500">PAN not in your DigiLocker? Enter it directly</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="flex-1 min-w-0 bg-white border-2 border-neutral-100 rounded-lg px-3 py-2.5 text-sm text-neutral-800 outline-none focus:border-primary placeholder:text-neutral-300"
                  />
                  <button type="button" onClick={verifyPan} disabled={!panNumber || pan.status === "loading"} className={verifyBtnCls}>
                    Verify PAN
                  </button>
                </div>
                {pan.status !== "idle" && <div className="mt-2"><Badge status={pan.status} message={pan.message} /></div>}
              </div>
            )}

            {/* GST — always manual, no DigiLocker document for it */}
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <ReceiptText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-neutral-500">GSTIN</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                  placeholder="27ABCDE1234F1Z5"
                  maxLength={15}
                  className="flex-1 min-w-0 bg-white border-2 border-neutral-100 rounded-lg px-3 py-2.5 text-sm text-neutral-800 outline-none focus:border-primary placeholder:text-neutral-300"
                />
                <button type="button" onClick={verifyGst} disabled={!gstin || gst.status === "loading"} className={verifyBtnCls}>
                  Verify GST
                </button>
              </div>
              <div className="mt-2"><Badge status={gst.status} message={gst.message} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
