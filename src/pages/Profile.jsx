import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Receipt, MapPin, CreditCard, Bell, Headphones, FileText,
  LogOut, ChevronRight, Phone, Mail, Pencil, Package, Wallet, CalendarDays,
  Building2, Lock, Eye, EyeOff, AlertCircle, KeyRound,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNotifications } from "../hooks/useNotifications";
import { api, getToken } from "../services/api";
import { adaptBooking, formatDate } from "../utils";

const MENU_SECTIONS = [
  {
    title: "Shipments",
    items: [
      { icon: ClipboardList, label: "My Bookings", path: "/bookings" },
      { icon: Receipt, label: "My Invoices", action: "coming_soon" },
    ],
  },
  {
    title: "Account",
    items: [
      { icon: MapPin, label: "Saved Addresses", path: "/addresses" },
      { icon: CreditCard, label: "Payment Methods", path: "/payment-methods" },
      { icon: Bell, label: "Notifications", path: "/notifications" },
      { icon: KeyRound, label: "Change Password", action: "change_password" },
    ],
  },
  {
    title: "Help",
    items: [
      { icon: Headphones, label: "Help & Support", action: "coming_soon" },
      { icon: FileText, label: "Terms & Privacy", action: "coming_soon" },
    ],
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateProfile, changePassword } = useAuth();
  const toast = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const token = getToken();

  const profileData = profile || user;

  const initials = profileData?.name
    ? profileData.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'RK';

  const totalBookings = bookings.length;
  const totalSpent = bookings.filter((b) => b.status !== "Cancelled").reduce((sum, b) => sum + b.amount, 0);
  const delivered = bookings.filter((b) => b.status === "Delivered" || b.status === "Completed").length;

  const loadProfileData = async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const [profileRes, bookingsRes] = await Promise.all([
        api.get("/api/users/profile", token),
        api.get("/api/bookings?limit=100", token),
      ]);
      if (profileRes?.success && profileRes.data?.user) setProfile(profileRes.data.user);
      if (bookingsRes?.success) {
        setBookings((bookingsRes.data?.bookings || bookingsRes.data || []).map(adaptBooking));
      }
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Edit profile ──
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", address: "", company_name: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const openEditSheet = () => {
    setEditForm({
      name: user?.name || "",
      email: user?.email || "",
      address: user?.address || "",
      company_name: user?.company_name || "",
    });
    setEditError("");
    setShowEditSheet(true);
  };

  const handleSaveProfile = async () => {
    setEditError("");
    setEditSaving(true);
    try {
      await updateProfile(editForm);
      toast.success("Profile updated successfully");
      setShowEditSheet(false);
    } catch (err) {
      setEditError(err.message || "Failed to update profile");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Change password ──
  const [showPwSheet, setShowPwSheet] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const handleChangePassword = async () => {
    setPwError("");
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      return setPwError("Please fill all password fields");
    }
    if (passwords.next !== passwords.confirm) {
      return setPwError("New passwords do not match");
    }
    if (passwords.next.length < 6) {
      return setPwError("Password must be at least 6 characters");
    }
    setPwSaving(true);
    try {
      await changePassword(passwords.current, passwords.next);
      toast.success("Password updated successfully");
      setPasswords({ current: "", next: "", confirm: "" });
      setShowPwSheet(false);
    } catch (err) {
      setPwError(err.message || "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  // Unread count still drives the little badge on the "Notifications" menu row below — the
  // full list itself now lives at /notifications (see Notifications.jsx) instead of a sheet
  // here, so `auto: false` skips this hook's own poll-on-mount fetch (Notifications.jsx does
  // its own fetch when it mounts); this one just needs the count, refreshed on every Profile visit.
  const { unreadCount, fetchNotifications } = useNotifications({ auto: false });
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMenuClick = (item) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.action === "change_password") {
      setPwError("");
      setShowPwSheet(true);
    } else if (item.action === "coming_soon") {
      toast.info("This feature is coming soon!");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("You have been logged out successfully");
    navigate("/login");
  };

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        {/* Left — User Card */}
        <div className="lg:col-span-1 space-y-5">
          {/* Profile Card */}
          <div className="bg-secondary rounded-2xl overflow-hidden relative">
            {/* Glow */}
            <div
              className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-15"
              style={{ background: "radial-gradient(circle, rgba(25,118,255,0.5) 0%, transparent 70%)" }}
            />

            <div className="relative z-10 p-6 text-center">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-primary/25 border-[3px] border-primary/40 flex items-center justify-center shadow-glow-blue mx-auto mb-4">
                <span className="font-poppins font-bold text-2xl text-white">{initials}</span>
              </div>

              <h2 className="font-poppins font-semibold text-xl text-white mb-1">
                {profileData?.name || "—"}
              </h2>

              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Phone className="w-3 h-3 text-white/50" />
                <span className="text-xs text-white/50">{profileData?.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <Mail className="w-3 h-3 text-white/50" />
                <span className="text-xs text-white/50">{profileData?.email || "Not provided"}</span>
              </div>

              <button
                onClick={openEditSheet}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            </div>

            {/* Stats Row */}
            <div className="border-t border-white/10 px-4 py-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-poppins font-bold text-lg text-white">{totalBookings}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Bookings</p>
                </div>
                <div className="border-x border-white/10">
                  <p className="font-poppins font-bold text-lg text-white">
                    ₹{Math.round(totalSpent / 1000) / 10}L
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">Spent</p>
                </div>
                <div>
                  <p className="font-poppins font-bold text-lg text-white">{delivered}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Delivered</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Highlights */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h4 className="font-poppins font-semibold text-sm text-neutral-700 mb-4">Account Info</h4>
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 skeleton-shimmer animate-shimmer rounded-lg" />
                ))}
              </div>
            ) : statsError ? (
              <div className="text-center py-3">
                <p className="text-xs text-neutral-400 mb-2">Couldn't load account stats</p>
                <button onClick={loadProfileData} className="text-xs font-semibold text-primary hover:underline">
                  Retry
                </button>
              </div>
            ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Member Since</p>
                  <p className="text-sm font-semibold text-neutral-700">
                    {profileData?.created_at || profileData?.createdAt ? formatDate(profileData.created_at || profileData.createdAt) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Active Shipments</p>
                  <p className="text-sm font-semibold text-neutral-700">
                    {bookings.filter((b) => b.status === "In Transit" || b.status === "Assigned").length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Lifetime Value</p>
                  <p className="text-sm font-semibold text-neutral-700">₹{totalSpent.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </div>
            )}
          </div>

          <p className="text-center text-[10px] text-neutral-300">SSK Logistics v1.0.0 — GadiDost</p>
        </div>

        {/* Right — Settings */}
        <div className="lg:col-span-2 space-y-5">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2 px-1">
                {section.title}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleMenuClick(item)}
                    className="w-full flex items-center gap-3 bg-white border border-neutral-100 rounded-xl px-4 h-14 text-left hover:bg-neutral-50 transition-colors"
                  >
                    <item.icon className="w-[18px] h-[18px] text-neutral-400 flex-shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 text-sm font-medium text-neutral-700">{item.label}</span>
                    {item.path === "/notifications" && unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Sign Out — its own row, standing apart from the sectioned menus above. */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-100 rounded-xl h-14 text-sm font-semibold text-danger hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <BottomSheet isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}>
        <div className="text-center pt-2 pb-2 pr-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-7 h-7 text-danger" />
          </div>
          <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-1">Sign Out</h3>
          <p className="text-sm text-neutral-400 mb-8">Are you sure you want to sign out of your account?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-medium py-3 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 bg-danger text-white font-medium py-3 rounded-lg hover:bg-red-600 transition-colors"
            >
              Yes, Sign Out
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Edit Profile */}
      <BottomSheet isOpen={showEditSheet} onClose={() => setShowEditSheet(false)}>
        <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-5">Edit Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Full Name</label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <Pencil className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Email Address</label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <Mail className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Company Name <span className="text-neutral-300 font-normal normal-case">(optional)</span></label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <Building2 className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="text"
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Booking on behalf of a business?"
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Address <span className="text-neutral-300 font-normal normal-case">(optional)</span></label>
            <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
              <MapPin className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street, city, state, pincode"
                className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>
          </div>

          {editError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {editError}
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={editSaving}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {editSaving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : "Save Changes"}
          </button>
        </div>
      </BottomSheet>

      {/* Change Password */}
      <BottomSheet isOpen={showPwSheet} onClose={() => setShowPwSheet(false)}>
        <h3 className="font-poppins font-semibold text-lg text-neutral-800 mb-5">Change Password</h3>
        <div className="space-y-4">
          {[
            { key: "current", label: "Current Password", placeholder: "Enter current password" },
            { key: "next", label: "New Password", placeholder: "Min 6 characters" },
            { key: "confirm", label: "Confirm New Password", placeholder: "Repeat new password" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">{label}</label>
              <div className="flex items-center bg-neutral-50 border-2 border-neutral-100 rounded-xl px-4 py-3 focus-within:border-primary transition-all">
                <Lock className="w-4 h-4 text-neutral-300 mr-3 flex-shrink-0" />
                <input
                  type={showPw[key] ? "text" : "password"}
                  value={passwords[key]}
                  onChange={(e) => setPasswords((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
                />
                <button type="button" onClick={() => setShowPw((p) => ({ ...p, [key]: !p[key] }))} className="text-neutral-400 hover:text-neutral-600">
                  {showPw[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          {pwError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {pwError}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={pwSaving}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pwSaving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</>
            ) : "Update Password"}
          </button>
        </div>
      </BottomSheet>

    </div>
  );
}
