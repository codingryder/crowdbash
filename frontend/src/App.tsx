import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { Footer } from './components/layout/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { TermsAcceptModal } from './components/auth/TermsAcceptModal';
import { HomePage } from './pages/HomePage';
import { GamesPage } from './pages/GamesPage';
import { LeaguePage } from './pages/LeaguePage';
import { CrowdbashRoomPage } from './pages/CrowdbashRoomPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { RewardsPage } from './pages/RewardsPage';
import { TermsPage, PrivacyPage } from './pages/LegalPages';

function AppContent() {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav />
      <AuthModal />
      <TermsAcceptModal />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/league/:leagueName" element={<LeaguePage />} />
          <Route path="/room/:roomId" element={<CrowdbashRoomPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/leaderboard/:roomId" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
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
