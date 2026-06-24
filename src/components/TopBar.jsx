import React from "react";
import { Bell, MapPin, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TopBar({ title, onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="h-14 md:h-16 bg-white border-b border-neutral-100 flex items-center justify-between px-4 md:px-8 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
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
        <button className="relative p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
        </button>

        <div className="w-px h-6 bg-neutral-100 mx-1" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center flex-shrink-0">
            <span className="text-xs md:text-sm font-bold text-primary">{user?.initials || "RK"}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-neutral-800 leading-tight">
              {user?.name?.split(" ")[0] || "Rajesh"}
            </p>
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-neutral-400" />
              <p className="text-[11px] text-neutral-400">{user?.location || "Mumbai, MH"}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
