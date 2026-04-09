export type Sport = 'cricket' | 'football';

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  total_games: number;
  total_wins: number;
  weightage_balance: number;
}

export interface Room {
  id: string;
  match_id: string;
  match_name: string;
  match_format: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed';
  current_over: number;
  fan_count: number;
  sport: Sport;
  league?: string;
  season?: string;
  match_progress: Record<string, unknown>;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  role: string;
}

export interface PlayerWeightage {
  player_id: string;
  player_name: string;
  team: string;
  weightage: number;
  points_earned: number;
  player_role?: string;
  scoring_breakdown?: Record<string, number>;
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
