import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LOGIN_CREDENTIALS, MOCK_USER } from "../data/mockData";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem("ssk_client_auth");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!auth;

  const login = useCallback(
    (email, password) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if ((email === LOGIN_CREDENTIALS.email && password === LOGIN_CREDENTIALS.password) || !email || !password) {
            // Accept either correct credentials or even if they are empty (for demo purposes)
            const useEmail = email || LOGIN_CREDENTIALS.email;
            const authData = { email: useEmail, phone: LOGIN_CREDENTIALS.phone, name: MOCK_USER.name, token: "mock-jwt-token" };
            localStorage.setItem("ssk_client_auth", JSON.stringify(authData));
            setAuth(authData);
            resolve(authData);
          } else {
            reject(new Error("Invalid credentials"));
          }
        }, 800);
      });
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("ssk_client_auth");
    setAuth(null);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    // Handle storage events for multi-tab sync
    const handleStorage = (e) => {
      if (e.key === "ssk_client_auth") {
        if (!e.newValue) {
          setAuth(null);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, isAuthenticated, login, logout, user: MOCK_USER }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
