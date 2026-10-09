import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { ArrowLeft, Truck, Clock3, PackagePlus, Check, MapPin, ClipboardList, Gauge } from "lucide-react";
import StepIndicator from "../components/StepIndicator";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { clearWizardState } from "../store/bookingWizardSlice";
import { useTripJoinRequestSocket } from "../hooks/useTripJoinRequestSocket";

const POLL_MS = 5000;

// Rendered as step 5 of the booking wizard (BookTruck.jsx) for search_mode='part_load' ("Part
// Truck") bookings — the load-sharing counterpart to FindTruckSearch/ChooseBroker. Unlike
// those, there's no existing broadcast to wait on: this screen itself runs the search
// (GET /vehicles/trucks/nearby-on-trip — on-trip trucks with spare capacity heading roughly the
// right way, see gadidosti-backend's TruckModel.findOnTripForPartLoad), lets the client pick
// one, then creates a trip_join_requests row for the driver to accept/decline. No negotiation
// in v1 — the price shown per candidate is final, same as a normal quote.
export default function PartLoadSearch({ bookingId, bookingNumber, pickup, pickupLat, pickupLng, drop, dropLat, dropLng, weightTons, onBack }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const token = getToken();

  // 'candidates' — picking a truck; 'pending' — waiting on the driver; 'accepted' — done.
  const [phase, setPhase] = useState("candidates");
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidatesError, setCandidatesError] = useState(false);
  const [requestingId, setRequestingId] = useState(null);
  const [joinRequest, setJoinRequest] = useState(null);
  const pollRef = useRef(null);

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    setCandidatesError(false);
    try {
      const qs = new URLSearchParams({
        pickup_lat: pickupLat, pickup_lng: pickupLng, drop_lat: dropLat, drop_lng: dropLng, weight_tons: weightTons,
      });
      const res = await api.get(`/api/vehicles/trucks/nearby-on-trip?${qs}`, token);
      if (!res?.success) throw new Error(res?.message || "Failed to search for trucks");
      setCandidates(res.data?.trucks || []);
    } catch {
      setCandidatesError(true);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Resume-on-reload: if a request already exists for this booking (the client navigated away
  // mid-search and came back), pick up wherever it left off instead of starting a fresh search.
  // api.get never throws on a non-2xx status (see services/api.js) — a missing request comes
  // back as an ordinary { success: false } body (404), not an exception, so this checks
  // `res?.success` rather than try/catch.
  const checkExisting = async () => {
    const res = await api.get(`/api/trip-join-requests/booking/${bookingId}`, token);
    if (res?.success && res.data?.request) {
      const request = res.data.request;
      setJoinRequest(request);
      if (request.status === "accepted") setPhase("accepted");
      else if (request.status === "pending") setPhase("pending");
      else fetchCandidates();
      return;
    }
    fetchCandidates();
  };

  useEffect(() => {
    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (phase !== "pending" || !bookingId) return undefined;
    const poll = async () => {
      try {
        const res = await api.get(`/api/trip-join-requests/booking/${bookingId}`, token);
        if (res?.success && res.data?.request) applyRequestUpdate(res.data.request);
      } catch { /* silent — next poll retries */ }
    };
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bookingId]);

  const applyRequestUpdate = (request) => {
    setJoinRequest(request);
    if (request.status === "accepted") {
      setPhase("accepted");
    } else if (request.status === "declined") {
      toast.info("That driver declined — pick another truck.");
      setJoinRequest(null);
      setPhase("candidates");
      fetchCandidates();
    }
  };

  useTripJoinRequestSocket((payload) => {
    if (payload?.bookingId === bookingId) applyRequestUpdate(payload);
  });

  const handleRequestTruck = async (candidate) => {
    setRequestingId(candidate.truckId);
    try {
      const res = await api.post("/api/trip-join-requests", { booking_id: bookingId, target_trip_id: candidate.currentTripId }, token);
      if (!res?.success) throw new Error(res?.message || "Failed to send request");
      setJoinRequest(res.data?.request || null);
      setPhase("pending");
    } catch (err) {
      toast.error(err?.message || "Failed to request this truck — it may no longer be available.");
      fetchCandidates();
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col flex-1 lg:min-h-0 p-5 md:p-8">
        <StepIndicator currentStep={5} onStepClick={undefined} embedded />
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">
            {phase === "candidates" ? "Pick a truck to share" : phase === "pending" ? "Waiting for the driver" : "Load Confirmed!"}
          </h1>
        </div>
        <p className="text-sm text-neutral-400 mb-6 ml-12">{pickup} → {drop}</p>

        {phase === "candidates" && (
          loadingCandidates ? (
            <div className="flex items-center gap-2.5 justify-center py-10">
              <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-neutral-500">Looking for trucks already heading your way...</p>
            </div>
          ) : candidatesError ? (
            <div className="bg-red-50 rounded-xl p-4 text-sm text-danger flex items-center gap-2">
              <span>Couldn't load nearby trucks.</span>
              <button onClick={fetchCandidates} className="underline">Retry</button>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-10">
              <PackagePlus className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-700">No trucks available to share right now</p>
              <p className="text-xs text-neutral-400 mt-1 mb-4">Try again in a few minutes, or book a dedicated truck instead.</p>
              <button onClick={fetchCandidates} className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                Search Again
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <div key={c.truckId} className="border border-neutral-100 rounded-xl p-4 flex items-center gap-4">
                  <span className="w-11 h-11 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-teal-700" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{c.registration} · {c.driverName || "Driver"}</p>
                    <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-3 flex-wrap">
                      {c.distanceKm != null && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.distanceKm.toFixed(1)} km away</span>}
                      {c.etaMinutes != null && <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />~{c.etaMinutes} min</span>}
                      {c.spareTons != null && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{c.spareTons} ton spare</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-poppins font-bold text-lg text-primary tabular-nums">
                      ₹{Number(c.estimatedPrice?.total || 0).toLocaleString("en-IN")}
                    </p>
                    <button
                      onClick={() => handleRequestTruck(c)}
                      disabled={requestingId === c.truckId}
                      className="mt-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {requestingId === c.truckId ? "Requesting..." : "Request"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {phase === "pending" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <span className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
            <h2 className="font-poppins font-semibold text-base text-neutral-800 mb-1">
              {joinRequest?.truckReg ? `Waiting for ${joinRequest.driverName || "the driver"} (${joinRequest.truckReg})` : "Waiting for the driver to respond"}
            </h2>
            <p className="text-xs text-neutral-400 mb-1">This screen updates automatically once they accept or decline.</p>
            {joinRequest?.amount != null && (
              <p className="text-sm text-neutral-500 mt-3">
                Price: <span className="font-semibold text-primary">₹{Number(joinRequest.amount).toLocaleString("en-IN")}</span>
              </p>
            )}
          </div>
        )}

        {phase === "accepted" && (
          <div className="text-center py-8">
            <div className="animate-bounce-in mb-6 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center shadow-glow-green">
                <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                  <Check className="w-8 h-8 text-white" strokeWidth={3} />
                </div>
              </div>
            </div>
            <h2 className="font-poppins font-bold text-2xl text-success mb-2">Load Confirmed!</h2>
            <p className="text-sm text-neutral-400 mb-6">
              {joinRequest?.driverName || "Your driver"} will carry your load{joinRequest?.truckReg ? ` — truck ${joinRequest.truckReg}` : ""}.
            </p>
            <div className="bg-neutral-50 rounded-xl p-5 mb-6 max-w-xs mx-auto">
              <p className="text-xs text-neutral-400 mb-1 flex items-center justify-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> Booking ID</p>
              <p className="font-poppins font-bold text-2xl text-neutral-800">{bookingNumber}</p>
            </div>
            <div className="flex gap-3 max-w-xs mx-auto">
              <button onClick={() => { dispatch(clearWizardState()); navigate("/track"); }} className="flex-1 bg-primary text-white font-medium py-3 rounded-lg hover:bg-primary-dark transition-colors">
                Track Booking
              </button>
              <button onClick={() => { dispatch(clearWizardState()); navigate("/"); }} className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors">
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
