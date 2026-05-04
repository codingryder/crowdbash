import { create } from 'zustand';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function adminApi() {
  const token = localStorage.getItem('crowdbash_admin_token');
  return axios.create({
    baseURL: BASE,
    timeout: 30000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export interface AdminRoom {
  id: string;
  match_id: string;
  match_name: string;
  sport: string;
  league: string;
  match_format: string;
  venue: string;
  status: string;
  match_date: string | null;
  fan_count: number;
  created_at: string | null;
  edit_window_closes_at: string | null;
  player_edit_window_closes_at?: string | null;
  late_join_enabled?: boolean;
  playing_xi_announced_at?: string | null;
}

export interface UpcomingMatch {
  match_name: string;
  match_format: string;
  venue: string;
  league: string;
  match_date: string;
  season: string;
  source?: string;
  match_id?: string;
}

interface AdminState {
  adminToken: string | null;
  isLoggedIn: boolean;
  rooms: AdminRoom[];
  loading: boolean;
  matchSuggestions: UpcomingMatch[];
  fetchingMatches: boolean;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
  fetchRooms: (sport?: string, status?: string) => Promise<void>;
  createRoom: (data: {
    sport: string;
    match_name: string;
    match_format?: string;
    venue?: string;
    league?: string;
    season?: string;
    match_date?: string;
    match_id?: string;
  }) => Promise<AdminRoom | null>;
  updateStatus: (roomId: string, status: string) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  fetchMatches: (sport: string) => Promise<void>;
  openEditWindow: (roomId: string, durationSeconds: number) => Promise<boolean>;
  closeEditWindow: (roomId: string) => Promise<boolean>;
  openPlayerEditWindow: (roomId: string, durationSeconds: number) => Promise<boolean>;
  closePlayerEditWindow: (roomId: string) => Promise<boolean>;
  refreshSquads: (roomId: string) => Promise<{ players_added?: number; skipped_reason?: string } | null>;
  setMatchSquads: (
    roomId: string,
    players: { player_id: string; player_name: string; team: string; player_role?: string }[],
  ) => Promise<{ players_added?: number } | null>;
  setLateJoin: (roomId: string, enabled: boolean) => Promise<boolean>;
  announceXi: (roomId: string) => Promise<{ team_a?: string; team_b?: string; xi_a_count?: number; xi_b_count?: number } | null>;
  clearXi: (roomId: string) => Promise<boolean>;
  syncRealXi: (roomId: string) => Promise<{
    found: boolean;
    reason?: string;
    team_a?: string;
    team_b?: string;
    xi_a_count?: number;
    xi_b_count?: number;
    rooms_updated?: number;
    error?: string;
  } | null>;
  broadcastRecipients: () => Promise<number | null>;
  broadcastRoomInvite: (
    roomId: string,
    body: { subject?: string; intro?: string; test_email?: string },
  ) => Promise<{
    sent: number;
    failed: number;
    total: number;
    test?: boolean;
    error?: string;
    failures?: { email: string; error: string }[];
  } | null>;
  broadcastWinner: (
    roomId: string,
    body: { next_room_id?: string | null; test_email?: string | null },
  ) => Promise<{
    sent: number;
    failed: number;
    total: number;
    test?: boolean;
    winner?: string;
    error?: string;
    failures?: { email: string; error: string }[];
  } | null>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  adminToken: localStorage.getItem('crowdbash_admin_token'),
  isLoggedIn: !!localStorage.getItem('crowdbash_admin_token'),
  rooms: [],
  loading: false,
  matchSuggestions: [],
  fetchingMatches: false,

  login: async (username, password) => {
    try {
      const { data } = await axios.post(`${BASE}/api/admin/login`, { username, password });
      localStorage.setItem('crowdbash_admin_token', data.token);
      set({ adminToken: data.token, isLoggedIn: true });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('crowdbash_admin_token');
    set({ adminToken: null, isLoggedIn: false, rooms: [], matchSuggestions: [] });
  },

  checkAuth: () => {
    const token = localStorage.getItem('crowdbash_admin_token');
    set({ adminToken: token, isLoggedIn: !!token });
  },

  fetchRooms: async (sport, status) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (sport) params.set('sport', sport);
      if (status) params.set('status', status);
      const { data } = await adminApi().get(`/api/admin/rooms?${params}`);
      set({ rooms: data });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
    } finally {
      set({ loading: false });
    }
  },

  createRoom: async (roomData) => {
    try {
      const { data } = await adminApi().post('/api/admin/rooms', roomData);
      await get().fetchRooms();
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },

  updateStatus: async (roomId, status) => {
    try {
      await adminApi().patch(`/api/admin/rooms/${roomId}/status`, { status });
      await get().fetchRooms();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
    }
  },

  deleteRoom: async (roomId) => {
    try {
      await adminApi().delete(`/api/admin/rooms/${roomId}`);
      set({ rooms: get().rooms.filter((r) => r.id !== roomId) });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
    }
  },

  fetchMatches: async (sport) => {
    set({ fetchingMatches: true, matchSuggestions: [] });
    try {
      const { data } = await adminApi().get(`/api/admin/fetch-matches?sport=${sport}`);
      set({ matchSuggestions: data.matches || [] });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
    } finally {
      set({ fetchingMatches: false });
    }
  },

  openEditWindow: async (roomId, durationSeconds) => {
    try {
      await adminApi().post(`/api/admin/rooms/${roomId}/edit-window/open`, {
        duration_seconds: durationSeconds,
      });
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  closeEditWindow: async (roomId) => {
    try {
      await adminApi().post(`/api/admin/rooms/${roomId}/edit-window/close`);
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  openPlayerEditWindow: async (roomId, durationSeconds) => {
    try {
      await adminApi().post(`/api/admin/rooms/${roomId}/player-edit-window/open`, {
        duration_seconds: durationSeconds,
      });
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  closePlayerEditWindow: async (roomId) => {
    try {
      await adminApi().post(`/api/admin/rooms/${roomId}/player-edit-window/close`);
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  announceXi: async (roomId) => {
    try {
      const { data } = await adminApi().post(`/api/admin/rooms/${roomId}/announce-xi`, {});
      await get().fetchRooms();
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },

  clearXi: async (roomId) => {
    try {
      await adminApi().delete(`/api/admin/rooms/${roomId}/announce-xi`);
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  syncRealXi: async (roomId) => {
    try {
      // Gemini grounded search is slow — give it 60s before timing out.
      const { data } = await adminApi().post(
        `/api/admin/rooms/${roomId}/sync-real-xi`,
        {},
        { timeout: 60_000 },
      );
      await get().fetchRooms();
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      if (axios.isAxiosError(err) && err.response?.data) {
        const detail = (err.response.data as { detail?: string })?.detail;
        if (detail) return { found: false, error: detail };
      }
      return null;
    }
  },

  setLateJoin: async (roomId, enabled) => {
    try {
      await adminApi().post(`/api/admin/rooms/${roomId}/late-join`, { enabled });
      await get().fetchRooms();
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return false;
    }
  },

  broadcastRecipients: async () => {
    try {
      const { data } = await adminApi().get('/api/admin/broadcast/recipients');
      return data?.count ?? 0;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },

  broadcastRoomInvite: async (roomId, body) => {
    try {
      // Fan-out to ~all users; allow ample headroom over the default timeout.
      const { data } = await adminApi().post(
        `/api/admin/rooms/${roomId}/broadcast`,
        body,
        { timeout: 60_000 },
      );
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },

  broadcastWinner: async (roomId, body) => {
    try {
      // Same fan-out scale as broadcastRoomInvite — needs the same timeout headroom.
      const { data } = await adminApi().post(
        `/api/admin/rooms/${roomId}/broadcast-winner`,
        body,
        { timeout: 60_000 },
      );
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      if (axios.isAxiosError(err) && err.response?.data) {
        const detail = (err.response.data as { detail?: string })?.detail;
        if (detail) return { sent: 0, failed: 0, total: 0, error: detail };
      }
      return null;
    }
  },

  refreshSquads: async (roomId) => {
    try {
      // Grounded Gemini search can take 10-20s; use a generous timeout
      // (the default 30s is fine but request-level it's clearer to be explicit).
      const { data } = await adminApi().post(
        `/api/admin/rooms/${roomId}/refresh-squads`,
        undefined,
        { timeout: 60_000 },
      );
      await get().fetchRooms();
      return data as { players_added?: number; skipped_reason?: string };
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },

  setMatchSquads: async (roomId, players) => {
    try {
      const { data } = await adminApi().post(
        `/api/admin/squads/${roomId}`,
        { players },
      );
      return data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) get().logout();
      return null;
    }
  },
}));
