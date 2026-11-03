import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { sendFirebaseOtp, resetRecaptcha } from "../lib/firebase";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Register() {
  const navigate = useNavigate();
  const { register, googleLogin, isAuthenticated } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // Phone verification — mandatory now (backend rejects registration without it). Firebase's
  // own SDK sends/verifies the OTP client-side; once confirmed, the phone field locks and
  // firebaseIdToken is sent along with the rest of the form on final submit.
  const [otpStage, setOtpStage] = useState("idle"); // idle -> sent -> verified
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [firebaseIdToken, setFirebaseIdToken] = useState(null);
  const firebaseConfirmationRef = useRef(null);
  const otpCodeInputRef = useRef(null);

  const firebaseOtpErrorMessage = (err) => {
    switch (err?.code) {
      case "auth/invalid-phone-number": return "Enter a valid 10-digit phone number.";
      case "auth/too-many-requests": return "Too many attempts — please wait a while before trying again.";
      case "auth/invalid-verification-code": return "That code isn't right. Please check and try again.";
      case "auth/code-expired": return "This code has expired — request a new one.";
      default: return err?.message || "Something went wrong. Please try again.";
    }
  };

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpSending(true);
    try {
      firebaseConfirmationRef.current = await sendFirebaseOtp(form.phone);
      setOtpStage("sent");
      setTimeout(() => otpCodeInputRef.current?.focus(), 50);
    } catch (err) {
      resetRecaptcha();
      setOtpError(firebaseOtpErrorMessage(err));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpVerifying(true);
    try {
      if (!firebaseConfirmationRef.current) throw new Error("Please request a new OTP.");
      const result = await firebaseConfirmationRef.current.confirm(otpCode);
      const idToken = await result.user.getIdToken();
      setFirebaseIdToken(idToken);
      setOtpStage("verified");
    } catch (err) {
      setOtpError(firebaseOtpErrorMessage(err));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtpSending(true);
    try {
      resetRecaptcha();
      firebaseConfirmationRef.current = await sendFirebaseOtp(form.phone);
    } catch (err) {
      setOtpError(firebaseOtpErrorMessage(err));
    } finally {
      setOtpSending(false);
    }
  };

  // Editing the phone after verifying it invalidates that verification — the Firebase token
  // proved ownership of the OLD number, not whatever's typed now.
  const handlePhoneChange = (e) => {
    const next = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phone: next }));
    if (otpStage !== "idle") {
      setOtpStage("idle");
      setOtpCode("");
      setFirebaseIdToken(null);
      resetRecaptcha();
    }
  };

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  // Same unified /api/auth/google endpoint Login.jsx uses — it creates the account on first
  // sign-in, so "Sign up with Google" and "Sign in with Google" are the exact same call.
  const credentialHandlerRef = useRef(null);
  credentialHandlerRef.current = async ({ credential }) => {
    setError("");
    setGoogleLoading(true);
    try {
      const { user, needs_phone } = await googleLogin(credential);
      toast.success(`Welcome, ${user.name}!`, "Signed up with Google");
      navigate("/");
      if (needs_phone) {
        setTimeout(() => toast.info("Add your phone number in profile settings for full access."), 600);
      }
    } catch (err) {
      setError(err.message || "Google Sign-Up failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId || clientId.startsWith("your-") || !googleBtnRef.current) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => credentialHandlerRef.current?.(res),
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "signup_with",
        shape: "rectangular",
        width: googleBtnRef.current.clientWidth || 340,
      });
    };

    if (window.google?.accounts?.id) { renderButton(); return; }

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", renderButton);
      return () => existing.removeEventListener("load", renderButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, []);

  const showGoogleBtn = GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith("your-");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const passwordsMatch = form.password === form.confirm || form.confirm === "";
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().includes("@") &&
    otpStage === "verified" &&
    form.password.length >= 6 &&
    form.password === form.confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone,
        password: form.password,
        id_token: firebaseIdToken,
      });
      setDone(true);
      toast.success("Account created! You can now sign in.", "Welcome");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="font-poppins font-bold text-xl text-neutral-800">Account Created!</h2>
          <p className="text-neutral-500 text-sm mt-2">Redirecting to sign in...</p>
          <div className="mt-5 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div
        className="hidden lg:flex flex-col lg:w-1/2 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #14532D 0%, #166534 55%, #16A34A 100%)" }}
      >
        {/* Light highlight, not green-on-green — a colored glow would barely show against a
            background that's already this same green. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 75% 15%, rgba(255,255,255,0.16) 0%, transparent 55%)" }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* The wordmark's own text is dark, unreadable straight on this dark panel (only the
              blue/green "GD" icon would show) — a white chip keeps the real logo colors intact
              instead of forcing it all white via a filter. */}
          <div className="flex flex-col items-start gap-2">
            <div className="bg-white rounded-lg px-3 py-2 inline-block">
              <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-10 w-auto" />
            </div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">Client Portal</p>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="font-poppins font-bold text-4xl text-white leading-tight mb-4">
              Join India's<br />Leading<br />Logistics Network
            </h2>
            <p className="text-white/70 text-base leading-relaxed max-w-sm">
              Register in seconds and start booking verified trucks across India.
            </p>
          </div>
          <p className="text-[11px] text-white/30">© 2024 SSK Logistics. All rights reserved.</p>
        </div>
      </div>

      {/* Right — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center overflow-x-hidden bg-neutral px-6 py-6">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-1.5 mb-5 lg:hidden">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-10 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <h2 className="font-poppins font-bold text-2xl text-neutral-800 mb-1">Create an account</h2>
          <p className="text-sm text-neutral-400 mb-5">Enter your details below to get started.</p>

          {showGoogleBtn && (
            <>
              <div ref={googleBtnRef} className="w-full flex justify-center" style={{ minHeight: 44 }} />
              {googleLoading && (
                <p className="text-xs text-neutral-400 text-center mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 border border-neutral-300 border-t-primary rounded-full animate-spin" />
                  Signing up with Google...
                </p>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-neutral px-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">Or register with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="John Doe"
                  required
                  autoFocus
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="john@company.com"
                  required
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all"
                />
              </div>
            </div>

            {/* Firebase Phone Auth's required reCAPTCHA host — invisible, never shown. */}
            <div id="recaptcha-container" />

            {/* Phone — mandatory, and must be verified via OTP before the form can submit */}
            <div>
              <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                Phone Number <span className="text-danger">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  placeholder="10-digit phone number"
                  inputMode="numeric"
                  disabled={otpStage === "verified"}
                  required
                  className="flex-1 min-w-0 bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all disabled:bg-neutral-50 disabled:text-neutral-500"
                />
                {otpStage === "verified" ? (
                  <span className="flex items-center gap-1.5 px-3 text-success text-sm font-semibold whitespace-nowrap">
                    <CheckCircle className="w-4 h-4" /> Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending || form.phone.length !== 10}
                    className="px-4 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {otpSending ? "Sending..." : otpStage === "sent" ? "Resend OTP" : "Send OTP"}
                  </button>
                )}
              </div>

              {otpStage === "sent" && (
                <div className="mt-2.5 flex items-center gap-2 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5">
                  <KeyRound className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                  <input
                    ref={otpCodeInputRef}
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpVerifying || otpCode.length !== 6}
                    className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {otpVerifying ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
              {otpStage === "sent" && (
                <button type="button" onClick={handleResendOtp} disabled={otpSending} className="text-xs font-semibold text-primary hover:underline mt-1.5 disabled:opacity-50">
                  Resend OTP
                </button>
              )}
              {otpError && <p className="text-xs text-danger mt-1.5">{otpError}</p>}
            </div>

            {/* Password + Confirm — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                  Password
                </label>
                <div className="flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="ml-1.5 text-neutral-400 hover:text-neutral-600 flex-shrink-0">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                  Confirm Password
                </label>
                <div className={`flex items-center bg-white border rounded-xl px-3 py-3 focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all ${!passwordsMatch ? "border-red-200 focus-within:border-red-400" : "border-neutral-200 focus-within:border-primary"}`}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={form.confirm}
                    onChange={set("confirm")}
                    placeholder="Repeat password"
                    required
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="ml-1.5 text-neutral-400 hover:text-neutral-600 flex-shrink-0">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {!passwordsMatch && <p className="col-span-1 sm:col-span-2 text-xs text-red-500 -mt-2">Passwords do not match</p>}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <p className="text-xs text-neutral-400">
              By clicking Create Account, you agree to our{" "}
              <button type="button" className="text-primary hover:underline">Terms of Service</button> and{" "}
              <button type="button" className="text-primary hover:underline">Privacy Policy</button>.
            </p>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
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

          <p className="text-sm text-neutral-500 text-center mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
