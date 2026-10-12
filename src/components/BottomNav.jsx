import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, MapPin, MessageCircle, User, CalendarClock } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Home", Icon: Home },
  { path: "/book", label: "Book", Icon: PlusCircle },
  { path: "/bookings", label: "Bookings", Icon: ClipboardList },
  { path: "/track", label: "Track", Icon: MapPin },
  { path: "/monthly-hiring", label: "Monthly", Icon: CalendarClock },
  { path: "/chats", label: "Chats", Icon: MessageCircle },
  { path: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <nav className="md:hidden sticky bottom-0 left-0 right-0 z-50 bg-white shadow-nav pb-[env(safe-area-inset-bottom,0px)]">
      {/* overflow-x-auto as a hard guarantee, not just a width budget — whatever 7 items at a
          comfortable tap-target size add up to, this row can always reach every item by
          swiping instead of silently clipping/squishing the trailing ones off an exact-fit
          calculation that depends on the device's exact width. flex-shrink-0 + an explicit
          min-width (not flex-1 min-w-0) is what makes that possible: flex-1 items happily
          shrink toward 0 to avoid ever overflowing, which is exactly what was squeezing/
          clipping labels instead of ever actually triggering this scroll. */}
      <div className="flex items-center justify-center w-full h-16 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = currentPath === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-shrink-0 min-w-[52px] px-0.5 h-full relative transition-colors duration-200 ${
                isActive ? "text-primary" : "text-neutral-300"
              }`}
            >
              {path === "/book" ? (
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
              ) : (
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              )}
              <span className={`text-[9px] leading-tight whitespace-nowrap ${isActive ? "font-semibold" : "font-medium"}`}>
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
