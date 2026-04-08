import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { HomePage } from './pages/HomePage';
import { CrowdbashRoomPage } from './pages/CrowdbashRoomPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg">
        <TopNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<CrowdbashRoomPage />} />
          <Route path="/leaderboard/:roomId" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
