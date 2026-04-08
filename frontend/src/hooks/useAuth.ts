import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncUser();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          syncUser();
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function syncUser() {
    try {
      await api.post('/api/auth/register');
      const me = await api.get('/api/auth/me');
      setUser(me.data);
    } catch {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return { user, isLoading, signInWithGoogle, signOut };
}
