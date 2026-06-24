import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Receipt, MapPin, CreditCard, Bell, Headphones, FileText,
  LogOut, ChevronRight, Phone, Mail, Pencil, Package, Wallet, CalendarDays,
} from "lucide-react";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BOOKINGS } from "../data/mockData";

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
      { icon: MapPin, label: "Saved Addresses", action: "coming_soon" },
      { icon: CreditCard, label: "Payment Methods", action: "coming_soon" },
      { icon: Bell, label: "Notifications", action: "coming_soon" },
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
  const { user, logout } = useAuth();
  const toast = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const totalBookings = BOOKINGS.length;
  const totalSpent = BOOKINGS.filter((b) => b.status !== "Cancelled").reduce((sum, b) => sum + b.amount, 0);
  const delivered = BOOKINGS.filter((b) => b.status === "Delivered").length;

  const handleMenuClick = (item) => {
    if (item.path) {
      navigate(item.path);
    } else if (item.action === "coming_soon") {
      toast.info("This feature is coming soon!");
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("You have been logged out successfully");
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
                <span className="font-poppins font-bold text-2xl text-white">{user?.initials || "RK"}</span>
              </div>

              <h2 className="font-poppins font-semibold text-xl text-white mb-1">
                {user?.name || "Rajesh Kumar"}
              </h2>

              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Phone className="w-3 h-3 text-white/50" />
                <span className="text-xs text-white/50">{user?.phone || "+91 98765 43210"}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <Mail className="w-3 h-3 text-white/50" />
                <span className="text-xs text-white/50">{user?.email || "rajesh@example.com"}</span>
              </div>

              <button
                onClick={() => toast.info("Edit profile coming soon!")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-xs font-medium text-white hover:bg-white/20 transition-colors"
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
          <div className="bg-white rounded-xl shadow-card p-5">
            <h4 className="font-poppins font-semibold text-sm text-neutral-700 mb-4">Account Info</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Member Since</p>
                  <p className="text-sm font-semibold text-neutral-700">January 2024</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Active Shipments</p>
                  <p className="text-sm font-semibold text-neutral-700">
                    {BOOKINGS.filter((b) => b.status === "In Transit" || b.status === "Assigned").length}
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
          </div>

          <p className="text-center text-[10px] text-neutral-300">SSK Logistics v1.0.0 — GadiDost</p>
        </div>

        {/* Right — Settings */}
        <div className="lg:col-span-2 space-y-5">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  {section.title}
                </p>
              </div>
              <div className="divide-y divide-neutral-50">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleMenuClick(item)}
                    className="w-full flex items-center gap-4 px-5 h-14 text-left hover:bg-neutral-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-neutral-100 flex items-center justify-center flex-shrink-0 transition-colors">
                      <item.icon className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-neutral-700">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Danger Zone */}
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Account</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-4 px-5 h-14 text-left hover:bg-red-50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                <LogOut className="w-4 h-4 text-danger" />
              </div>
              <span className="flex-1 text-sm font-medium text-danger">Sign Out</span>
            </button>
          </div>
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
    </div>
  );
}
