import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import BottomNav from "./components/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import SessionExpiredModal from "./components/SessionExpiredModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import usePushNotifications from "./hooks/usePushNotifications";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import BookTruck from "./pages/BookTruck";
import MyBookings from "./pages/MyBookings";
import BookingDetail from "./pages/BookingDetail";
import TrackShipment from "./pages/TrackShipment";
import Profile from "./pages/Profile";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/book": "Book a Truck",
  "/bookings": "My Bookings",
  "/track": "Track Shipment",
  "/profile": "My Profile",
};

function WebLayout({ children, hideTopBar }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith("/bookings/") ? "Booking Details" : "Dashboard");

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-neutral">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 md:ml-64 flex flex-col overflow-hidden ${hideTopBar ? "h-screen" : "min-h-screen"}`}>
        {/* Skipped on wizard-style pages (hideTopBar) that want a distraction-free, full-height
            flow — BottomNav below still covers mobile navigation either way, so nothing about
            reaching other pages is actually lost by dropping this. */}
        {!hideTopBar && <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />}
        {/* hideTopBar pages (the booking wizard) get a genuinely bounded, scrollable-but-
            scrollbar-hidden frame (h-screen above + overflow-y-auto no-scrollbar here) instead
            of the normal whole-page scroll — the wizard's own layout keeps its content inside
            this frame's height so nothing here actually needs to scroll, and this is just the
            safety net for anything (e.g. the broker/driver steps) that runs long. */}
        <main className={hideTopBar ? "flex-1 min-h-0 overflow-y-auto no-scrollbar" : "flex-1 pb-5 md:pb-0"}>
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  // Registers this device for push once authenticated, for the lifetime of the app — not
  // scoped to any one route, so it lives here rather than inside a specific page.
  usePushNotifications();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WebLayout>
              <Home />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/book"
        element={
          <ProtectedRoute>
            <WebLayout hideTopBar>
              <BookTruck />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <WebLayout>
              <MyBookings />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookings/:id"
        element={
          <ProtectedRoute>
            <WebLayout>
              <BookingDetail />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/track"
        element={
          <ProtectedRoute>
            <WebLayout>
              <TrackShipment />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <WebLayout>
              <Profile />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <SessionExpiredModal />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
