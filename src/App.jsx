import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import BottomNav from "./components/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import SessionExpiredModal from "./components/SessionExpiredModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ChatUnreadProvider } from "./context/ChatUnreadContext";
import usePushNotifications from "./hooks/usePushNotifications";
import ChatNotificationListener from "./components/ChatNotificationListener";
import ChatLauncher from "./components/ChatLauncher";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import BookTruck from "./pages/BookTruck";
import MyBookings from "./pages/MyBookings";
import BookingDetail from "./pages/BookingDetail";
import TrackShipment from "./pages/TrackShipment";
import PublicTracking from "./pages/PublicTracking";
import Chats from "./pages/Chats";
import ChatDetail from "./pages/ChatDetail";
import Profile from "./pages/Profile";
import SavedAddresses from "./pages/SavedAddresses";
import AddressForm from "./pages/AddressForm";
import PaymentMethods from "./pages/PaymentMethods";
import Notifications from "./pages/Notifications";
import MonthlyHiring from "./pages/MonthlyHiring";
import MonthlyHiringForm from "./pages/MonthlyHiringForm";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/book": "Book a Truck",
  "/bookings": "My Bookings",
  "/track": "Track Shipment",
  "/chats": "Chats",
  "/profile": "My Profile",
  "/addresses": "Saved Addresses",
  "/addresses/new": "Add Address",
  "/payment-methods": "Payment Methods",
  "/notifications": "Notifications",
  "/monthly-hiring": "Monthly Vehicle Hiring",
  "/monthly-hiring/new": "New Enquiry",
};

function WebLayout({ children, hideTopBar }) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith("/bookings/") ? "Booking Details"
      : location.pathname.startsWith("/chats/") ? "Chat"
      : "Dashboard");

  return (
    // min-h-dvh, not min-h-screen (100vh) — on a mobile browser, 100vh is sized against the
    // LARGEST possible viewport (address bar collapsed), not what's actually visible when it's
    // showing. That overshoot is exactly what pushed BottomNav (and the wizard's own h-screen
    // frame below) a browser-chrome's-worth of pixels past the real bottom edge of the screen.
    // dvh (dynamic viewport height, Tailwind 3.4+) tracks the actual visible viewport instead.
    <div className="flex min-h-dvh bg-neutral">
      {/* Desktop-only now (see Sidebar.jsx) — mobile navigation is BottomNav alone, not this
          same list behind a hamburger/slide-in drawer. */}
      <Sidebar />

      {/* overflow-hidden only on the hideTopBar (wizard) path, where it's a genuinely bounded
          h-dvh frame with its own internal scroll (main below). On normal pages this div is
          just min-h-dvh (a floor, grows with content) — overflow-hidden here too made THIS
          div (which never actually scrolls itself) BottomNav's nearest scroll-container ancestor
          for its `sticky bottom-0`, instead of the real window. Since this div doesn't scroll,
          sticky had nothing to stick against and BottomNav just sat at the bottom of the full
          page content instead of floating at the visible viewport edge. */}
      <div className={`flex-1 md:ml-64 flex flex-col ${hideTopBar ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
        {/* Skipped on wizard-style pages (hideTopBar) that want a distraction-free, full-height
            flow — BottomNav below still covers mobile navigation either way, so nothing about
            reaching other pages is actually lost by dropping this. */}
        {!hideTopBar && <TopBar title={title} />}
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
      {/* Public tracking share link (see BookingDetail.jsx / TrackShipment.jsx's "Share
          Tracking" actions) — deliberately outside both ProtectedRoute and PublicRoute (the
          latter would incorrectly redirect an already-logged-in visitor away from a link meant
          for anyone) and outside WebLayout (no sidebar/header, no authenticated-only chrome).
          Whoever the link is shared with may not have — or need — an account at all. */}
      <Route path="/t/:token" element={<PublicTracking />} />
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
        path="/chats"
        element={
          <ProtectedRoute>
            <WebLayout>
              <Chats />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chats/:bookingId"
        element={
          <ProtectedRoute>
            <WebLayout>
              <ChatDetail />
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
      <Route
        path="/addresses"
        element={
          <ProtectedRoute>
            <WebLayout>
              <SavedAddresses />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/addresses/new"
        element={
          <ProtectedRoute>
            <WebLayout>
              <AddressForm />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/addresses/:id/edit"
        element={
          <ProtectedRoute>
            <WebLayout>
              <AddressForm />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment-methods"
        element={
          <ProtectedRoute>
            <WebLayout>
              <PaymentMethods />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly-hiring"
        element={
          <ProtectedRoute>
            <WebLayout>
              <MonthlyHiring />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly-hiring/new"
        element={
          <ProtectedRoute>
            <WebLayout>
              <MonthlyHiringForm />
            </WebLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <WebLayout>
              <Notifications />
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
        <ChatUnreadProvider>
          <ToastProvider>
            <AppRoutes />
            <ChatNotificationListener />
            <ChatLauncher />
            <SessionExpiredModal />
          </ToastProvider>
        </ChatUnreadProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
