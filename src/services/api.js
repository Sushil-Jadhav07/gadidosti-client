const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Session-expired signal for AUTHENTICATED calls only (token was sent, and the server still
// rejected it) — a 401 on a call that never carried a token (login/register/forgot-password)
// just means bad credentials, not an expired session, and must not trigger this. Listened for
// once, globally, by SessionExpiredModal.jsx (mounted in App.jsx) so any page's expired-session
// call surfaces the same re-login popup instead of a silent/generic error.
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

const request = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (res.status === 401 && token) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  return res.json();
};

// Fetches a file (e.g. a proof-of-delivery photo) with the auth header attached and
// returns a local blob URL — needed because the file-serving routes require a Bearer
// token, so a plain <img src="..."> or <a href="..."> can't load them directly.
const getFileBlobUrl = async (url, token) => {
  const res = await fetch(url, { headers: { ...(token && { Authorization: `Bearer ${token}` }) } });
  if (res.status === 401 && token) window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

// Same as getFileBlobUrl but returns the raw Blob — needed to build a File for the native
// Web Share API (sharing to WhatsApp etc. with the actual PDF attached), where an object URL
// string isn't usable.
const getFileBlob = async (url, token) => {
  const res = await fetch(url, { headers: { ...(token && { Authorization: `Bearer ${token}` }) } });
  if (res.status === 401 && token) window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  return res.blob();
};

export const api = {
  post:   (path, body, token) => request('POST',   path, body, token),
  get:    (path, token)       => request('GET',    path, null, token),
  put:    (path, body, token) => request('PUT',    path, body, token),
  patch:  (path, body, token) => request('PATCH',  path, body, token),
  delete: (path, body, token) => request('DELETE', path, body, token),
  getFileBlobUrl,
  getFileBlob,
};

export const getStoredAuth = () => {
  try { return JSON.parse(localStorage.getItem('ssk_client_auth')); } catch { return null; }
};

export const getToken = () => getStoredAuth()?.tokens?.access_token || null;
