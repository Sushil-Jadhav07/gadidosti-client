import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "../services/api";
import { getStoredFcmToken, clearStoredFcmToken } from "../utils";

const AuthContext = createContext(null);

const STORAGE_KEY = "ssk_client_auth";

const loadStoredSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadStoredSession);

  const isAuthenticated = !!(session?.user);

  const persistSession = useCallback((user, tokens) => {
    const data = { user, tokens };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/api/auth/login", { email, password });
    if (!data.success) throw new Error(data.message || "Login failed");
    if (data.data.user.role !== "client") throw new Error("Not a client account. Please use the correct portal.");
    persistSession(data.data.user, data.data.tokens);
    return data.data.user;
  }, [persistSession]);

  const googleLogin = useCallback(async (idToken) => {
    const data = await api.post("/api/auth/google", { id_token: idToken, role: "client" });
    if (!data.success) throw new Error(data.message || "Google Sign-In failed");
    if (data.data.user.role !== "client") throw new Error("This Google account is registered under a different portal. Please use the correct portal.");
    persistSession(data.data.user, data.data.tokens);
    return { user: data.data.user, needs_phone: !!data.data.needs_phone };
  }, [persistSession]);

  const register = useCallback(async ({ name, email, phone, password }) => {
    const data = await api.post("/api/auth/register", { name, email, phone: phone || undefined, password, role: "client" });
    if (!data.success) throw new Error(data.message || "Registration failed");
    return data.data;
  }, []);

  const updateProfile = useCallback(async ({ name, email, address, company_name }) => {
    if (!session?.tokens) throw new Error("Not authenticated");
    const data = await api.patch("/api/users/profile", { name, email, address, company_name }, session.tokens.access_token);
    if (!data.success) throw new Error(data.message || "Failed to update profile");
    persistSession(data.data.user, session.tokens);
    return data.data.user;
  }, [session, persistSession]);

  const changePassword = useCallback(async (current_password, new_password) => {
    if (!session?.tokens) throw new Error("Not authenticated");
    const data = await api.patch("/api/users/change-password", { current_password, new_password }, session.tokens.access_token);
    if (!data.success) throw new Error(data.message || "Failed to change password");
    return data.data;
  }, [session]);

  // Clears the local session immediately rather than waiting on the network call —
  // api.js's fetch wrapper has no timeout, so if the backend is slow/unreachable this
  // would otherwise hang forever with clearSession() never running, making Sign Out
  // look like it does nothing. The server-side token revocation is best-effort and
  // fired in the background; it doesn't need to block the user from being signed out.
  const logout = useCallback(async () => {
    const tokens = session?.tokens;
    const fcmToken = getStoredFcmToken();
    clearSession();
    if (tokens) {
      api.post("/api/auth/logout", { refresh_token: tokens.refresh_token }, tokens.access_token).catch(() => {});
      // Best-effort, same as the /api/auth/logout call above — read while the access token
      // (captured above, before clearSession) is still valid to authenticate the request.
      if (fcmToken) {
        api.delete("/api/users/device-token", { token: fcmToken }, tokens.access_token).catch(() => {});
        clearStoredFcmToken();
      }
    }
  }, [session, clearSession]);

  // Deliberately does NOT clearSession() on failure — SessionExpiredModal.jsx (the only
  // caller) needs the stale session left in place while it shows an inline re-login popup;
  // clearing it here would flip isAuthenticated false immediately and ProtectedRoute would
  // yank the user to /login out from under that popup, exactly the jarring navigation it
  // exists to avoid. The caller decides what happens next on a false return.
  const refreshTokens = useCallback(async () => {
    if (!session?.tokens?.refresh_token) return false;
    try {
      const data = await api.post("/api/auth/refresh-token", { refresh_token: session.tokens.refresh_token });
      if (data.success) {
        persistSession(session.user, data.data.tokens);
        return true;
      }
    } catch {}
    return false;
  }, [session, persistSession]);

  const forgotPassword = useCallback(async (phone) => {
    const data = await api.post("/api/auth/forgot-password", { phone });
    if (!data.success) throw new Error(data.message || "Phone number not found");
    return data.data;
  }, []);

  const resetPassword = useCallback(async (phone, otp, new_password) => {
    const data = await api.post("/api/auth/reset-password", { phone, otp, new_password });
    if (!data.success) throw new Error(data.message || "Reset failed");
    return data.data;
  }, []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setSession(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        auth: session,
        user: session?.user || null,
        tokens: session?.tokens || null,
        isAuthenticated,
        login,
        googleLogin,
        register,
        updateProfile,
        changePassword,
        logout,
        refreshTokens,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
