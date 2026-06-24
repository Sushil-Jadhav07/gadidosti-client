import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Phone, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Register() {
  const navigate = useNavigate();
  const { register, sendOtp, verifyOtp } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState("form"); // "form" | "otp" | "done"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", password: "", confirm: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const passwordsMatch = form.password === form.confirm || form.confirm === "";
  const canSubmit = form.name && form.phone.length === 10 && form.password.length >= 6 &&
    form.password === form.confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      await register({ name: form.name, phone: form.phone, password: form.password });
      const otpResult = await sendOtp(form.phone);
      if (otpResult?.dev_otp) setDevOtp(otpResult.dev_otp);
      setStep("otp");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    setError("");
    setOtpLoading(true);
    try {
      await verifyOtp(form.phone, otp);
      setStep("done");
      toast.success("Account verified! You can now sign in.", "Registered");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    try {
      const result = await sendOtp(form.phone);
      if (result?.dev_otp) setDevOtp(result.dev_otp);
      toast.success("OTP resent successfully.");
    } catch (err) {
      setError(err.message || "Failed to resend OTP.");
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="font-poppins font-bold text-xl text-neutral-800">Account Verified!</h2>
          <p className="text-neutral-500 text-sm mt-2">Redirecting to sign in...</p>
          <div className="mt-5 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-8">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-12 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="font-poppins font-bold text-2xl text-neutral-800 mb-1">Verify Your Phone</h2>
            <p className="text-sm text-neutral-400 mb-6">
              Enter the 6-digit code sent to<br />
              <span className="font-semibold text-neutral-700">+91 {form.phone}</span>
            </p>

            {devOtp && (
              <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Dev Mode — OTP</p>
                <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest">{devOtp}</p>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                  OTP Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full bg-white border-2 border-neutral-100 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading || otp.length !== 6}
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {otpLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>Verify &amp; Activate <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResendOtp}
              className="mt-4 w-full text-sm text-neutral-400 hover:text-primary flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Resend OTP
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col w-[45%] bg-secondary relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(25,118,255,0.25) 0%, transparent 60%)" }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="flex flex-col items-start gap-2">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-14 w-auto" />
            <p className="text-xs font-semibold text-primary/80 uppercase tracking-widest">Client Portal</p>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="font-poppins font-bold text-4xl text-white leading-tight mb-4">
              Join India's<br />Leading<br />Logistics Network
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Register in seconds and start booking verified trucks across India.
            </p>
          </div>
          <p className="text-[11px] text-white/30">© 2024 SSK Logistics. All rights reserved.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center bg-neutral px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-12 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <h2 className="font-poppins font-bold text-3xl text-neutral-800 mb-1">Create account</h2>
          <p className="text-sm text-neutral-400 mb-8">Sign up to start booking trucks</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                Full Name
              </label>
              <div className="flex items-center bg-white border-2 border-neutral-100 rounded-xl px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
                <User className="w-5 h-5 text-neutral-300 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Your full name"
                  required
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                Phone Number
              </label>
              <div className="flex items-center bg-white border-2 border-neutral-100 rounded-xl px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
                <Phone className="w-5 h-5 text-neutral-300 mr-2 flex-shrink-0" />
                <span className="text-neutral-400 text-sm mr-1 select-none">+91</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  required
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="flex items-center bg-white border-2 border-neutral-100 rounded-xl px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
                <Lock className="w-5 h-5 text-neutral-300 mr-3 flex-shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="ml-2 text-neutral-400 hover:text-neutral-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                Confirm Password
              </label>
              <div className={`flex items-center bg-white border-2 rounded-xl px-4 py-3.5 focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all ${!passwordsMatch ? "border-red-200 focus-within:border-red-400" : "border-neutral-100 focus-within:border-primary"}`}>
                <Lock className="w-5 h-5 text-neutral-300 mr-3 flex-shrink-0" />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="Repeat password"
                  required
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="ml-2 text-neutral-400 hover:text-neutral-600">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {!passwordsMatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-neutral-500 text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-neutral-400 mt-4 text-center">
            By registering, you agree to our{" "}
            <button className="text-primary hover:underline">Terms &amp; Privacy Policy</button>
          </p>
        </div>
      </div>
    </div>
  );
}
