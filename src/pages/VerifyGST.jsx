import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ReceiptText, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

// Mandatory for every client, no exceptions — a client can't create a booking until this shows
// 'verified' (the real lock is server-side, in booking.controller.js's createBooking).
export default function VerifyGST() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [status, setStatus] = useState(null);
  const [gstNumber, setGstNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [failMessage, setFailMessage] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/gst/status", token);
      if (res?.success) {
        setStatus(res.data.gst_verification_status);
        setGstNumber(res.data.gst_number || "");
        if (res.data.gst_number) setGstin(res.data.gst_number);
      }
    } catch {
      // Leave status null — the form below still works, just without a prefilled state.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    const trimmed = gstin.trim().toUpperCase();
    if (!GST_REGEX.test(trimmed)) {
      toast.error("Enter a valid 15-character GSTIN");
      return;
    }
    setVerifying(true);
    setFailMessage("");
    try {
      const res = await api.post("/api/gst/verify", { gstin: trimmed }, token);
      if (!res?.success) throw new Error(res?.message || "Verification failed");
      setStatus(res.data.gst_verification_status);
      setGstNumber(trimmed);
      if (res.data.gst_verification_status === "verified") {
        toast.success("GST verified — you can now create bookings");
      } else {
        setFailMessage(res.data.details?.message || "This GSTIN could not be verified");
      }
    } catch (err) {
      toast.error(err?.message || "Verification failed — please try again");
    } finally {
      setVerifying(false);
    }
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
          <h1 className="font-poppins font-bold text-2xl text-neutral-800">GST Verification</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Required once before you can create any booking.</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-card p-6">
          {status === "verified" ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-success" />
              </div>
              <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">GST Verified</h3>
              <p className="text-sm text-neutral-400 mb-1">{gstNumber}</p>
              <p className="text-sm text-neutral-400 mb-6">You're all set — you can book a truck anytime.</p>
              <button onClick={() => navigate("/book")} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors">
                Book a Truck
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center mb-1">
                <ReceiptText className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                  placeholder="27ABCDE1234F1Z5"
                  maxLength={15}
                  required
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl px-3.5 py-3 text-sm text-neutral-800 outline-none focus:border-primary placeholder:text-neutral-300"
                />
              </div>

              {status === "failed" && failMessage && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-danger text-sm rounded-xl px-3.5 py-2.5">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  {failMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : "Verify GST"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
