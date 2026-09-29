# Stock Portfolio & Alerts Platform

Internship evaluation app matching the assignment requirements.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python **FastAPI** |
| Frontend | **React** (Vite) |
| Database | **MongoDB** (users, portfolios, alerts) |
| Auth | **JWT** (access token + refresh token) |
| Market data | **Yahoo Finance** chart API v8 |
| Email | **Gmail SMTP** (credentials from `.env`) |

## Market data choice (justification)

**Yahoo Finance** (`https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}`):

- Covers NSE stocks with `.NS` suffix and Nifty (`^NSEI`) in **INR**
- Free, no API key — fits refreshing ~100 symbols every few minutes
- Alternatives (Alpha Vantage / Twelve Data free tiers) have quotas too small for this loop
- Near-real-time / delayed quotes; not exchange-grade

**Limitation:** free Yahoo may rate-limit or return partial data. The app uses as many symbols as returned, caches last prices in MongoDB, and does not crash on failures.

**Refresh interval:** every **2 minutes** (APScheduler background job).

## Features (assignment map)

- **4.1 Auth** — email/password register & login, JWT, users only access their own portfolio/alerts
- **4.2 Dashboard** — top ~100 NSE stocks, table + charts, prices in INR
- **4.3 Portfolio** — user selects ~10–15 stocks (max 15)
- **4.4 Alerts** — above/below threshold; email per user; `one_time` or `recurring` (re-arms after reverse cross) to avoid spam
- **4.5 Scheduler** — 2‑min price refresh + alert evaluation; handles closed market / rate limits
- **4.6 Email** — Gmail SMTP via env vars (`SMTP_ENABLED=false` logs to console for local demo)

## Security

- Passwords: **bcrypt**
- JWT access expiry: **30 minutes** (refresh tokens included)
- Input validation (Pydantic), CORS from env
- Secrets only in `.env` (never committed)

## Run

```bash
# MongoDB must be running

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # set JWT_SECRET, Mongo, optional SMTP
uvicorn app.main:app --reload --port 8000

# Frontend
cd vite-project
npm install
copy .env.example .env          # VITE_API_URL=http://127.0.0.1:8000/api
npm run dev
```

- App: http://localhost:5173  
- API docs: http://localhost:8000/docs  

## Demo

1. Register → Login  
2. Portfolio → pick ~10–15 stocks → Save  
3. Market → table + charts  
4. Alerts → set above/below → wait for scheduler (or check backend logs if SMTP off)  
