import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Plus, Pencil, Trash2, Star, Building2, AlertCircle,
  Search, SlidersHorizontal, LayoutGrid, List, PackagePlus, PackageMinus, Phone,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import MapView from "../components/MapView";
import PlacesAutocompleteInput from "../components/PlacesAutocompleteInput";
import { useToast } from "../context/ToastContext";
import { api, getToken } from "../services/api";

const EMPTY_FORM = {
  label: "", address: "", floor: "", lat: null, lng: null, city: "",
  addressType: "pickup", contactName: "", contactPhone: "",
};

const TYPE_META = {
  pickup: { label: "Pickup", Icon: PackagePlus, className: "bg-primary-50 text-primary" },
  dropoff: { label: "Drop-off", Icon: PackageMinus, className: "bg-neutral-100 text-neutral-500" },
};

const initials = (name) => (name || "").trim().split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "—";

// A client's saved pickup/drop points — named ("Home", "Warehouse 2"), typed (Pickup/Drop-off,
// like BookTruck.jsx's own loading/unloading stops), picked via the same Google Places search
// BookTruck.jsx's pickup/drop fields use, with an optional floor/unit detail and an on-site
// contact person — mirrors trips.pickup_contact_person/phone, reused the same way here.
export default function SavedAddresses() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = getToken();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [view, setView] = useState("grid");

  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/addresses", token);
      if (!res?.success) throw new Error(res?.message);
      setAddresses(res.data?.addresses || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return addresses.filter((a) => {
      if (typeFilter !== "all" && a.addressType !== typeFilter) return false;
      if (!q) return true;
      return [a.label, a.address, a.contactName, a.contactPhone].some((v) => v?.toLowerCase().includes(q));
    });
  }, [addresses, query, typeFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowSheet(true);
  };

  const openEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label, address: addr.address, floor: addr.floor || "",
      lat: addr.lat, lng: addr.lng, city: addr.city || "",
      addressType: addr.addressType || "pickup",
      contactName: addr.contactName || "", contactPhone: addr.contactPhone || "",
    });
    setFormError("");
    setShowSheet(true);
  };

  const handlePlaceSelect = ({ address, lat, lng, city }) => {
    setForm((f) => ({ ...f, address, lat, lng, city: city || f.city }));
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.label.trim()) return setFormError("Give this address a name, e.g. \"Home\" or \"Warehouse\"");
    if (!form.address.trim()) return setFormError("Search and select an address from Google Maps");

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
      const res = editingId
        ? await api.patch(`/api/addresses/${editingId}`, payload, token)
        : await api.post("/api/addresses", payload, token);
      if (!res?.success) throw new Error(res?.message || "Failed to save address");

      if (editingId) {
        setAddresses((current) => current.map((a) => (a.id === editingId ? res.data.address : a)));
      } else {
        setAddresses((current) => [res.data.address, ...current]);
      }
      toast.success(editingId ? "Address updated" : "Address saved");
      setShowSheet(false);
    } catch (err) {
      setFormError(err.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      const res = await api.patch(`/api/addresses/${id}/default`, {}, token);
      if (!res?.success) throw new Error(res?.message);
      setAddresses((current) => current.map((a) => ({ ...a, isDefault: a.id === id })));
    } catch (err) {
      toast.error(err.message || "Failed to set default");
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const res = await api.delete(`/api/addresses/${id}`, null, token);
      if (!res?.success) throw new Error(res?.message);
      await load();
      toast.success("Address removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove address");
    } finally {
      setDeletingId(null);
    }
  };

  const AddressActions = ({ addr, className = "" }) => (
    <div className={`flex items-center gap-1 flex-shrink-0 ${className}`}>
      {!addr.isDefault && (
        <button
          onClick={() => handleSetDefault(addr.id)}
          title="Set as default"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-primary hover:bg-primary-50 transition-colors"
        >
          <Star className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={() => openEdit(addr)}
        title="Edit"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleDelete(addr.id)}
        disabled={deletingId === addr.id}
        title="Remove"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-danger hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-poppins font-bold text-2xl md:text-[28px] text-neutral-800">Saved Addresses</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Manage your frequent pickup and drop-off locations.</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-white hover:text-primary 
          border border-primary hover:border-primary
          hover:ring-1 hover:ring-primary
          transition-colors flex-shrink-0"
        >
          <MapPin className="w-4 h-4" /> Add New Address
        </button>
      </div>

      {/* Search + Filter + View toggle */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex-1 flex items-center bg-white border border-neutral-200 rounded-lg px-4 py-2.5 shadow-card min-w-0">
          <Search className="w-4 h-4 text-neutral-300 mr-2.5 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, address, or contact..."
            className="flex-1 min-w-0 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-300"
          />
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-2.5 bg-white border rounded-lg text-sm font-medium transition-colors ${
              typeFilter !== "all" ? "border-primary text-primary" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filter
          </button>
          {showFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-card-hover border border-neutral-100 py-1.5 z-20">
                {[
                  { id: "all", label: "All Addresses" },
                  { id: "pickup", label: "Pickup" },
                  { id: "dropoff", label: "Drop-off" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setTypeFilter(opt.id); setShowFilter(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                      typeFilter === opt.id ? "text-primary font-semibold" : "text-neutral-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-1 flex-shrink-0">
          <button
            onClick={() => setView("grid")}
            title="Grid view"
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${view === "grid" ? "bg-primary-50 text-primary" : "text-neutral-300 hover:text-neutral-500"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("list")}
            title="List view"
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${view === "list" ? "bg-primary-50 text-primary" : "text-neutral-300 hover:text-neutral-500"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 skeleton-shimmer animate-shimmer rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-neutral-400 mb-3">Couldn't load your saved addresses</p>
          <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-poppins font-semibold text-neutral-800 mb-1">No saved addresses yet</h3>
          <p className="text-sm text-neutral-400 mb-5">Save your frequent pickup/drop points to fill them in faster next time you book.</p>
          <button onClick={openAdd} className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
            Add Your First Address
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <p className="text-sm text-neutral-400">No addresses match your search.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((addr) => {
            const type = TYPE_META[addr.addressType] || TYPE_META.pickup;
            return (
              <div key={addr.id} className="group relative bg-white rounded-2xl shadow-card border border-neutral-100 p-4 flex flex-col hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ${type.className}`}>
                    <type.Icon className="w-3 h-3" /> {type.label}
                  </span>
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                      <Star className="w-3 h-3 fill-primary" /> Default
                    </span>
                  )}
                </div>

                <h3 className="font-poppins font-semibold text-[15px] text-neutral-800 leading-snug mb-1">{addr.label}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 flex-1">{addr.address}</p>
                {addr.floor && <p className="text-[11px] text-neutral-400 mt-1">{addr.floor}</p>}

                {(addr.contactName || addr.contactPhone) && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-50">
                    <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-neutral-500">{initials(addr.contactName)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-700 truncate">{addr.contactName || "—"}</p>
                      {addr.contactPhone && (
                        <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" /> {addr.contactPhone}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <AddressActions addr={addr} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-white/95 rounded-lg shadow-card transition-opacity" />
              </div>
            );
          })}

          <button
            onClick={openAdd}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-center p-4 min-h-[176px] hover:border-primary hover:bg-primary-50/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-primary">Add Address</p>
            <p className="text-xs text-neutral-400">Create a new saved location</p>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((addr) => {
            const type = TYPE_META[addr.addressType] || TYPE_META.pickup;
            return (
              <div key={addr.id} className="bg-white rounded-xl shadow-card p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${type.className}`}>
                  <type.Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-800">{addr.label}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${type.className}`}>{type.label}</span>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary-50 px-1.5 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5 fill-primary" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{addr.address}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {addr.floor && <p className="text-[11px] text-neutral-400">{addr.floor}</p>}
                    {addr.contactName && (
                      <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                        {addr.contactName}{addr.contactPhone ? ` · ${addr.contactPhone}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <AddressActions addr={addr} />
              </div>
            );
          })}
        </div>
      )}

      <BottomSheet isOpen={showSheet} onClose={() => setShowSheet(false)}>
        <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-5">
          {editingId ? "Edit Address" : "Add Address"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_META).map(([id, { label, Icon }]) => (
                <button
                  key={id}
                  onClick={() => setForm((f) => ({ ...f, addressType: id }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.addressType === id ? "border-primary bg-primary-50 text-primary" : "border-neutral-100 text-neutral-500 hover:border-neutral-200"
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
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Address</label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <MapPin className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <PlacesAutocompleteInput
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v, lat: null, lng: null }))}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Search on Google Maps..."
                className="bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300 w-full"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1.5">Pick a result from the search — that's what saves the exact map location.</p>
          </div>

          {form.lat != null && form.lng != null && (
            <MapView
              markers={[{ id: "picked", position: { lat: form.lat, lng: form.lng }, color: "blue", title: form.address }]}
              height="160px"
              className="rounded-xl overflow-hidden"
              zoom={15}
            />
          )}

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

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : editingId ? "Save Changes" : "Save Address"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
