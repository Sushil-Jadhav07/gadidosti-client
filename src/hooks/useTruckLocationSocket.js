import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Real-time position for a single truck, via the same join-truck-tracking room / truck-location
// event NearbyTrucksMap.jsx already uses during the booking Truck step (see
// gadidosti-backend's vehicle.controller.js updateDriverLocation, which emits it on every
// driver location ping). This is the primary path for TrackShipment's live marker — its own 7s
// REST poll (TRACK_POLL_MS) keeps running underneath as a fallback, so location doesn't go
// fully silent if the socket drops.
//
// Pass null/undefined for truckId (e.g. no truck assigned yet, or the booking isn't in a live
// tracking status) to skip connecting entirely.
export function useTruckLocationSocket(truckId, onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!truckId) return undefined;
    const token = getToken();
    if (!token) return undefined;

    const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      socket.emit("join-truck-tracking", { truckId }, () => {});
    });
    socket.on("truck-location", (payload) => {
      if (String(payload?.truckId) !== String(truckId)) return;
      onUpdateRef.current?.(payload);
    });

    return () => {
      socket.emit("leave-truck-tracking", { truckId });
      socket.disconnect();
    };
  }, [truckId]);
}
