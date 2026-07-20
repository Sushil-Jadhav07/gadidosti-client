const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const request = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return res.json();
};

// Fetches a file (e.g. a proof-of-delivery photo) with the auth header attached and
// returns a local blob URL — needed because the file-serving routes require a Bearer
// token, so a plain <img src="..."> or <a href="..."> can't load them directly.
const getFileBlobUrl = async (url, token) => {
  const res = await fetch(url, { headers: { ...(token && { Authorization: `Bearer ${token}` }) } });
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

export const api = {
  post:  (path, body, token) => request('POST',  path, body, token),
  get:   (path, token)       => request('GET',   path, null, token),
  put:   (path, body, token) => request('PUT',   path, body, token),
  patch: (path, body, token) => request('PATCH', path, body, token),
  getFileBlobUrl,
};

export const getStoredAuth = () => {
  try { return JSON.parse(localStorage.getItem('ssk_client_auth')); } catch { return null; }
};

export const getToken = () => getStoredAuth()?.tokens?.access_token || null;
