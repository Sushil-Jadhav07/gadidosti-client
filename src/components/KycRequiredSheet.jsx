import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowRight } from "lucide-react";
import BottomSheet from "./BottomSheet";

// Shown instead of calling POST /api/bookings (or instead of rendering a locked page — see
// KycGate.jsx) when the logged-in client's kyc_status isn't 'verified'. Mandatory for every
// client, no exceptions — createBooking's KYC_VERIFICATION_REQUIRED 403 is the real lock; this
// is just the UX in front of it.
export default function KycRequiredSheet({ isOpen, onClose }) {
  const navigate = useNavigate();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center mb-3">
        <ShieldAlert className="w-4.5 h-4.5 text-primary" />
      </div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Verification required</h3>
      <p className="text-sm text-neutral-400 mb-5">
        Every client must verify their PAN, Aadhaar and GST before creating a booking. It only takes a moment.
      </p>
      <button
        onClick={() => { onClose(); navigate("/verify"); }}
        className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        Verify Now <ArrowRight className="w-4 h-4" />
      </button>
    </BottomSheet>
  );
}
