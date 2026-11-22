import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken } from "../services/api";
import { useAuth } from "./AuthContext";

const KycStatusContext = createContext({ kycStatus: null, loading: true, refresh: () => {} });

// Sticky "already verified" flag, scoped per user id so a different account logging in on the
// same browser never inherits it. Once GET /api/kyc/status has confirmed 'verified' for this
// user, trust that immediately on every later login/app-load instead of defaulting kycStatus to
// null while the fresh fetch below is in flight — that null (not yet "verified") is exactly what
// App.jsx's KycGate reads as "not verified" and bounces to /verify, which is what was showing the
// verification screen again to clients who'd already completed it: a slow network, a request
// that lands just after a route guard checks, or any other transient fetch delay/failure.
// Real downgrades (admin reverts someone, re-review, etc.) still take effect — they just come
// from the next successful refresh() below, never from inferring "not verified" out of the
// absence of an answer yet.
const flagKey = (userId) => `ssk_client_kyc_verified_${userId}`;
const readStickyVerified = (userId) => {
  if (!userId) return false;
  try { return localStorage.getItem(flagKey(userId)) === "1"; } catch { return false; }
};
const writeStickyVerified = (userId, verified) => {
  if (!userId) return;
  try {
    if (verified) localStorage.setItem(flagKey(userId), "1");
    else localStorage.removeItem(flagKey(userId));
  } catch { /* best-effort — a failed write just means the next load re-fetches instead */ }
};

// Fetched once per authenticated session (not trusted off the cached auth user, since this can
// change mid-session — see Verification.jsx, which calls refresh() after every successful
// check) and shared by every route that needs it: BookTruck.jsx's booking-confirm gate and
// App.jsx's KycGate, which locks every page except Dashboard/Profile/Chat/Verification until
// this is 'verified'. One fetch instead of each gate re-querying independently.
export function KycStatusProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [kycStatus, setKycStatus] = useState(() => (readStickyVerified(user?.id) ? "verified" : null));
  const [loading, setLoading] = useState(() => !readStickyVerified(user?.id));

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await api.get("/api/kyc/status", token);
      if (res?.success) {
        setKycStatus(res.data.kyc_status);
        writeStickyVerified(user?.id, res.data.kyc_status === "verified");
      }
    } catch { /* leave whatever we already have (the sticky flag, if any) */ }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setKycStatus(null);
      setLoading(false);
      return;
    }
    const alreadyVerified = readStickyVerified(user?.id);
    setKycStatus((prev) => (alreadyVerified ? "verified" : prev));
    let cancelled = false;
    // Don't force a loading state (which App.jsx's KycGate also renders nothing through) when a
    // sticky "verified" flag already answers the question — that would reintroduce the same
    // flash-redirect this flag exists to avoid, for however long the background refresh takes.
    setLoading(!alreadyVerified);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, refresh]);

  return (
    <KycStatusContext.Provider value={{ kycStatus, loading, refresh }}>
      {children}
    </KycStatusContext.Provider>
  );
}

export function useKycStatus() {
  return useContext(KycStatusContext);
}
