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
  }, []);

  async function fetchMe() {
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('crowdbash_token');
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
