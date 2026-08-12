import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Live push for the broker-broadcast negotiation flow — the backend emits
// 'job-request-updated' straight to the acting user's own socket room (see
// gadidosti-backend's job.controller.js emitJobRequestUpdate) on every decline/counter/
// client-accept/client-reject/client-counter/accept. Same connect/auth/cleanup shape as
// useDriverRequestSocket.js.
export function useJobRequestSocket(onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("job-request-updated", (request) => onUpdateRef.current?.(request));

    return () => socket.disconnect();
  }, []);
}
