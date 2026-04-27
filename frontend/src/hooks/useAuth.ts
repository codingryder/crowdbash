import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

export function useAuth() {
  const { user, isLoading, showAuthModal, setUser, setLoading, setShowAuthModal, logout } = useAuthStore();

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('crowdbash_token');
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
    // Refetch on visibility/focus so a mobile browser resume after long
    // backgrounding refreshes user state without forcing the user to reload.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const t = localStorage.getItem('crowdbash_token');
        if (t && !useAuthStore.getState().user) fetchMe();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  async function fetchMe(retryCount = 0): Promise<void> {
    try {
      // Longer timeout to absorb Render cold starts (~30-60s on free tier)
      // — without this, the very first request after the server sleeps would
      // throw and (previously) wipe the token. Now we retry instead.
      const { data } = await api.get('/api/auth/me', { timeout: 60000 });
      setUser(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Token is genuinely invalid/expired — clear it and log the user out.
        // (The api response interceptor also clears it on 401; this is belt+braces.)
        localStorage.removeItem('crowdbash_token');
        setLoading(false);
        return;
      }
      // Network error / timeout / 5xx — DO NOT clear the token. Retry with
      // backoff. The user keeps their session even if the server is cold-starting.
      if (retryCount < 3) {
        await new Promise((r) => setTimeout(r, 3000 * (retryCount + 1)));
        return fetchMe(retryCount + 1);
      }
      // Out of retries — leave token in place so a later page focus / refresh
      // can recover the session. Just stop showing the loading spinner.
      setLoading(false);
    }
  }

  async function signup(firstName: string, lastName: string, email: string, phone: string) {
    const { data } = await api.post('/api/auth/signup', {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    });
    return data;
  }

  async function signin(email: string) {
    const { data } = await api.post('/api/auth/signin', { email });
    return data;
  }

  async function verifyOtp(email: string, otp: string) {
    const { data } = await api.post('/api/auth/verify-otp', { email, otp });
    // Save token
    localStorage.setItem('crowdbash_token', data.token);
    setUser(data.user);
    setShowAuthModal(false);
    return data;
  }

  function openAuthModal() {
    setShowAuthModal(true);
  }

  function closeAuthModal() {
    setShowAuthModal(false);
  }

  return {
    user,
    isLoading,
    showAuthModal,
    signup,
    signin,
    verifyOtp,
    openAuthModal,
    closeAuthModal,
    logout,
  };
}
