import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, MapPin, User, Truck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", Icon: Home },
  { path: "/book", label: "Book a Truck", Icon: PlusCircle },
  { path: "/bookings", label: "My Bookings", Icon: ClipboardList },
  { path: "/track", label: "Track Shipment", Icon: MapPin },
  { path: "/profile", label: "Profile", Icon: User },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 bg-secondary flex flex-col z-40 shadow-xl transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Logo */}
      <div className="flex flex-col items-center justify-center px-5 py-4 border-b border-white/10 flex-shrink-0">
        <img src="/gadidost-logo.png" alt="GadiDost Logo" className="h-12 w-auto mb-2" />
        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Client Dashboard </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-3">Menu</p>
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = currentPath === path;
          return (
            <button
              key={path}
              onClick={() => { navigate(path); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon
                className={`flex-shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-white/50 group-hover:text-white"
                }`}
                strokeWidth={isActive ? 2.5 : 1.8}
                size={18}
              />
              <span className="text-sm font-medium">{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 flex-shrink-0 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/25 border border-primary/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">{user?.initials || "RK"}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.name || "Rajesh Kumar"}
            </p>
            <p className="text-[10px] text-white/40 truncate">{user?.email || "rajesh@example.com"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
