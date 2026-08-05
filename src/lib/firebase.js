import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Push is opt-in infrastructure — until a real Firebase project's credentials are filled into
// .env (see the comment there), every export below just no-ops instead of throwing, so the
// rest of the app behaves exactly as it did before this file existed.
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && VAPID_KEY);

let app = null;
const getFirebaseApp = () => {
  if (!isConfigured) return null;
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return app;
};

let messagingInstance = null;
const getMessagingInstance = async () => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  // isSupported() is false in browsers without the Push API (older Safari, some in-app
  // webviews) — checking it up front avoids getMessaging() throwing in those environments.
  if (!(await isSupported())) return null;
  if (!messagingInstance) messagingInstance = getMessaging(firebaseApp);
  return messagingInstance;
};

// The web config values aren't secret (Firebase enforces access via security rules, not by
// hiding these), but they do vary per environment — passed as query params on registration
// so the static public/firebase-messaging-sw.js file can read them at runtime instead of
// needing them hardcoded at build time.
const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const params = new URLSearchParams(firebaseConfig);
    return await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
  } catch {
    return null;
  }
};

// Prompts for Notification permission (if not already decided) and returns this browser's
// current FCM token, or null if push isn't configured/supported/permitted. Call once after
// login, and again on every app load — the JS SDK has no onTokenRefresh event the way
// Flutter's does, so re-requesting is the standard way to pick up a rotated token.
export const requestFcmToken = async () => {
  if (!isConfigured || !("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const registration = await registerServiceWorker();
  try {
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration || undefined,
    });
  } catch {
    return null;
  }
};

// Foreground pushes (a tab that's open and focused) don't show an OS notification on their
// own — this is the only way to see them, unlike background pushes which the service worker
// (firebase-messaging-sw.js) turns into OS notifications automatically. Returns an unsubscribe
// function; a no-op one if push isn't configured/supported.
export const listenForegroundMessages = async (callback) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
