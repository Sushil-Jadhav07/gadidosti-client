import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { setStoredFcmToken } from "../utils";
import { requestFcmToken, listenForegroundMessages } from "../lib/firebase";

// Registers this device for push (POST /api/users/device-token) once logged in, and toasts
// foreground pushes (a tab that's open and focused doesn't get an OS notification on its own —
// see src/lib/firebase.js's listenForegroundMessages). Mounted once in App.jsx.
//
// Logout's unregister call (DELETE /api/users/device-token) lives in AuthContext.jsx instead of
// here — it needs the access token while it's still valid, and this hook's own cleanup only
// runs after isAuthenticated has already flipped false, by which point AuthContext has cleared it.
export default function usePushNotifications() {
  const { isAuthenticated, tokens } = useAuth();
  const toast = useToast();
  const accessToken = tokens?.access_token;
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let cancelled = false;

    (async () => {
      const fcmToken = await requestFcmToken();
      if (cancelled || !fcmToken) return;
      setStoredFcmToken(fcmToken);
      try {
        await api.post("/api/users/device-token", { token: fcmToken, platform: "web" }, accessToken);
      } catch {
        // Best-effort — a failed registration just means this device won't get pushes.
      }
    })();

    listenForegroundMessages((payload) => {
      const { title, body } = payload.notification || {};
      toast.info(body || "You have a new notification", title);
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else unsubscribeRef.current = unsubscribe;
    });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);
}
