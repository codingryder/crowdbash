export type Sport = 'cricket' | 'football';

export interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  total_games: number;
  total_wins: number;
  weightage_balance: number;
  terms_accepted_at?: string | null;
}

export interface Room {
  id: string;
  match_id: string;
  match_name: string;
  match_format: string;
  venue: string;
  status: 'open' | 'locked' | 'closed';
  current_over: number;
  fan_count: number;
  sport: Sport;
  league?: string;
  season?: string;
  match_progress: Record<string, unknown>;
  match_date?: string;
  created_at?: string;
  completed_at?: string;
  late_join_open?: boolean;
  late_join_overs_remaining?: number;
  /** Football late-join window: minutes remaining until cutoff (typically half-time at 45). */
  late_join_minutes_remaining?: number;
  edit_window_closes_at?: string | null;
  playing_xi_announced_at?: string | null;
  playing_xi?: PlayingXI | null;
}

export interface PlayingXI {
  team_a: string;
  team_b: string;
  xi_a: string[];
  xi_b: string[];
}

/** Split match name into two team names. Handles "vs", "v", "VS" separators. */
export function splitTeams(matchName: string): [string, string] {
  // Try " vs " first, then " v "
  let parts = matchName.split(/ vs /i);
  if (parts.length < 2) parts = matchName.split(/ v /i);
  return [parts[0]?.trim() || 'TBD', parts[1]?.trim() || 'TBD'];
}

// ── Team abbreviations ───────────────────────────────────────────────────
// Football: 3-letter codes derived algorithmically when ESPN doesn't supply
// team.abbreviation. Splits on whitespace AND hyphens so "Paris Saint-
// Germain" → "PSG", not "PS".
export function teamAbbr(name: string): string {
  if (!name) return 'TBD';
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 3) return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
  if (words.length === 2) {
    const [a, b] = words;
    return (a[0] + b.slice(0, 2)).toUpperCase();
  }
  return words[0].slice(0, 3).toUpperCase();
}

// Cricket: official short codes vary in length (MI, GT, RR, CSK, RCB, PBKS,
// SRH…), so a static map is more correct than any algorithm. Used as a
// fallback when the upstream source (CricketData.org, Gemini) doesn't
// carry the official abbreviation. ESPN supplies team.abbreviation directly.
const CRICKET_ABBR: Record<string, string> = {
  // IPL
  'mumbai indians': 'MI',
  'chennai super kings': 'CSK',
  'royal challengers bengaluru': 'RCB',
  'royal challengers bangalore': 'RCB',
  'kolkata knight riders': 'KKR',
  'delhi capitals': 'DC',
  'sunrisers hyderabad': 'SRH',
  'punjab kings': 'PBKS',
  'rajasthan royals': 'RR',
  'gujarat titans': 'GT',
  'lucknow super giants': 'LSG',
  // Internationals
  india: 'IND', australia: 'AUS', england: 'ENG', pakistan: 'PAK',
  'south africa': 'SA', 'new zealand': 'NZ', 'west indies': 'WI',
  'sri lanka': 'SL', bangladesh: 'BAN', afghanistan: 'AFG',
  zimbabwe: 'ZIM', ireland: 'IRE', scotland: 'SCO', netherlands: 'NED',
  nepal: 'NEP', oman: 'OMA', usa: 'USA', 'united states': 'USA',
};

export function cricketAbbr(name: string): string {
  if (!name) return 'TBD';
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (CRICKET_ABBR[key]) return CRICKET_ABBR[key];
  return key.slice(0, 3).toUpperCase();
}

/** Format a date string for display. */
export function formatMatchDate(dateStr?: string | null, options?: { showTime?: boolean }): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday && options?.showTime !== false) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isTomorrow && options?.showTime !== false) {
      return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (options?.showTime !== false) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export interface Player {
  id: string;
  name: string;
  team: string;
  role: string;
}

export interface SquadPlayer {
  player_id: string;
  player_name: string;
  team: string;
  player_role: string;
  image_url?: string | null;
}

export interface PlayerWeightage {
  player_id: string;
  player_name: string;
  team: string;
  weightage: number;
  points_earned: number;
  player_role?: string;
  scoring_breakdown?: Record<string, number>;
  selected?: boolean;
  image_url?: string | null;
}

export interface Game {
  id: string;
  room_id: string;
  user_id: string;
  mode: 'room' | '1v1';
  opponent_id?: string;
  total_points: number;
  status: 'active' | 'completed';
  rank?: number;
  player_weightages: PlayerWeightage[];
  extra_weightage_used: number;
  squad_locked: boolean;
  total_budget: number;
  match_started?: boolean;
  can_edit_players?: boolean;
  can_edit_weightages?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url?: string;
  points: number;
  strategy?: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  timestamp: string;
}

// Sport-specific score data
export interface CricketScoreData {
  sport: 'cricket';
  match_id: string;
  match_name: string;
  team1: { name: string; score: string; overs: string };
  team2: { name: string; score: string; overs: string };
  status: string;
  current_rate: number;
  batting_team: string;
}

export interface FootballScoreData {
  sport: 'football';
  home: { name: string; goals: number; logo?: string };
  away: { name: string; goals: number; logo?: string };
  minute: number;
  half: number;
  status: string;
  possession_home?: number;
  possession_away?: number;
}

export type ScoreData = CricketScoreData | FootballScoreData;

// Match events for commentary feed
export interface MatchEvent {
  id: string;
  sport: Sport;
  event_type: string; // cricket: six/boundary/wicket/dot/single. football: goal/assist/yellow_card/red_card/substitution
  player_name: string;
  team: string;
  minute?: number;
  over_number?: number;
  details?: Record<string, string>;
  commentary?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  expires_at: string;
}

export interface WSMessage {
  type:
    | 'score_update'
    | 'chat'
    | 'leaderboard_update'
    | 'quiz_question'
    | 'quiz_result'
    | 'game_update'
    | 'fan_count'
    | 'edit_window'
    | 'match_event'
    | 'playing_xi_announced'
    | 'error'
    | 'pong';
  payload: unknown;
}

export interface WeightageShopItem {
  id: string;
  label: string;
  description: string;
  extra_weightage: number;
  price_inr: number;
  price_paise: number;
}

export const SHOP_ITEMS: WeightageShopItem[] = [
  {
    id: 'boost_2',
    label: '+2 Weightage boost',
    description: 'Add 2 extra weightage points to your budget for this match.',
    extra_weightage: 2,
    price_inr: 19,
    price_paise: 1900,
  },
  {
    id: 'power_5',
    label: '+5 Power pack',
    description: '5 bonus weightage points + skip the edit lock once.',
    extra_weightage: 5,
    price_inr: 39,
    price_paise: 3900,
  },
];
