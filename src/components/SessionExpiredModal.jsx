import React, { useEffect, useRef, useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, LogIn } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useAuth } from "../context/AuthContext";
import { SESSION_EXPIRED_EVENT } from "../services/api";

// Mounted once in App.jsx. Any authenticated api.* call that gets back a 401 (session expired,
// token revoked elsewhere, etc.) dispatches SESSION_EXPIRED_EVENT (see services/api.js) instead
// of just failing silently/generically on whichever page happened to make the call — this pops
// an inline re-login form over the current page instead of yanking the user to /login and
// losing their place (that's also why it deliberately does NOT clear the stored session or call
// logout() on open: ProtectedRoute would immediately redirect away the moment isAuthenticated
// flips false, which is exactly the jarring navigation this is meant to avoid).
export default function SessionExpiredModal() {
  const { login, refreshTokens } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailInputRef = useRef(null);
  // Guards against several requests 401ing around the same moment (e.g. a page firing off
  // multiple parallel api.* calls) from triggering multiple concurrent refresh attempts / reloads.
  const handlingRef = useRef(false);

  useEffect(() => {
    const handleExpired = async () => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      // The access token expiring is routine (short-lived by design) — try exchanging the
      // refresh token for a new one silently first. Only actually pop up the re-login form
      // once that fails too (refresh token itself expired/revoked), which is the real
      // "session expired" case this is for.
      const refreshed = await refreshTokens();
      if (refreshed) {
        window.location.reload();
      } else {
        handlingRef.current = false;
        setOpen(true);
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [refreshTokens]);

  useEffect(() => {
    if (open) setTimeout(() => emailInputRef.current?.focus(), 50);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // A full reload (rather than just closing the sheet) is deliberate — most pages read
      // the access token straight from localStorage per-render (services/api.js's getToken()),
      // not from AuthContext, so nothing about a successful re-login here would otherwise
      // prompt them to actually pick up the fresh token and retry their failed call.
      window.location.reload();
    } catch (err) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={open} onClose={() => setOpen(false)}>
      <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center mb-3">
        <LogIn className="w-4.5 h-4.5 text-primary" />
      </div>
      <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Your session has expired</h3>
      <p className="text-sm text-neutral-400 mb-5">Please sign in again to continue.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Email Address</label>
          <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-3.5 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
            <Mail className="w-4.5 h-4.5 text-neutral-300 mr-2 flex-shrink-0" />
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 min-w-0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Password</label>
          <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-3.5 py-3 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(22,101,52,0.1)] transition-all">
            <Lock className="w-4.5 h-4.5 text-neutral-300 mr-2 flex-shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 min-w-0"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="ml-2 text-neutral-400 hover:text-neutral-600 flex-shrink-0">
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign In <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </BottomSheet>
  );
}
