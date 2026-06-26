import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, Mail, MapPin, Package, Clock, ArrowRight, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
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
  const { login, googleLogin, isAuthenticated } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const emailInputRef = useRef(null);
  const googleBtnRef = useRef(null);

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

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex flex-col w-[55%] bg-secondary relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(25,118,255,0.25) 0%, transparent 60%)" }}
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
          <div className="flex flex-col items-start gap-2">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-14 w-auto" />
            <p className="text-xs font-semibold text-primary/80 uppercase tracking-widest">Client Portal</p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-primary text-sm font-semibold tracking-wide uppercase mb-3">
              India's Trusted Transport Platform
            </p>
            <h2 className="font-poppins font-bold text-4xl text-white leading-tight mb-4">
              Move Your Goods<br />
              Across India,<br />
              Seamlessly.
            </h2>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Connect with verified truck drivers and logistics partners for
              fast, reliable, and affordable shipments.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-white/50 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/30">© 2024 SSK Logistics. All rights reserved.</p>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center bg-neutral px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
            <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-12 w-auto" />
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest">Client Portal</p>
          </div>

          <div className={shake ? "animate-shake" : ""}>
            <h2 className="font-poppins font-bold text-3xl text-neutral-800 mb-1">Welcome back</h2>
            <p className="text-sm text-neutral-400 mb-8">Sign in to manage your shipments</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                  Email Address
                </label>
                <div className="flex items-center bg-white border-2 border-neutral-100 rounded-xl px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
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
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                  Password
                </label>
                <div className="flex items-center bg-white border-2 border-neutral-100 rounded-xl px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(25,118,255,0.1)] transition-all">
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
                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
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

            {showGoogleBtn && (
              <>
                <div className="relative my-5">
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

            <div className="mt-6 p-4 bg-white rounded-xl border border-neutral-100">
              <p className="text-xs text-neutral-400 mb-2 font-medium">Demo credentials</p>
              <p className="text-xs text-neutral-600 font-mono">Email: client@ssklogistics.in</p>
              <p className="text-xs text-neutral-600 font-mono mt-1">Password: Admin@123456</p>
            </div>

            <p className="text-sm text-neutral-500 text-center mt-5">
              New here?{" "}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Create an account
              </Link>
            </p>

            <p className="text-[11px] text-neutral-400 mt-4 text-center">
              By signing in, you agree to our{" "}
              <button className="text-primary hover:underline">Terms &amp; Privacy Policy</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
