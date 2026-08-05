// Handles push notifications while no tab is focused (or the app is closed) — foreground
// push, while a tab is open and focused, is handled instead by onMessage() in
// src/lib/firebase.js, which this service worker has no involvement in.
//
// The Firebase config isn't hardcoded here because this is a static public/ file with no
// build step of its own (unlike src/lib/firebase.js, which reads it from Vite's
// import.meta.env) — instead it's passed as query params when the app registers this worker
// (see registerServiceWorker() in src/lib/firebase.js), and read back below.
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Firebase shows the OS notification itself from payload.notification once this fires — this
// only needs to attach the booking id (or whatever else data carries) so the click handler
// below can deep-link.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "SSK Logistics", {
    body,
    icon: "/gadidost-logo.png",
    data: payload.data || {},
  });
});

// data.type "booking" -> My Bookings (the only screen client-side that reads booking status/
// negotiation state); anything else just focuses or opens the app at its root.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.type === "booking" ? "/bookings" : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
