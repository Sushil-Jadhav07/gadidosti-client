import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store'
import App from './App'
import './index.css'

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
