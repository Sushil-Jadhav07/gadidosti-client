import React, { useState, useRef, useEffect } from "react";
import { MapPin, Menu, User, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function TopBar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "RK";

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-14 md:h-16 bg-white border-b border-neutral-100 flex items-center justify-between px-4 md:px-8 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="font-poppins font-semibold text-base md:text-xl text-neutral-800">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationBell />

        <div className="w-px h-6 bg-neutral-100 mx-1" />

        {/* Avatar + dropdown trigger */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center flex-shrink-0">
              <span className="text-xs md:text-sm font-bold text-primary">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-neutral-800 leading-tight">
                {user?.name?.split(" ")[0] || "client"}
              </p>
              <div className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-neutral-400" />
                <p className="text-[11px] text-neutral-400">{user?.location || "Mumbai, MH"}</p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 hidden sm:block transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown */}
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-12 w-52 bg-white border border-neutral-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
                <div className="p-2">
                  <button
                    onClick={() => { setOpen(false); navigate("/profile"); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                    My Profile
                  </button>

                  <div className="my-1.5 border-t border-neutral-100" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-red-50 transition-colors font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <LogOut className="w-3.5 h-3.5 text-danger" />
                    </div>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
