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

export const api = {
  post: (path, body, token) => request('POST', path, body, token),
  get:  (path, token)       => request('GET',  path, null, token),
  put:  (path, body, token) => request('PUT',  path, body, token),
};

export const getStoredAuth = () => {
  try { return JSON.parse(localStorage.getItem('ssk_client_auth')); } catch { return null; }
};

export const getToken = () => getStoredAuth()?.tokens?.access_token || null;
