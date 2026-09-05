import { useEffect, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, MapPin, Building2, Phone, AlertCircle, PackagePlus, PackageMinus, LocateFixed,
} from "lucide-react";
import MapView from "../components/MapView";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

const EMPTY_FORM = {
  label: "", address: "", floor: "", lat: null, lng: null, city: "",
  addressType: "pickup", contactName: "", contactPhone: "",
};

const TYPE_META = {
  pickup: { label: "Pickup", Icon: PackagePlus },
  dropoff: { label: "Drop-off", Icon: PackageMinus },
};

// Full-page add/edit — replaces the old BottomSheet modal so there's room for a real map (pick
// by search, by tapping, or by dragging the pin to fine-tune) instead of a cramped 160px
// preview, same reasoning as BookingDetail.jsx's own move off a modal. There's no
// GET /api/addresses/:id — editing reads the address from the list page's navigation state
// (fast path) and falls back to re-fetching the whole list and finding it by id (a direct link
// or a page refresh loses that state).
export default function AddressForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const token = getToken();

  const [form, setForm] = useState(() => location.state?.address ? {
    label: location.state.address.label,
    address: location.state.address.address,
    floor: location.state.address.floor || "",
    lat: location.state.address.lat,
    lng: location.state.address.lng,
    city: location.state.address.city || "",
    addressType: location.state.address.addressType || "pickup",
    contactName: location.state.address.contactName || "",
    contactPhone: location.state.address.contactPhone || "",
  } : EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing && !location.state?.address);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [myLocation, setMyLocation] = useState(null);

  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    if (!isEditing || location.state?.address) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/addresses", token);
        if (cancelled) return;
        const found = (res?.data?.addresses || []).find((a) => a.id === id);
        if (!found) throw new Error("Address not found");
        setForm({
          label: found.label, address: found.address, floor: found.floor || "",
          lat: found.lat, lng: found.lng, city: found.city || "",
          addressType: found.addressType || "pickup",
          contactName: found.contactName || "", contactPhone: found.contactPhone || "",
        });
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live blue dot while this page is open — same UX as BookTruck's Step 1, so picking a saved
  // address feels like the same map interaction throughout the app.
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const reverseGeocode = async (lat, lng) => {
    const geocoder = new window.google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    const result = results?.[0];
    const address = result?.formatted_address?.replace(/,\s*India$/, "") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const components = result?.address_components || [];
    const city = components.find((c) => c.types?.includes("locality"))?.long_name
      || components.find((c) => c.types?.includes("administrative_area_level_2"))?.long_name
      || null;
    return { address, city };
  };

  const applyPoint = async (lat, lng) => {
    if (!mapsLoaded || !window.google?.maps) return;
    try {
      const { address, city } = await reverseGeocode(lat, lng);
      setForm((f) => ({ ...f, address, lat, lng, city: city || f.city }));
    } catch {
      toast.error("Couldn't resolve an address for that point");
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device or browser");
    navigator.geolocation.getCurrentPosition(
      (pos) => applyPoint(pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Couldn't get your current location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePlaceSelect = ({ address, lat, lng, city }) => {
    setForm((f) => ({ ...f, address, lat, lng, city: city || f.city }));
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.label.trim()) return setFormError("Give this address a name, e.g. \"Home\" or \"Warehouse\"");
    if (!form.address.trim()) return setFormError("Search, tap the map, or use your current location to set an address");

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        address: form.address.trim(),
        floor: form.floor.trim() || undefined,
        lat: form.lat,
        lng: form.lng,
        city: form.city || undefined,
        address_type: form.addressType,
        contact_name: form.contactName.trim() || undefined,
        contact_phone: form.contactPhone.trim() || undefined,
      };
      const res = isEditing
        ? await api.patch(`/api/addresses/${id}`, payload, token)
        : await api.post("/api/addresses", payload, token);
      if (!res?.success) throw new Error(res?.message || "Failed to save address");

      toast.success(isEditing ? "Address updated" : "Address saved");
      navigate("/addresses");
    } catch (err) {
      setFormError(err.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center py-24">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-sm text-neutral-400">Loading address...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto text-center py-16">
        <p className="text-sm text-neutral-400 mb-3">Couldn't load this address.</p>
        <button onClick={() => navigate("/addresses")} className="text-sm font-semibold text-primary hover:underline">Back to Saved Addresses</button>
      </div>
    );
  }

  const hasPoint = form.lat != null && form.lng != null;

  return (
    <div className="h-full flex flex-col p-1 animate-page-enter">
      <div className="flex items-center gap-3 mb-5 px-3 pt-3">
        <button
          onClick={() => navigate("/addresses")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-card text-neutral-500 hover:text-neutral-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">
          {isEditing ? "Edit Address" : "Add Address"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 items-stretch flex-1 lg:min-h-0 px-3 pb-3">
        {/* Left: form */}
        <div className="bg-white rounded-2xl shadow-card flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 md:p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_META).map(([key, { label, Icon }]) => (
                  <button
                    key={key}
                    onClick={() => setForm((f) => ({ ...f, addressType: key }))}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.addressType === key ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-500 hover:border-neutral-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Name</label>
              <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                <Building2 className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Home, Office, Warehouse 2"
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide">Address</label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <LocateFixed className="w-3 h-3" /> Use current location
                </button>
              </div>
              <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                <MapPin className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
                <PlacesAutocompleteInput
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v, lat: null, lng: null }))}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Search, or tap the map on the right..."
                  className="bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 w-full"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1.5">Search, tap the map, or drag the pin once it's placed — any of those saves the exact location.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                Floor / Unit <span className="text-neutral-300 font-normal normal-case">(optional)</span>
              </label>
              <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                <input
                  type="text"
                  value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                  placeholder="e.g. 3rd Floor, Flat 402, Gate 2"
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                  Contact Name <span className="text-neutral-300 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                    placeholder="On-site contact"
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    maxLength={60}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
                  Contact Phone <span className="text-neutral-300 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                  <Phone className="w-3.5 h-3.5 text-neutral-300 mr-2 flex-shrink-0" />
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="+91"
                    className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <div className="p-5 md:p-6 pt-0 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
              ) : isEditing ? "Save Changes" : "Save Address"}
            </button>
          </div>
        </div>

        {/* Right: map — tap to set the pin, or drag it once placed to fine-tune */}
        <div className="relative rounded-2xl shadow-card overflow-hidden lg:sticky lg:top-6 h-full min-h-[320px]">
          <MapView
            markers={hasPoint ? [{
              id: "picked",
              position: { lat: form.lat, lng: form.lng },
              color: form.addressType === "pickup" ? "blue" : "green",
              title: form.address,
              draggable: true,
              onDragEnd: (pt) => applyPoint(pt.lat, pt.lng),
            }] : []}
            onMapClick={(pt) => applyPoint(pt.lat, pt.lng)}
            myLocation={myLocation}
            suppressRouteMarkers
            height="100%"
            className="absolute inset-0"
            zoom={hasPoint ? 15 : undefined}
          />
        </div>
      </div>
    </div>
  );
}
