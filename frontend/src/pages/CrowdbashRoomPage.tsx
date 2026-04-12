import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRoom } from '../hooks/useRoom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGame } from '../hooks/useGame';
import { useAuth } from '../hooks/useAuth';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import { TeamBuilderModal } from '../components/game/TeamBuilderModal';
import { PitchWelcomeView } from '../components/game/PitchWelcomeView';
import { CompletedMatchView } from '../components/room/CompletedMatchView';
import { ChatPanel, ChatInput } from '../components/room/ChatPanel';
import { MyTeamTab } from '../components/room/MyTeamTab';
import { LeaderboardTab } from '../components/room/LeaderboardTab';
import api from '../lib/api';
import type { ScoreData, Sport, CricketScoreData } from '../types';
import { splitTeams } from '../types';

export function CrowdbashRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, loading } = useRoom(roomId);
  const { sendChat } = useWebSocket(roomId);
  const { joinGame, selectSquad, lockSquad, saveWeightages } = useGame(roomId);
  const { user, openAuthModal } = useAuth();
  const fanCount = useRoomStore((s) => s.fanCount);
  const score = useRoomStore((s) => s.score);
  const setSport = useRoomStore((s) => s.setSport);
  const setScore = useRoomStore((s) => s.setScore);
  const showTeamBuilder = useGameStore((s) => s.showTeamBuilder);
  const setShowTeamBuilder = useGameStore((s) => s.setShowTeamBuilder);
  const game = useGameStore((s) => s.game);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const [pitchView, setPitchView] = useState(true);
  const [_lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoJoined, setAutoJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'myteam' | 'leaderboard'>('myteam');

  const sport: Sport = room?.sport || 'cricket';
  void game?.player_weightages; // used by MyTeamTab via gameStore

  useEffect(() => { setSport(sport); }, [sport, setSport]);

  // Auto-join game when user is authenticated and hasn't joined
  useEffect(() => {
    if (user && room && !game && !autoJoined && roomId) {
      setAutoJoined(true);
      joinGame();
    }
  }, [user, room, game, autoJoined, roomId]);

  // If squad is already locked, go straight to room view
  useEffect(() => {
    if (game?.squad_locked) {
      setPitchView(false);
    }
  }, [game?.squad_locked]);

  // Fetch score on mount + poll
  useEffect(() => {
    if (!roomId || !room || room.status !== 'locked') return;
    async function fetchScore() {
      try {
        const { data } = await api.get(`/api/rooms/scorecard/${roomId}`);
        if (data.scorecard) { setScore(data.scorecard as ScoreData); setLastUpdated(new Date()); }
      } catch { /* */ }
    }
    fetchScore();
    const interval = setInterval(fetchScore, 15000);
    return () => clearInterval(interval);
  }, [roomId, room?.status]);

  if (loading) return <div className="flex items-center justify-center" style={{ height: '100vh', paddingTop: 60 }}><div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--muted)' }}>Loading room...</div></div>;
  if (!room) return <div className="flex items-center justify-center" style={{ height: '100vh', paddingTop: 60 }}><div className="text-center"><div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }}>Room not found</div><Link to="/" className="text-[13px] no-underline" style={{ color: 'var(--green)' }}>Back to home</Link></div></div>;
  if (room.status === 'closed') return <CompletedMatchView room={room} />;

  if (!user) return (
    <div className="flex items-center justify-center" style={{ height: '100vh', paddingTop: 60 }}>
      <div className="text-center" style={{ maxWidth: 400 }}>
        <div className="text-3xl mb-4">🏟️</div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{room.match_name}</div>
        <div className="text-[13px] mb-6" style={{ color: 'var(--muted)' }}>Sign in to join this room and play the fantasy game</div>
        <button onClick={openAuthModal} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }}>Sign in to play</button>
      </div>
    </div>
  );

  // ── PITCH VIEW (shown when room is open — user can edit team anytime before match) ──
  const canEditTeam = room.status === 'open';
  if (pitchView && canEditTeam) {
    return (
      <PitchWelcomeView
        roomId={room.id}
        roomName={room.match_name}
        sport={sport}
        onComplete={() => setPitchView(false)}
      />
    );
  }

  // ── NORMAL ROOM VIEW ──
  const scoreData = score as CricketScoreData | null;
  const [t1, t2] = splitTeams(room.match_name);
  const a1 = t1.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const a2 = t2.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();

  const isLive = room.status === 'locked';
  const t1Score = scoreData?.team1?.score || (isLive ? '0/0' : '—');
  const t2Score = scoreData?.team2?.score || '—';
  const t1Overs = scoreData?.team1?.overs || (isLive ? '0.0' : '');
  const t2Overs = scoreData?.team2?.overs || '';
  const crr = scoreData?.current_rate || 0;

  // Current batting/bowling from scorecard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd = scoreData as any;
  const currentBatting = sd?.current_batting as Array<{ name: string; runs: number; balls: number }> | undefined;
  const currentBowling = sd?.current_bowling as Array<{ name: string; wickets: number; runs: number; overs: string }> | undefined;

  return (
    <>
      {showTeamBuilder && (
        <TeamBuilderModal
          roomName={room.match_name}
          onSelectSquad={selectSquad}
          onSaveWeightages={saveWeightages}
          onLockSquad={lockSquad}
          onClose={() => setShowTeamBuilder(false)}
        />
      )}

      <div style={{ paddingTop: 60, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>
          {/* ═══ LEFT: Main content ═══ */}
          <div className="flex flex-col overflow-hidden">
            {/* Header — match name + actions only (no scoreboard) */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>{room.match_name}</div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                    {room.league || ''} · {room.match_format || room.sport} · {room.venue || ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLive && <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> LIVE</span>}
                  {canEditTeam && game && (
                    <button onClick={() => setPitchView(true)} className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}>Edit your XI</button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0" style={{ padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
              {([
                { key: 'myteam' as const, label: 'My Team' },
                { key: 'leaderboard' as const, label: 'Leaderboard' },
                { key: 'chat' as const, label: 'Chat' },
              ]).map(tab => (
                <div
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-3 text-[13px] font-semibold"
                  style={{
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    color: activeTab === tab.key ? 'var(--green)' : 'var(--muted)',
                    borderBottom: activeTab === tab.key ? '2px solid var(--green)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            {/* Edit window banner */}
            {editWindowOpen && (
              <div className="flex items-center justify-between shrink-0" style={{ background: 'var(--surface2)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 'var(--radius)', padding: '14px 18px', margin: '18px 24px 0' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[17px]" style={{ background: 'rgba(139,92,246,0.12)' }}>🔄</div>
                  <div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800 }}>Power reshuffle window</div>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Redistribute your power · changes are blind</div>
                  </div>
                </div>
                <button onClick={() => setPitchView(true)} className="btn" style={{ background: 'var(--purple)', color: '#fff', padding: '8px 18px', fontSize: 12 }}>
                  Reshuffle power ↗
                </button>
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {activeTab === 'myteam' && <MyTeamTab roomId={room.id} />}
              {activeTab === 'leaderboard' && <LeaderboardTab roomId={room.id} />}
              {activeTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
                    <ChatPanel onSendChat={sendChat} />
                  </div>
                  <div style={{ padding: '0 24px 12px' }}>
                    <ChatInput onSendChat={sendChat} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: MATCH INFO PANEL ═══ */}
          <div className="flex flex-col overflow-hidden" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg2)' }}>

            {/* Scoreboard + CRR inline */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)' }}>MATCH SCORE</div>
                <div className="flex items-center gap-2">
                  {crr > 0 && <span className="text-[10px] font-semibold" style={{ color: 'var(--amber)' }}>CRR {crr.toFixed(2)}</span>}
                  {isLive && <span className="animate-pulse-slow" style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)' }}>● LIVE</span>}
                  {!isLive && room.match_date && <span className="text-[10px]" style={{ color: 'var(--amber)' }}>{new Date(room.match_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>

              {/* Team 1 */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800 }}>{a1}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t1}</div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 22, fontWeight: 900 }}>{t1Score}</div>
                  {t1Overs && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>({t1Overs})</div>}
                </div>
              </div>

              {/* Team 2 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800 }}>{a2}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t2}</div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 22, fontWeight: 900, color: t2Score === '—' ? 'var(--muted)' : 'var(--text)' }}>{t2Score}</div>
                  {t2Overs && t2Overs !== '—' && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>({t2Overs})</div>}
                </div>
              </div>
            </div>

            {/* Current batters */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="text-[9px] font-bold tracking-wider mb-2.5" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>AT THE CREASE</div>
              {currentBatting && currentBatting.length > 0 ? currentBatting.map((b, i) => (
                <div key={i} className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-medium">{b.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>{b.runs}</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>({b.balls}b)</span>
                  </div>
                </div>
              )) : (
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{isLive ? 'Waiting for data...' : 'Match not started'}</div>
              )}
            </div>

            {/* Current bowler */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="text-[9px] font-bold tracking-wider mb-2.5" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>BOWLING</div>
              {currentBowling && currentBowling.length > 0 ? currentBowling.map((b, i) => (
                <div key={i} className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-medium">{b.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 800, color: 'var(--purple)' }}>{b.wickets}/{b.runs}</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>({b.overs} ov)</span>
                  </div>
                </div>
              )) : (
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{isLive ? 'Waiting for data...' : 'Match not started'}</div>
              )}
            </div>

            {/* Spacer + fan count */}
            <div style={{ flex: 1 }} />
            <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5" style={{ borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              {fanCount > 0 ? fanCount : room.fan_count || 0} fans watching
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
