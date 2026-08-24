import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

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
        phone: form.phone || undefined,
        password: form.password,
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
      <div className="hidden lg:flex flex-col lg:w-1/2 bg-secondary relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(25,118,255,0.25) 0%, transparent 60%)" }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* The wordmark's own text is dark, unreadable straight on this dark panel (only the
              blue/green "GD" icon would show) — a white chip keeps the real logo colors intact
              instead of forcing it all white via a filter. */}
          <div className="flex flex-col items-start gap-2">
            <div className="bg-white rounded-lg px-3 py-2 inline-block">
              <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-10 w-auto" />
            </div>
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
      <div className="w-[55%] lg:w-1/2 flex items-center justify-start bg-neutral px-6 py-10">
        <div className="w-full ">
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-12 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <h2 className="font-poppins font-bold text-3xl text-neutral-800 mb-1">Create an account</h2>
          <p className="text-sm text-neutral-400 mb-8">Enter your details below to get started.</p>

          {showGoogleBtn && (
            <>
              <div ref={googleBtnRef} className="w-full flex justify-center" style={{ minHeight: 44 }} />
              {googleLoading && (
                <p className="text-xs text-neutral-400 text-center mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 border border-neutral-300 border-t-primary rounded-full animate-spin" />
                  Signing up with Google...
                </p>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-neutral px-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">Or register with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="w-full grid grid-cols-2 gap-4"> 
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
                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all"
              />
            </div>
            <div> <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                Email Address <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="john@company.com"
                required
                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all"
              /></div>
            </div>

            {/* Email */}
            <div>
             
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                Phone Number <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                placeholder="+91 00000 00000"
                inputMode="numeric"
                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all"
              />
            </div>

            {/* Password + Confirm — side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                  Password
                </label>
                <div className="flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
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
                <div className={`flex items-center bg-white border rounded-xl px-3 py-3.5 focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all ${!passwordsMatch ? "border-red-200 focus-within:border-red-400" : "border-neutral-200 focus-within:border-primary"}`}>
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
              {!passwordsMatch && <p className="col-span-2 text-xs text-red-500 -mt-2">Passwords do not match</p>}
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
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
