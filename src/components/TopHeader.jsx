import React from "react";
import { MapPin, Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TopHeader() {
  const { user } = useAuth();
  return (
    <div className="bg-secondary px-4 pt-3 pb-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins font-semibold text-lg text-white">
            Hi, {user?.name?.split(" ")[0] || "Rajesh"} 👋
          </h2>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-white/70" />
            <span className="text-xs text-white/70">{user?.location || "Mumbai, MH"}</span>
          </div>
        </div>
        <button className="relative p-2">
          <Bell className="w-6 h-6 text-white" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
        </button>
      </div>
    </div>
  );
}
