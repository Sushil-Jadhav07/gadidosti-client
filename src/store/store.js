import { configureStore } from "@reduxjs/toolkit";
import bookingWizardReducer from "./bookingWizardSlice";

// Lets BookTruck.jsx survive a page reload on any step — Redux's own state is purely in-memory
// and resets on every page load otherwise, so this mirrors just the bookingWizard slice into
// sessionStorage (not localStorage — deliberate: this should only survive a reload of the same
// tab/session, not linger indefinitely across days once a booking is long since resolved one
// way or another). Read once here, synchronously, before the store is even created, so it's
// already the very first state React ever sees — no separate "restore on mount" step needed.
const STORAGE_KEY = "ssk_booking_wizard";

const loadPersistedWizardState = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const store = configureStore({
  reducer: {
    bookingWizard: bookingWizardReducer,
  },
  preloadedState: {
    // Spread over explicit defaults (not just whatever was persisted) — a partial/older-shaped
    // stored object shouldn't leave e.g. bookingId as `undefined` instead of `null`.
    bookingWizard: { step: 1, form: null, bookingId: null, ...loadPersistedWizardState() },
  },
});

// Keeps sessionStorage mirroring the slice on every change, so the *next* reload picks up
// wherever this one left off — the read above only ever runs once, at boot.
let previousWizardState = store.getState().bookingWizard;
store.subscribe(() => {
  const nextWizardState = store.getState().bookingWizard;
  if (nextWizardState === previousWizardState) return;
  previousWizardState = nextWizardState;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextWizardState));
  } catch {
    /* ignore — worst case, the next reload just starts the wizard fresh */
  }
});
