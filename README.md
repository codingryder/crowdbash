# Crowdbash

Live cricket watchalong platform with real-time scoring, fan chat, AI quizzes, and the Weightage Game.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your .env values
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your .env.local values
npm run dev
```

### Database
Run `backend/migrations/001_initial_schema.sql` against your Neon PostgreSQL database.

## Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

## Architecture

- **Frontend**: React 18 + Vite + TypeScript + Tailwind + Zustand
- **Backend**: Python FastAPI + WebSockets
- **Database**: PostgreSQL on Neon
- **Cache/Leaderboard**: Upstash Redis
- **Auth**: Supabase Auth
- **Cricket Data**: CricAPI
- **Quiz AI**: Google Gemini 2.5 Flash
- **Payments**: Razorpay

## Keys to Obtain Before Running

| Service | Where to get | Free tier |
|---|---|---|
| CricAPI key | https://cricapi.com | 100 calls/day |
| Gemini API key | https://aistudio.google.com | 15 RPM free |
| Supabase project | https://supabase.com | 50k MAU free |
| Neon database | https://neon.tech | 0.5 GB free |
| Upstash Redis | https://upstash.com | 10k req/day free |
| Razorpay | https://razorpay.com | 2% per txn, no monthly fee |

---

*Built by Rakesh*
