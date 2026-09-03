import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PREVIEW_LENGTH = 80;

// App-wide, always-on socket connection — separate from any ChatWindow's own (which only exists
// while a specific thread is open) — listening for 'chat-message' on this user's own auto-joined
// `user:{id}` room, so a new message toasts no matter which page is open. Same shape/precedent as
// usePushNotifications.js's foreground-push toast; mounted once in App.jsx.
export default function ChatNotificationListener() {
  const { isAuthenticated, tokens } = useAuth();
  const toast = useToast();
  const socketRef = useRef(null);
  const accessToken = tokens?.access_token;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return undefined;

    const socket = io(BASE, { auth: { token: accessToken }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("chat-message", (msg) => {
      const text = msg?.message || "";
      const preview = text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text;
      toast.info(preview, `New message from ${msg?.senderName || "Support"}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);

  return null;
}
