import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, Mail, MapPin, Package, Clock, ArrowRight, Eye, EyeOff, Lock, AlertCircle, Phone, KeyRound } from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const FEATURES = [
  { icon: Truck, label: "Book Instantly", desc: "Reserve trucks in under 2 minutes" },
  { icon: MapPin, label: "Live Tracking", desc: "Real-time GPS location updates" },
  { icon: Package, label: "Any Load", desc: "From pickups to 20-ton trucks" },
  { icon: Clock, label: "24/7 Support", desc: "We're always here to help" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, googleLogin, sendLoginOtp, verifyLoginOtp, isAuthenticated, forgotPassword, resetPassword } = useAuth();
  const toast = useToast();
  // "password" (default, unchanged) or "otp" — a second way in, phone + OTP, no password
  // needed at all. Independent of the email/password fields below, which only the password
  // method uses.
  const [method, setMethod] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const emailInputRef = useRef(null);
  const googleBtnRef = useRef(null);

  // OTP method's own state — "phone" stage (enter number, request a code) -> "code" stage
  // (enter the 6-digit code, verify). Separate loading/error from the password form above so
  // switching tabs never shows a stale spinner/error from the other method.
  const [otpStage, setOtpStage] = useState("phone");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const otpPhoneInputRef = useRef(null);
  const otpCodeInputRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
    emailInputRef.current?.focus();
  }, [isAuthenticated, navigate]);

  // Use a ref so the GSI callback always captures the latest state/functions
  const credentialHandlerRef = useRef(null);
  credentialHandlerRef.current = async ({ credential }) => {
    setError("");
    setGoogleLoading(true);
    try {
      const { user, needs_phone } = await googleLogin(credential);
      toast.success(`Welcome, ${user.name}!`, "Signed in with Google");
      navigate("/");
      if (needs_phone) {
        setTimeout(() => toast.info("Add your phone number in profile settings for full access."), 600);
      }
    } catch (err) {
      setError(err.message || "Google Sign-In failed. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
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
        text: "signin_with",
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

  // ── Forgot password — real OTP flow (POST /api/auth/forgot-password then /reset-password,
  // both already wired up in AuthContext, just never had a screen calling them until now).
  const [showForgotSheet, setShowForgotSheet] = useState(false);
  const [fpStage, setFpStage] = useState("phone"); // "phone" -> "reset"
  const [fpPhone, setFpPhone] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");

  const openForgotSheet = () => {
    setFpStage("phone");
    setFpPhone("");
    setFpOtp("");
    setFpNewPassword("");
    setFpConfirmPassword("");
    setFpError("");
    setShowForgotSheet(true);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setFpError("");
    setFpLoading(true);
    try {
      await forgotPassword(fpPhone);
      toast.success("OTP sent — check your phone");
      setFpStage("reset");
    } catch (err) {
      setFpError(err.message || "Failed to send OTP");
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFpError("");
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError("Passwords do not match");
      return;
    }
    setFpLoading(true);
    try {
      await resetPassword(fpPhone, fpOtp, fpNewPassword);
      toast.success("Password reset — please sign in");
      setShowForgotSheet(false);
    } catch (err) {
      setFpError(err.message || "Failed to reset password");
    } finally {
      setFpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`, "Login Successful");
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = (next) => {
    setMethod(next);
    setError("");
    // Reset the OTP form back to its first stage on every tab switch — picking up mid-code
    // entry after bouncing to Password and back would be confusing, and the code itself would
    // likely have expired anyway by the time someone comes back to it.
    setOtpStage("phone");
    setOtpCode("");
    setOtpError("");
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpSending(true);
    try {
      await sendLoginOtp(otpPhone);
      toast.success(`OTP sent to ${otpPhone}`);
      setOtpStage("code");
      setTimeout(() => otpCodeInputRef.current?.focus(), 50);
    } catch (err) {
      setOtpError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpVerifying(true);
    try {
      const user = await verifyLoginOtp(otpPhone, otpCode);
      toast.success(`Welcome back, ${user.name}!`, "Login Successful");
      navigate("/");
    } catch (err) {
      setOtpError(err.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtpSending(true);
    try {
      await sendLoginOtp(otpPhone);
      toast.success("OTP resent");
    } catch (err) {
      setOtpError(err.message || "Failed to resend OTP");
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding Panel */}
      <div
        className="hidden lg:flex flex-col w-[55%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #14532D 0%, #166534 55%, #16A34A 100%)" }}
      >
        {/* Light highlight, not green-on-green — a colored glow would barely show against a
            background that's already this same green. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 75% 15%, rgba(255,255,255,0.16) 0%, transparent 55%)" }}
        />
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="loginDots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="16" cy="16" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginDots)" />
          </svg>
        </div>

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
            <p className="text-white/70 text-sm font-semibold tracking-wide uppercase mb-3">
              India's Trusted Transport Platform
            </p>
            <h2 className="font-poppins font-bold text-4xl text-white leading-tight mb-4">
              Move Your Goods<br />
              Across India,<br />
              Seamlessly.
            </h2>
            <p className="text-white/70 text-base leading-relaxed max-w-sm">
              Connect with verified truck drivers and logistics partners for
              fast, reliable, and affordable shipments.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-white/60 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/30">© 2024 SSK Logistics. All rights reserved.</p>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center overflow-x-hidden bg-neutral px-6 py-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-1.5 mb-5 lg:hidden">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-10 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <div className={shake ? "animate-shake" : ""}>
            <h2 className="font-poppins font-bold text-2xl text-neutral-800 mb-1 text-center">Welcome back</h2>
            <p className="text-sm text-neutral-400 mb-5 text-center">Sign in to manage your shipments</p>

            {/* Password vs OTP — two independent ways in, not a sub-step of each other.
                Switching tabs resets the OTP form back to its first stage (see switchMethod). */}
            <div className="flex bg-neutral-50 border border-neutral-100 rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => switchMethod("password")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  method === "password" ? "bg-white shadow-sm text-primary" : "text-neutral-500"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => switchMethod("otp")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  method === "otp" ? "bg-white shadow-sm text-primary" : "text-neutral-500"
                }`}
              >
                OTP
              </button>
            </div>

            {method === "password" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
                    <Mail className="w-5 h-5 text-neutral-300 mr-2 flex-shrink-0" />
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                      Password
                    </label>
                    <button type="button" onClick={openForgotSheet} className="text-xs font-semibold text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
                    <Lock className="w-5 h-5 text-neutral-300 mr-3 flex-shrink-0" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="ml-2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {loading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : otpStage === "phone" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                    Phone Number
                  </label>
                  <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
                    <Phone className="w-5 h-5 text-neutral-300 mr-2 flex-shrink-0" />
                    <input
                      ref={otpPhoneInputRef}
                      type="tel"
                      inputMode="numeric"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Enter your registered phone number"
                      required
                      className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    />
                  </div>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpSending || otpPhone.length !== 10}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {otpSending ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                      Enter OTP
                    </label>
                    <button type="button" onClick={() => switchMethod("otp")} className="text-xs font-semibold text-primary hover:underline">
                      Change number
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 mb-2">We sent a code to {otpPhone}.</p>
                  <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
                    <KeyRound className="w-5 h-5 text-neutral-300 mr-3 flex-shrink-0" />
                    <input
                      ref={otpCodeInputRef}
                      type="text"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      required
                      className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 tracking-widest"
                    />
                  </div>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpVerifying || otpCode.length !== 6}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {otpVerifying ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify &amp; Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpSending}
                  className="w-full text-center text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {otpSending ? "Resending..." : "Resend OTP"}
                </button>
              </form>
            )}

            {showGoogleBtn && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-neutral px-3 text-xs text-neutral-400">or continue with</span>
                  </div>
                </div>

                <div ref={googleBtnRef} className="w-full flex justify-center" style={{ minHeight: 44 }} />

                {googleLoading && (
                  <p className="text-xs text-neutral-400 text-center mt-2 flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 border border-neutral-300 border-t-primary rounded-full animate-spin" />
                    Signing in with Google...
                  </p>
                )}
              </>
            )}

        

            <p className="text-sm text-neutral-500 text-center mt-4">
              New here?{" "}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Create an account
              </Link>
            </p>

            <p className="text-[11px] text-neutral-400 mt-3 text-center">
              By signing in, you agree to our{" "}
              <button className="text-primary hover:underline">Terms &amp; Privacy Policy</button>
            </p>
          </div>
        </div>
      </div>

      <BottomSheet isOpen={showForgotSheet} onClose={() => setShowForgotSheet(false)}>
        {fpStage === "phone" ? (
          <form onSubmit={handleRequestOtp}>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Reset your password</h3>
            <p className="text-sm text-neutral-400 mb-5">Enter your phone number and we'll send you an OTP.</p>

            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Phone Number</label>
            <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 mb-4 focus-within:border-primary transition-all">
              <Phone className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="tel"
                value={fpPhone}
                onChange={(e) => setFpPhone(e.target.value)}
                placeholder="Enter your registered phone number"
                required
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>

            {fpError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {fpError}
              </div>
            )}

            <button
              type="submit"
              disabled={fpLoading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {fpLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending OTP...</>
              ) : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Enter OTP &amp; new password</h3>
            <p className="text-sm text-neutral-400 mb-5">We sent a code to {fpPhone}.</p>

            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">OTP</label>
            <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 mb-4 focus-within:border-primary transition-all">
              <KeyRound className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="text"
                value={fpOtp}
                onChange={(e) => setFpOtp(e.target.value)}
                placeholder="6-digit code"
                required
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>

            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">New Password</label>
            <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 mb-4 focus-within:border-primary transition-all">
              <Lock className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="password"
                value={fpNewPassword}
                onChange={(e) => setFpNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>

            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Confirm Password</label>
            <div className="flex items-center bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 mb-4 focus-within:border-primary transition-all">
              <Lock className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="password"
                value={fpConfirmPassword}
                onChange={(e) => setFpConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>

            {fpError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {fpError}
              </div>
            )}

            <button
              type="submit"
              disabled={fpLoading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {fpLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Resetting...</>
              ) : "Reset Password"}
            </button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
