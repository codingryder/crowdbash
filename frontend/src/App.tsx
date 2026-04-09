import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { Footer } from './components/layout/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { HomePage } from './pages/HomePage';
import { LeaguePage } from './pages/LeaguePage';
import { CrowdbashRoomPage } from './pages/CrowdbashRoomPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';

function AppContent() {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
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
      {/* Footer on all pages except room pages (they have their own bottom bar) */}
      {!isRoomPage && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
