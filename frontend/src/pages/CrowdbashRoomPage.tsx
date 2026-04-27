import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { ScorecardModal } from '../components/room/ScorecardModal';
import { ChatPanel, ChatInput } from '../components/room/ChatPanel';
import { MyTeamTab } from '../components/room/MyTeamTab';
import { LeaderboardTab } from '../components/room/LeaderboardTab';
import api from '../lib/api';
import type { ScoreData, Sport, CricketScoreData } from '../types';
import { splitTeams } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const setMessages = useRoomStore((s) => s.setMessages);
  const messages = useRoomStore((s) => s.messages);
  const showTeamBuilder = useGameStore((s) => s.showTeamBuilder);
  const setShowTeamBuilder = useGameStore((s) => s.setShowTeamBuilder);
  const game = useGameStore((s) => s.game);
  const editWindowOpen = useGameStore((s) => s.editWindowOpen);
  const [pitchView, setPitchView] = useState(true);
  const [_lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoJoined, setAutoJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'myteam' | 'leaderboard' | 'rules'>('myteam');
  const [showScorecard, setShowScorecard] = useState(false);
  const isMobile = useIsMobile();
  const [showMatchInfo, setShowMatchInfo] = useState(false);

  const sport: Sport = room?.sport || 'cricket';
  void game?.player_weightages; // used by MyTeamTab via gameStore

  // Chat unread badge: count messages from other users that arrived
  // since the last time this user had the Chat tab open.
  const othersMessageCount = useMemo(
    () => messages.filter((m) => m.user_id !== user?.id).length,
    [messages, user?.id],
  );
  const [chatSeenCount, setChatSeenCount] = useState(0);
  const chatSeenInitialized = useRef(false);
  useEffect(() => {
    // First time we see any messages (history load), anchor the baseline so
    // the existing thread doesn't show up as unread.
    if (!chatSeenInitialized.current && othersMessageCount > 0) {
      setChatSeenCount(othersMessageCount);
      chatSeenInitialized.current = true;
      return;
    }
    if (activeTab === 'chat') {
      setChatSeenCount(othersMessageCount);
      chatSeenInitialized.current = true;
    }
  }, [activeTab, othersMessageCount]);
  const chatUnread = activeTab === 'chat' ? 0 : Math.max(0, othersMessageCount - chatSeenCount);

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

  // Hydrate the reshuffle window from persisted room state.
  // The WS open broadcast is one-shot, so any client that reloaded /
  // reconnected mid-window would otherwise miss it entirely. This effect
  // reads room.edit_window_closes_at (refreshed by useRoom on poll/focus)
  // and flips editWindowOpen on with a timer that auto-closes when the
  // remaining time elapses.
  useEffect(() => {
    const closesAtIso = room?.edit_window_closes_at;
    const setRoomEdit = useRoomStore.getState().setEditWindow;
    const setGameEdit = useGameStore.getState().setEditWindow;
    if (!closesAtIso) return;
    const closesAtMs = new Date(closesAtIso).getTime();
    const remainingMs = closesAtMs - Date.now();
    if (remainingMs <= 0) {
      setRoomEdit(false);
      setGameEdit(false);
      return;
    }
    setRoomEdit(true);
    setGameEdit(true);
    const t = setTimeout(() => {
      setRoomEdit(false);
      setGameEdit(false);
    }, remainingMs);
    return () => clearTimeout(t);
  }, [room?.edit_window_closes_at]);

  // Load chat history when entering the room, on visibility/focus changes,
  // and whenever the user opens the Chat tab. Mobile browsers suspend WS in
  // background, so messages sent while the tab was hidden never arrive —
  // refetching on these events fills the gap.
  // Always merge with the in-store messages (de-duped by id) so a live WS
  // message that arrived during the REST round-trip isn't dropped.
  const loadChatHistory = useCallback(async () => {
    if (!roomId) return;
    try {
      const { data } = await api.get(`/api/rooms/${roomId}/chat`);
      if (!Array.isArray(data)) return;
      const existing = useRoomStore.getState().messages;
      const seen = new Set(data.map((m: { id: string }) => m.id));
      const merged = [...data, ...existing.filter((m) => !seen.has(m.id))];
      setMessages(merged);
    } catch { /* */ }
  }, [roomId, setMessages]);

  useEffect(() => {
    if (!roomId) return;
    loadChatHistory();
    function onVisible() {
      if (document.visibilityState === 'visible') loadChatHistory();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadChatHistory);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadChatHistory);
    };
  }, [roomId, loadChatHistory]);

  // Refresh chat every time the Chat tab is opened
  useEffect(() => {
    if (activeTab === 'chat') loadChatHistory();
  }, [activeTab, loadChatHistory]);

  // Fetch score on mount + poll (regardless of room status — match may be live)
  useEffect(() => {
    if (!roomId || !room) return;
    async function fetchScore() {
      try {
        const { data } = await api.get(`/api/rooms/scorecard/${roomId}`);
        if (data.scorecard) { setScore(data.scorecard as ScoreData); setLastUpdated(new Date()); }
      } catch { /* */ }
    }
    fetchScore(); // immediate fetch on load
    const pollInterval = room.status === 'locked' ? 15000 : 60000; // 15s when live, 60s when open
    const interval = setInterval(fetchScore, pollInterval);
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

  // ── PITCH VIEW (shown when room is open — user can edit team anytime before match,
  // or during a late-join window granted by the backend for specific rooms) ──
  const canEditTeam = room.status === 'open' || !!room.late_join_open;
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
      {showScorecard && (
        <ScorecardModal
          roomId={room.id}
          roomName={room.match_name}
          onClose={() => setShowScorecard(false)}
        />
      )}
      {showTeamBuilder && (
        <TeamBuilderModal
          roomName={room.match_name}
          onSelectSquad={selectSquad}
          onSaveWeightages={saveWeightages}
          onLockSquad={lockSquad}
          onClose={() => setShowTeamBuilder(false)}
        />
      )}

      {/* Mobile bottom-sheet backdrop */}
      {isMobile && showMatchInfo && (
        <div
          onClick={() => setShowMatchInfo(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
            transition: 'opacity 200ms ease',
          }}
        />
      )}

      <div style={{ paddingTop: 60, height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: isMobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: isMobile ? undefined : '1fr 300px', overflow: 'hidden' }}>
          {/* ═══ LEFT: Main content ═══ */}
          <div className="flex flex-col overflow-hidden" style={{ flex: 1, display: 'flex' }}>
            {/* Header */}
            <div style={{ padding: isMobile ? '10px 12px' : '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {room.late_join_open && room.status === 'locked' && (
                <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(244,185,64,0.08)', border: '1px solid rgba(244,185,64,0.3)' }}>
                  <span style={{ fontSize: 12 }}>⚡</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--amber)' }}>
                    Late-join open · {(room.late_join_overs_remaining ?? 0).toFixed(1)} overs left to build your XI
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>{room.match_name}</div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                    {room.league || ''} · {room.match_format || room.sport} · {room.venue || ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLive && <span className="badge badge-live" style={{ fontSize: 10 }}><span className="animate-pulse-slow">●</span> LIVE</span>}
                  {isMobile && (
                    <button
                      onClick={() => setShowMatchInfo(true)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      📊 Score
                    </button>
                  )}
                  {canEditTeam && game && (
                    <button onClick={() => setPitchView(true)} className="btn btn-ghost" style={{ fontSize: isMobile ? 11 : 12, padding: isMobile ? '5px 10px' : '7px 14px' }}>Edit XI</button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div
              className="flex shrink-0"
              style={{
                padding: isMobile ? '0 8px' : '0 24px',
                borderBottom: '1px solid var(--border)',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollbarWidth: 'none',
              }}
            >
              {([
                { key: 'myteam' as const, label: 'My Team' },
                { key: 'leaderboard' as const, label: 'Leaderboard' },
                { key: 'chat' as const, label: 'Chat' },
                { key: 'rules' as const, label: 'How to Play' },
              ]).map(tab => (
                <div
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 600,
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    color: activeTab === tab.key ? 'var(--green)' : 'var(--muted)',
                    borderBottom: activeTab === tab.key ? '2px solid var(--green)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {tab.label}
                  {tab.key === 'chat' && chatUnread > 0 && (
                    <span
                      className="animate-pulse-slow"
                      style={{
                        background: 'var(--red)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        fontFamily: "'Cabinet Grotesk', sans-serif",
                        borderRadius: 999,
                        padding: '2px 6px',
                        lineHeight: 1,
                        minWidth: 16,
                        height: 16,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      +{chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Edit window banner */}
            {editWindowOpen && (
              <div className="flex items-center justify-between shrink-0 animate-fadeup" style={{ background: 'var(--surface2)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 'var(--radius)', padding: '14px 18px', margin: '12px 24px 0' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[17px]" style={{ background: 'rgba(139,92,246,0.12)' }}>🔄</div>
                  <div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 13, fontWeight: 800 }}>Power reshuffle window open!</div>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>5 min to redistribute power · changes are blind · auto-locks when time is up</div>
                  </div>
                </div>
                <button onClick={() => setPitchView(true)} className="btn" style={{ background: 'var(--purple)', color: '#fff', padding: '8px 18px', fontSize: 12 }}>
                  Reshuffle power ↗
                </button>
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {activeTab === 'myteam' && <MyTeamTab roomId={room.id} matchStarted={room.status === 'locked'} />}
              {activeTab === 'leaderboard' && (
                <LeaderboardTab
                  roomId={room.id}
                  matchStarted={!!room.match_date && new Date(room.match_date) <= new Date()}
                />
              )}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ChatPanel onSendChat={sendChat} />
                  <ChatInput onSendChat={sendChat} />
                </div>
              )}
              {activeTab === 'rules' && (
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900, marginBottom: 16 }}>How to Play</div>
                  <div className="space-y-4">
                    {[
                      { icon: '🎯', title: 'Pick 11 Players', desc: 'Build your fantasy XI from both teams. Role caps apply: max 6 batters, max 3 all-rounders, max 5 bowlers, and at least 1 wicket-keeper.' },
                      { icon: '⚡', title: 'Assign Power (33 pts)', desc: 'Distribute 33 power points across your 11 players. Min 1x, max 6x per player. Higher power = more points when that player performs.' },
                      { icon: '🏏', title: 'Scoring', desc: 'Batting: 1pt/run + 4pt/four + 6pt/six + milestones. Bowling: 25pt/wicket + 10pt/maiden. Fielding: 10pt/catch + 15pt/stumping. Your score = fantasy points × power.' },
                      { icon: '🔒', title: 'Lock & Play', desc: 'Lock your XI before the match starts. Once the match begins, late arrivals can chat and follow the score in spectator mode but can\'t join the game.' },
                      { icon: '🔄', title: 'Power Reshuffle', desc: 'A 5-minute reshuffle window opens three times per match: after 10 overs of the 1st innings, at the innings break (end of 1st innings), and after 10 overs of the 2nd innings. You can only change power, not players. Changes are blind.' },
                      { icon: '🏆', title: 'Win', desc: 'The player with the highest total points at the end of the match wins. Points update live as the match progresses.' },
                    ].map((rule, i) => (
                      <div key={i} className="flex gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{rule.icon}</div>
                        <div>
                          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800, marginBottom: 3 }}>{rule.title}</div>
                          <div className="text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{rule.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: MATCH INFO PANEL — desktop side panel / mobile bottom sheet ═══ */}
          <div
            className="flex flex-col overflow-y-auto"
            style={
              isMobile
                ? {
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
                    height: '85vh', maxHeight: '85vh',
                    background: 'var(--bg2)',
                    borderTop: '1px solid var(--border)',
                    borderTopLeftRadius: 16, borderTopRightRadius: 16,
                    boxShadow: '0 -10px 30px rgba(0,0,0,0.45)',
                    transform: showMatchInfo ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 240ms cubic-bezier(0.32,0.72,0,1)',
                    visibility: showMatchInfo ? 'visible' : 'hidden',
                  }
                : { borderLeft: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex' }
            }
          >

            {/* Mobile sheet header with drag handle */}
            {isMobile && (
              <div style={{ flexShrink: 0, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
                </div>
                <div className="flex items-center justify-between" style={{ padding: '4px 14px 10px' }}>
                  <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--muted)' }}>SCORE</div>
                  <button
                    onClick={() => setShowMatchInfo(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0, fontFamily: "'Cabinet Grotesk', sans-serif" }}
                    aria-label="Close score sheet"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

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

            {/* Scorecard button */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => {
                  // Close the mobile score bottom sheet first so the modal
                  // doesn't open on top of it (and so the sheet doesn't
                  // re-appear when the user closes the modal).
                  if (isMobile) setShowMatchInfo(false);
                  setShowScorecard(true);
                }}
                className="w-full flex items-center justify-center gap-2"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--green)', cursor: 'pointer', fontFamily: "'Cabinet Grotesk', sans-serif" }}
              >
                📊 Full Scorecard
              </button>
            </div>

            {/* Match Info: series, toss, venue, umpires */}
            <MatchInfoCard roomId={room.id} matchDateGmt={room.match_date} />

            {/* Top 3 Leaders */}
            <MiniLeaderboard roomId={room.id} />

            {/* Spacer + fan count */}
            <div style={{ flex: 1 }} />
            <div
              className="shrink-0 flex items-center gap-1.5 px-4"
              style={{
                borderTop: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--muted)',
                paddingTop: 10,
                paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : 10,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              {fanCount > 0 ? fanCount : room.fan_count || 0} fans watching
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Match Info card (series, toss, venue, umpires, multi-tz time) ── */
interface MatchInfo {
  match_name: string;
  match_short: string;
  match_number: string;
  series: string;
  match_date_gmt: string;
  venue: string;
  toss: string;
  umpires: string[];
  tv_umpire: string;
  referee: string;
  reserve_umpire: string;
}

function MatchInfoCard({ roomId, matchDateGmt }: { roomId: string; matchDateGmt?: string }) {
  const [info, setInfo] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/rooms/info/${roomId}`);
        if (!cancelled) setInfo(data?.info || null);
      } catch { /* */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  if (loading || !info) return null;

  // Multi-timezone display from the GMT match date
  const dateStr = info.match_date_gmt || matchDateGmt || '';
  let dateLabel = '';
  let timeLine = '';
  if (dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (sameDay(d, today)) dateLabel = 'Today';
    else if (sameDay(d, tomorrow)) dateLabel = 'Tomorrow';
    else dateLabel = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const hm = (tz: string, label: string) => {
      const t = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d);
      return `${t} ${label}`;
    };
    const local = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(d);
    timeLine = `${local} LOCAL · ${hm('UTC', 'GMT')} · ${hm('America/Los_Angeles', 'PT')} · ${hm('America/New_York', 'ET')}`;
  }

  const rows: Array<{ label: string; value: string }> = [];
  const matchLine = [info.match_short || info.match_name, info.match_number, info.series].filter(Boolean).join(' · ');
  if (matchLine) rows.push({ label: 'Match', value: matchLine });
  if (info.series) rows.push({ label: 'Series', value: info.series });
  if (dateLabel) rows.push({ label: 'Date', value: dateLabel });
  if (timeLine) rows.push({ label: 'Time', value: timeLine });
  if (info.toss) rows.push({ label: 'Toss', value: info.toss });
  if (info.venue) rows.push({ label: 'Venue', value: info.venue });
  if (info.umpires.length) rows.push({ label: 'Umpires', value: info.umpires.join(', ') });
  if (info.tv_umpire) rows.push({ label: '3rd Umpire', value: info.tv_umpire });
  if (info.referee) rows.push({ label: 'Referee', value: info.referee });

  if (!rows.length) return null;

  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div className="text-[9px] font-bold tracking-wider mb-3" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>MATCH INFO</div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid" style={{ gridTemplateColumns: '78px 1fr', gap: 8 }}>
            <div className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>{r.label.toUpperCase()}</div>
            <div className="text-[11px]" style={{ color: 'var(--text)', lineHeight: 1.5 }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mini Leaderboard (top 3) for right panel ── */
function MiniLeaderboard({ roomId }: { roomId: string }) {
  const [leaders, setLeaders] = useState<Array<{ user_id: string; username?: string; points: number; rank: number; prev_rank?: number }>>([]);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await api.get(`/api/leaderboard/${roomId}?limit=3`);
        if (Array.isArray(data)) setLeaders(data.slice(0, 3));
      } catch { /* */ }
    }
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [roomId]);

  const rankColors = ['var(--amber)', '#A8B4C0', '#CD8F5A'];
  const rankIcons = ['🥇', '🥈', '🥉'];

  if (leaders.length === 0) {
    return (
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="text-[9px] font-bold tracking-wider mb-2.5" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>TOP PLAYERS</div>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>No players yet</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div className="text-[9px] font-bold tracking-wider mb-3" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>TOP PLAYERS</div>
      {leaders.map((entry, i) => {
        const delta = entry.prev_rank != null ? entry.prev_rank - entry.rank : 0;
        return (
          <div key={entry.user_id} className="flex items-center gap-2.5 mb-2.5">
            {/* Rank icon */}
            <div style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{rankIcons[i] || `${i + 1}`}</div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate">{entry.username || `Player ${i + 1}`}</div>
            </div>

            {/* Movement arrow */}
            {delta !== 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>
                {delta > 0 ? '▲' : '▼'}
              </div>
            )}

            {/* Points */}
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 14, fontWeight: 800, color: rankColors[i] || 'var(--text)', minWidth: 36, textAlign: 'right' }}>
              {entry.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}
