import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/firebase'

// Registered unconditionally (not gated behind login or notification permission) so the app
// has an active service worker from first visit — that's what makes Chrome/Edge offer the
// "Install app" prompt. requestFcmToken() (src/hooks/usePushNotifications.js) re-registers the
// same URL later, which is a no-op once this has already run.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)

// Remove the boot splash (see index.html) once React has painted — same pattern as
// gadidosti-broker-driver's main.jsx. loaderGif.gif loops infinitely on its own (no artificial
// minimum hold needed), it just keeps animating for as long as this is shown.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.classList.add("fade-out");
      setTimeout(() => splash.remove(), 550);
    }
  });
});
