import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, MapPin, User } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Home", Icon: Home },
  { path: "/book", label: "Book", Icon: PlusCircle },
  { path: "/bookings", label: "Bookings", Icon: ClipboardList },
  { path: "/track", label: "Track", Icon: MapPin },
  { path: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <nav className="md:hidden sticky bottom-0 left-0 right-0 z-50 bg-white shadow-nav pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = currentPath === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full relative transition-colors duration-200 ${
                isActive ? "text-primary" : "text-neutral-300"
              }`}
            >
              {path === "/book" ? (
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
              ) : (
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
              )}
              <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
              {isActive && path !== "/book" && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
