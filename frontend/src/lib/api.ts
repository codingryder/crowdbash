import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crowdbash_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intentionally NO global 401 → token-clear handler.
// A transient 401 from a polling endpoint (live scorecard every 15s,
// leaderboard every 30s) used to silently wipe the session and force a
// fresh OTP login mid-match. Token validity is now decided in one place:
// useAuth.fetchMe(), which calls /api/auth/me on mount + tab focus and
// only clears the token when *that* specific endpoint returns 401.

export default api;
