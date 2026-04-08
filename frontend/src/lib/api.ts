import axios from 'axios';
import { supabase, isSupabaseConfigured } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 5000,
});

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Supabase not available
    }
  }
  return config;
});

export default api;
