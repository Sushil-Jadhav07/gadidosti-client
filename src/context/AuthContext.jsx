import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "../services/api";

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

  const sendOtp = useCallback(async (phone) => {
    const data = await api.post("/api/auth/otp/send", { phone, purpose: "phone_verify" });
    if (!data.success) throw new Error(data.message || "Failed to send OTP");
    return data.data;
  }, []);

  const verifyOtp = useCallback(async (phone, otp) => {
    const data = await api.post("/api/auth/otp/verify", { phone, otp, purpose: "phone_verify" });
    if (!data.success) throw new Error(data.message || "Invalid or expired OTP");
    return data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (session?.tokens) {
        await api.post("/api/auth/logout", { refresh_token: session.tokens.refresh_token }, session.tokens.access_token);
      }
    } catch {}
    clearSession();
  }, [session, clearSession]);

  const refreshTokens = useCallback(async () => {
    if (!session?.tokens?.refresh_token) return false;
    try {
      const data = await api.post("/api/auth/refresh-token", { refresh_token: session.tokens.refresh_token });
      if (data.success) {
        persistSession(session.user, data.data.tokens);
        return true;
      }
    } catch {}
    clearSession();
    return false;
  }, [session, persistSession, clearSession]);

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
        sendOtp,
        verifyOtp,
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
