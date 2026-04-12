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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoJoined, setAutoJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'myteam' | 'leaderboard'>('myteam');

  const sport: Sport = room?.sport || 'cricket';
  const selectedPlayers = game?.player_weightages.filter(pw => pw.selected) || [];

  useEffect(() => { setSport(sport); }, [sport, setSport]);

  // Auto-join game when user is authenticated and hasn't joined
  useEffect(() => {
    if (user && room && !game && !autoJoined && roomId) {
      setAutoJoined(true);
      joinGame();
    }
  }, [user, room, game, autoJoined, roomId]);

  // If room is locked (match started) and squad is locked, skip pitch view
  useEffect(() => {
    if (game?.squad_locked && room?.status === 'locked') {
      setPitchView(false);
    }
  }, [game?.squad_locked, room?.status]);

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

  const AV = [
    { bg: 'rgba(45,214,122,0.12)', c: '#2dd67a' },
    { bg: 'rgba(245,158,11,0.12)', c: '#f59e0b' },
    { bg: 'rgba(139,92,246,0.12)', c: '#8b5cf6' },
    { bg: 'rgba(59,130,246,0.12)', c: '#3b82f6' },
    { bg: 'rgba(240,82,82,0.12)', c: '#f05252' },
  ];

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
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>{room.match_name}</div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                    {room.league || ''} · {room.match_format || room.sport} · {room.venue || ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {room.status === 'locked' && <span className="badge badge-live"><span className="animate-pulse-slow">●</span> LOCKED</span>}
                  {canEditTeam && game && (
                    <button onClick={() => setPitchView(true)} className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}>Edit squad</button>
                  )}
                </div>
              </div>

              {/* Scoreboard */}
              <div className="flex items-center justify-between rounded-[14px] px-5 py-4" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="text-center flex-1">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--muted)', marginBottom: 3 }}>{a1}</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>
                    {scoreData?.team1?.score || (room.status === 'locked' ? '0/0' : '—')}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)', marginTop: 2 }}>
                    {scoreData?.team1?.overs ? `${scoreData.team1.overs} overs` : room.status === 'locked' ? '0.0 overs' : t1}
                  </div>
                </div>
                <div className="text-center" style={{ padding: '0 16px' }}>
                  {room.status === 'locked' ? (
                    <>
                      <div className="animate-pulse-slow" style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', marginBottom: 2 }}>● LIVE</div>
                      {scoreData?.current_rate ? <div className="text-[12px] font-semibold" style={{ color: 'var(--amber)' }}>CRR {scoreData.current_rate}</div> : null}
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--faint)' }}>vs</div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                        {room.match_date ? new Date(room.match_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </>
                  )}
                </div>
                <div className="text-center flex-1">
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--muted)', marginBottom: 3 }}>{a2}</div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: (scoreData?.team2?.score && scoreData.team2.score !== '—') ? 'var(--text)' : 'var(--muted)' }}>
                    {scoreData?.team2?.score || (room.status === 'locked' ? '—' : '—')}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)', marginTop: 2 }}>
                    {scoreData?.team2?.overs && scoreData.team2.overs !== '—' ? `${scoreData.team2.overs} overs` : room.status === 'locked' ? 'yet to bat' : t2}
                  </div>
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
              {activeTab === 'myteam' && (
                <MyTeamTab roomId={room.id} />
              )}
              {activeTab === 'leaderboard' && (
                <LeaderboardTab roomId={room.id} />
              )}
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

          {/* ═══ RIGHT: Squad + Performance ═══ */}
          <div className="flex flex-col overflow-hidden" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 12 }}>YOUR PERFORMANCE</div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 34, fontWeight: 900, color: 'var(--green)', letterSpacing: '-1px' }}>
                  {game?.total_points || 0}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>points</div>
              </div>
              <div className="flex items-center gap-2">
                {room.status === 'open' ? (
                  <button onClick={() => setPitchView(true)} className="text-[11px] font-semibold rounded-full px-2.5 py-1 border-none cursor-pointer" style={{ background: 'rgba(45,214,122,0.08)', border: '1px solid rgba(45,214,122,0.25)', color: 'var(--green)' }}>
                    {game?.squad_locked ? 'Edit XI →' : 'Build XI →'}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>🔒 Locked</span>
                )}
                {lastUpdated && (
                  <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ padding: '14px 18px' }}>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginBottom: 10 }}>YOUR SQUAD</div>
              {selectedPlayers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">🏏</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Build your squad to see players here</div>
                </div>
              ) : (
                selectedPlayers.map((pw, i) => {
                  const av = AV[i % AV.length];
                  return (
                    <div key={pw.player_id} className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 mb-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[8px] font-bold shrink-0" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", background: av.bg, color: av.c }}>
                        {pw.player_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 text-[12px] font-medium truncate">{pw.player_name.split(' ').pop()}</div>
                      <div className="text-[13px] font-extrabold shrink-0" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", color: 'var(--amber)' }}>{pw.weightage}x</div>
                      <div className="text-[11px] min-w-[40px] text-right shrink-0" style={{ color: pw.points_earned > 0 ? 'var(--green)' : 'var(--muted)' }}>
                        {pw.points_earned > 0 ? `${pw.points_earned}pts` : '—'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1.5 px-4 py-2" style={{ borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              {fanCount > 0 ? fanCount : room.fan_count || 0} fans watching
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
