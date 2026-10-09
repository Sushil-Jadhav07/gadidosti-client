import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Live push for a part-load join request's status — the backend emits
// 'trip-join-request-updated' straight to the client's own socket room on accept/decline (see
// gadidosti-backend's tripJoinRequest.controller.js). Same shape as useDriverRequestSocket;
// separate hook since it's a genuinely different event on a different table.
export function useTripJoinRequestSocket(onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("trip-join-request-updated", (request) => onUpdateRef.current?.(request));

    return () => socket.disconnect();
  }, []);
}
