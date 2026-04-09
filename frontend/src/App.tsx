import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { AuthModal } from './components/auth/AuthModal';
import { HomePage } from './pages/HomePage';
import { LeaguePage } from './pages/LeaguePage';
import { CrowdbashRoomPage } from './pages/CrowdbashRoomPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <TopNav />
        <AuthModal />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/league/:leagueName" element={<LeaguePage />} />
            <Route path="/room/:roomId" element={<CrowdbashRoomPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/leaderboard/:roomId" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
