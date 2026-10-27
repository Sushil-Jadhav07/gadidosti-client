import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken } from "../services/api";
import { useAuth } from "./AuthContext";

const KycStatusContext = createContext({ kycStatus: null, loading: true, refresh: () => {} });

// Fetched once per authenticated session (not trusted off the cached auth user, since this can
// change mid-session — see Verification.jsx, which calls refresh() after every successful
// check) and shared by every route that needs it: BookTruck.jsx's booking-confirm gate and
// App.jsx's KycGate, which locks every page except Dashboard/Profile/Chat/Verification until
// this is 'verified'. One fetch instead of each gate re-querying independently.
export function KycStatusProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await api.get("/api/kyc/status", token);
      if (res?.success) setKycStatus(res.data.kyc_status);
    } catch { /* leave whatever we already have */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setKycStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, refresh]);

  return (
    <KycStatusContext.Provider value={{ kycStatus, loading, refresh }}>
      {children}
    </KycStatusContext.Provider>
  );
}

export function useKycStatus() {
  return useContext(KycStatusContext);
}
