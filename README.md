# TaskFlow Pro

A freemium SaaS task management app with Stripe subscription billing, PostgreSQL persistence, session-based authentication, and a daily focus algorithm that surfaces the three most important tasks a user should work on right now.

Free tier. Pro plan at $9.99/month. Built to run in production.

---

## What Makes This a Real Product

Most task app tutorials stop at CRUD. TaskFlow Pro goes further:

- **Freemium enforcement is server-side** — limits (3 projects, 50 tasks on free) are checked in the database layer, not the frontend. The API returns `{ upgrade: true }` to drive upsell without client-side trust.
- **Stripe webhooks with signature verification** — the `/webhook` route receives raw request body before `express.json()` runs, which is required for Stripe's `constructEvent` to verify the payload. Pro upgrades happen server-to-server, not through a client-controlled flag.
- **Daily Focus algorithm** — a single SQL query surfaces the top 3 tasks ordered by: overdue first, then due today, then by priority. The user sees what actually matters — not just what was added most recently.
- **Streak tracking with date arithmetic** — checks whether yesterday's date matches the last completion date before incrementing. Handles the edge case where a user completes multiple tasks in one day without inflating the count.

---

## Tech Stack

- **Node.js + Express 5** — ESM modules throughout (`import`/`export`)
- **PostgreSQL** — `pg` pool, schema auto-initialized on server start
- **express-session + bcryptjs** — server-side sessions, passwords hashed with bcrypt (salt rounds: 10)
- **Stripe** — subscription checkout, webhook listener, customer ID stored per user
- **Vanilla HTML/CSS/JS** — no frontend framework; six static pages served from `/public`
- **Railway** — production deployment target

---

## Architecture

```
taskflowpro/
├── backend/
│   ├── server.js       — Express app, all API routes, Stripe integration
│   ├── database.js     — PostgreSQL pool, schema init, all query helpers
│   ├── package.json    — ESM module config, dependencies
│   └── .env.example    — environment variable template
└── public/
    ├── index.html      — marketing landing page
    ├── app.html        — authenticated task dashboard
    ├── login.html      — sign in
    ├── signup.html     — account creation
    ├── success.html    — post-payment confirmation
    └── cancel.html     — payment cancellation
```

---

## Database Schema

Three tables. Cascading deletes keep data clean when users or projects are removed.

```sql
users (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  is_pro            INTEGER DEFAULT 0,
  pro_activated_at  TIMESTAMPTZ,
  stripe_customer_id VARCHAR(255),
  streak_count      INTEGER DEFAULT 0,
  last_streak_date  DATE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
)

projects (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  color       VARCHAR(50) DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

tasks (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title        VARCHAR(500) NOT NULL,
  notes        TEXT DEFAULT '',
  priority     VARCHAR(20) DEFAULT 'medium',
  status       VARCHAR(20) DEFAULT 'active',
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
)
```

---

## API Reference

**Auth**
```
POST /auth/signup          — create account, open session
POST /auth/login           — authenticate, open session
GET  /auth/logout          — destroy session, redirect to /
GET  /auth/me              — return current user (email, isPro, streakCount)
```

**Projects**
```
GET    /projects           — list all projects for session user
POST   /projects           — create project (enforces free tier limit)
DELETE /projects/:id       — delete project and cascade tasks
```

**Tasks**
```
GET    /tasks              — list tasks (optional ?projectId= filter)
GET    /tasks/focus        — top 3 tasks by overdue → due today → priority
GET    /tasks/stats        — completedToday, streakCount, totalActive
POST   /tasks              — create task (enforces free tier limit)
PUT    /tasks/:id          — update task; triggers streak update on completion
DELETE /tasks/:id          — delete task
```

**Payments**
```
POST /create-checkout-session  — create Stripe checkout, return redirect URL
POST /webhook                  — Stripe event listener; activates Pro on payment
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local or remote)
- Stripe account with a product + price created

### Local Setup

```bash
git clone https://github.com/Lionfish7777/taskflowpro.git
cd taskflowpro/backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

```env
DATABASE_URL=postgresql://localhost/taskflowpro
SESSION_SECRET=your_session_secret_here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=4242
```

Start the server:

```bash
npm start
# → http://localhost:4242
```

The database schema initializes automatically on first run.

### Stripe Webhook (Local Testing)

```bash
stripe listen --forward-to localhost:4242/webhook
```

Complete a test checkout and confirm the user's `is_pro` flag is set in the database.

---

## Freemium Model

| Feature | Free | Pro ($9.99/mo) |
|---|---|---|
| Projects | 3 | Unlimited |
| Tasks | 50 | Unlimited |
| Daily Focus | ✓ | ✓ |
| Streak Tracking | ✓ | ✓ |
| Advanced Features | — | ✓ |

Limits are enforced server-side. The API returns `{ upgrade: true }` when a limit is reached, which the client uses to surface the upgrade prompt.

---

## Status

Active development. Private. Deployed to Railway.

---
