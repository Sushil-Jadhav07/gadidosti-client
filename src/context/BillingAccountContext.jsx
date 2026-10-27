import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken } from "../services/api";
import { useAuth } from "./AuthContext";

const BillingAccountContext = createContext({ billingType: "prepaid", creditLimit: null, outstanding: 0, loading: true, refresh: () => {} });

// Fetched once per authenticated session (not trusted off the cached login user object, same
// reasoning as KycStatusContext — billing type can change mid-session) — what Sidebar/BottomNav
// use to decide whether "My Bills" shows up at all, since it's only relevant for a postpaid
// client. A prepaid client (the default, and everyone unaffected by this feature) never sees it.
export function BillingAccountProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [billingType, setBillingType] = useState("prepaid");
  const [creditLimit, setCreditLimit] = useState(null);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await api.get("/api/bills/account", token);
      if (res?.success) {
        setBillingType(res.data.billing_type);
        setCreditLimit(res.data.credit_limit);
        setOutstanding(res.data.outstanding);
      }
    } catch { /* leave whatever we already have */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setBillingType("prepaid");
      setCreditLimit(null);
      setOutstanding(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, refresh]);

  return (
    <BillingAccountContext.Provider value={{ billingType, creditLimit, outstanding, loading, refresh }}>
      {children}
    </BillingAccountContext.Provider>
  );
}

export function useBillingAccount() {
  return useContext(BillingAccountContext);
}
