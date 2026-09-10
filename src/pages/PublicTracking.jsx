import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Clock, Check, AlertTriangle, Truck, Hash } from "lucide-react";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

// Same polling cadence TrackShipment.jsx uses for its own (authenticated) live tracking — kept
// in sync manually since there's no shared constant between the two pages.
const TRACK_POLL_MS = 7000;

// How long the mobile app-handoff attempt below gets before this page gives up and renders the
// same web view it would show on desktop. Standard "custom-scheme-with-timeout-fallback"
// pattern — if the OS actually had an app registered for gadidost://, it would switch away from
// this tab well before this fires; if nothing's registered (true for every device today — see
// the note below), the tab just stays put and this timer is what moves things along.
const APP_HANDOFF_TIMEOUT_MS = 1500;

// Deep link the SSK_Cargo Flutter app is *expected* to eventually register a handler for — it
// does not yet (as of this feature), so window.location.href-ing to this on any device today
// silently no-ops and this page falls straight through to its own web view below. Structured so
// wiring up the real thing later is just "the Flutter app adds an intent-filter/URL scheme for
// this" — nothing changes here.
const appDeepLink = (token) => `gadidost://track/${token}`;

// Intentionally left unset — there is no published Play Store/App Store listing for the app yet,
// so there is no real URL to send anyone to. Once the app ships, set these (as real env vars)
// and use them below instead of falling through to the web view when the deep-link attempt
// fails — until then, wiring up a redirect to a URL that doesn't exist would just be a dead link.
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || "";
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || "";

const isMobileUserAgent = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

const formatEta = (minutes) => {
  if (minutes == null) return "Calculating...";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const INCIDENT_REASON_LABELS = {
  accident: "an accident",
  breakdown: "a vehicle breakdown",
  traffic_block: "a traffic block",
  medical: "a medical issue",
  other: "an issue",
};

// Public, unauthenticated tracking page — reached only via a shared /t/:token link (see
// BookingDetail.jsx / TrackShipment.jsx's "Share Tracking" actions, and gadidosti-backend's
// GET /api/track/:token). Deliberately standalone: no Sidebar/TopBar/BottomNav, no login
// prompt, nothing that assumes whoever opened this link has (or needs) an account — this is
// registered outside every ProtectedRoute in App.jsx for exactly that reason. Also never
// attaches an auth token to its one API call, unlike literally every other screen in this app.
export default function PublicTracking() {
  const { token } = useParams();

  // On a phone, try to hand off to the native app first — on today's devices (no app published
  // yet, see appDeepLink above) this always falls through, but the structure is what matters:
  // once a real app registers the scheme, this same code starts working without changes here.
  const [attemptingApp, setAttemptingApp] = useState(() => isMobileUserAgent());

  useEffect(() => {
    if (!attemptingApp) return undefined;
    const timer = setTimeout(() => setAttemptingApp(false), APP_HANDOFF_TIMEOUT_MS);
    window.location.href = appDeepLink(token);
    return () => clearTimeout(timer);
  }, [attemptingApp, token]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetches regardless of the app-handoff attempt above so the web view is ready to render the
  // moment that attempt gives up, instead of waiting an extra round-trip. Deliberately no token
  // argument to api.get — this is the one call in the whole app that must stay unauthenticated.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.get(`/api/track/${token}`);
        if (cancelled) return;
        if (!res?.success || !res.data) {
          setNotFound(true);
          return;
        }
        setData(res.data);
        setNotFound(false);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    poll();
    // Stops polling once delivered/completed — same idea as TrackShipment.jsx's own gate, just
    // driven by the payload's own isTerminal flag instead of a separate status-label list.
    const interval = !data || !data.isTerminal ? setInterval(poll, TRACK_POLL_MS) : null;
    return () => { cancelled = true; if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data?.isTerminal]);

  const hasDriverLocation = data?.driverLat != null && data?.driverLng != null;

  if (attemptingApp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral p-6 text-center">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-400">Opening in the GadiDost app...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral p-6">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-sm text-neutral-400">Loading tracking details...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-danger/40 mb-3" />
        <h1 className="font-poppins font-semibold text-lg text-neutral-600 mb-1">Tracking link not found</h1>
        <p className="text-sm text-neutral-400">This link may have expired or is no longer valid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-5">
          <img src="/gadidost-logo.png" alt="GadiDost" className="w-8 h-8 rounded-lg bg-white p-1 flex-shrink-0 shadow-card" />
          <span className="font-poppins font-semibold text-sm text-neutral-700">GadiDost Logistics</span>
        </div>

        {data.incident && (
          <div className="bg-orange-50 border border-yellow-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-card">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                The driver reported {INCIDENT_REASON_LABELS[data.incident.reason] || "an issue"} — support has been notified.
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">We're arranging a solution and keeping this shipment updated.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-card p-5 mb-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
              <Hash className="w-3.5 h-3.5" /> {data.bookingNumber || "-"}
            </p>
            <StatusBadge status={data.status} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1 pb-1 flex-shrink-0 w-3">
              <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
              <span className="flex-1 w-0 border-l-2 border-dashed border-neutral-200 my-1" />
              <MapPin className="w-3.5 h-3.5 text-success flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Pickup</p>
                <p className="text-sm font-semibold text-neutral-800">{data.pickup || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wide">Drop-off</p>
                <p className="text-sm font-semibold text-neutral-800">{data.drop || "—"}</p>
              </div>
            </div>
          </div>

          {(data.driverName || data.truckReg) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-50">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-neutral-700">
                {[data.driverName, data.truckReg].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden h-[320px] md:h-[420px] relative">
          <MapView
            markers={
              hasDriverLocation
                ? [{
                    id: "truck",
                    position: { lat: Number(data.driverLat), lng: Number(data.driverLng) },
                    truckCategory: "medium",
                    heading: data.driverHeading,
                    iconSize: 44,
                    title: data.isTerminal ? "Delivered here" : "Truck",
                  }]
                : []
            }
            height="100%"
            className="absolute inset-0"
          />

          {!hasDriverLocation && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/80 pointer-events-none">
              <p className="text-sm text-neutral-400">Live location isn't available yet.</p>
            </div>
          )}

          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg pointer-events-none text-white text-xs font-semibold" style={{ background: data.isTerminal ? "#166534" : "#16a34a" }}>
            {data.isTerminal ? <Check className="w-3 h-3" strokeWidth={3} /> : <span className="w-2 h-2 rounded-full bg-white animate-green-pulse" />}
            {data.isTerminal ? "Delivered" : "Live Tracking"}
          </div>

          <div className="absolute bottom-5 right-5 z-10 bg-white/90 backdrop-blur-md border border-white/60 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {data.isTerminal ? <Check className="w-5 h-5 text-primary" strokeWidth={3} /> : <Clock className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide leading-none mb-1">
                {data.isTerminal ? "Delivered At" : "Estimated Arrival"}
              </p>
              <p className="font-poppins font-bold text-base text-neutral-800 leading-none">
                {data.isTerminal ? (formatDateTime(data.deliveredAt) || "—") : formatEta(data.etaMinutes)}
              </p>
              {!data.isTerminal && data.distanceRemainingKm != null && (
                <p className="text-[10px] text-neutral-400 mt-0.5">{data.distanceRemainingKm} km remaining</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-300 mt-5">Shared via GadiDost Logistics</p>
      </div>
    </div>
  );
}
