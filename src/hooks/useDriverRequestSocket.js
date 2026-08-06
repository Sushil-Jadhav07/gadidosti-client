import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Live push for the driver-request negotiation flow (direct client-pick + broker-assign
// origins) — the backend emits 'driver-request-updated' straight to the acting user's own
// socket room (see gadidosti-backend's realtime/socket.js auto-join +
// driverRequest.controller.js's emitDriverRequestUpdate) on every accept/decline/counter/
// timeout. Callers still poll as a fallback in case the socket connection drops — this just
// makes updates arrive immediately instead of waiting for the next poll tick. Same
// connect/auth/cleanup shape as ChatWindow.jsx's inline socket, pulled out here since more
// than one screen needs it.
export function useDriverRequestSocket(onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("driver-request-updated", (request) => onUpdateRef.current?.(request));

    return () => socket.disconnect();
  }, []);
}
