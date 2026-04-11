# BandReady — IELTS & CELPIP Exam Simulation

Monorepo: **Laravel 12 API** (`backend/`) + **React (Vite) SPA** (`frontend/`), **Bootstrap 5**, **PostgreSQL-ready** (default dev: SQLite).

## Quick start (development)

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

API base URL: `http://127.0.0.1:8000/api`.

**PostgreSQL:** set `DB_CONNECTION=pgsql` and database credentials in `.env`, then `php artisan migrate --seed`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` to the Laravel server. Open `http://localhost:5173`.

### 3. Seeded accounts

| Email | Password | Role |
|--------|------------|------|
| admin@bandready.test | password | admin |
| student@bandready.test | password | user |

Guests can run **Quick Practice** tests only (no login). Signed-in users get full mocks, section practice, history, and resume.

## Production build (frontend)

```bash
cd frontend
npm run build
```

Point your web server or Laravel to serve `frontend/dist` (e.g. copy contents into `backend/public/app` and add a catch-all route), or host the SPA and set `VITE_API_URL` to your API origin.

## Features

- Exam selection (IELTS Academic/General, CELPIP General/LS), practice modes (full / section / quick).
- Fullscreen-style exam UI: timer, question grid, flags, autosave, submit confirmation, auto-submit on timeout.
- Results with score estimate, explanations, time used.
- Admin: exams, sections, tests, questions, ads, dashboard metrics, charts.
- Ad slots (component `AdSlot.jsx`) and click tracking API.

## API overview

Public: `GET /exams`, `GET /tests`, `GET /tests/{id}`, `POST /start-attempt`, `GET /attempts/{id}/resume`, `POST /save-answer`, `POST /submit-attempt`, `GET /results/{id}`, `GET /ads`.

Auth: `POST /register`, `POST /login`, `POST /logout` (Bearer Sanctum token), `GET /me`.

Admin (admin role): `GET/POST/PUT/DELETE /admin/...` for exams, sections, tests, questions, ads; `GET /admin/stats`, `GET /admin/stats/charts`.
