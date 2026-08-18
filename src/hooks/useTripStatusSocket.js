import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Live push the instant a trip's status changes (picked up, in transit, delivered, etc.) — the
// backend emits 'trip-status-updated' straight to the client's own socket room (see
// gadidosti-backend's trip.controller.js emitTripStatusUpdate) on every
// PATCH /api/trips/:id/status call, to the booking's client, broker, and driver alike. Same
// connect/auth/cleanup shape as useDriverRequestSocket.js/useJobRequestSocket.js.
export function useTripStatusSocket(onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("trip-status-updated", (trip) => onUpdateRef.current?.(trip));

    return () => socket.disconnect();
  }, []);
}
