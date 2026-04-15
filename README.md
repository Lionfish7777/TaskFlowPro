# TaskFlow Pro
### Your permanent productivity butler

## What This Is

TaskFlow Pro is a freemium SaaS task management app that keeps users
in a permanent flow state. It learns from each person, builds a real
relationship through their tasks, and acts as a precise, professional
butler for their daily lives.

Free tier available. Pro plan at $9.99/month.

## How To Run It

```bash
cd backend
cp .env.example .env
# Fill in your Stripe keys and session secret in .env
npm install
npm start
# Visit http://localhost:4242
```

## Stack

- Node.js + Express.js
- PostgreSQL (pg)
- express-session + bcryptjs
- Stripe (payments)
- Vanilla HTML/CSS/JS
- Railway (deployment)

## Project Structure

```
taskflowpro/
├── backend/
│   ├── server.js       — Express server, all API routes
│   ├── database.js     — PostgreSQL schema + helpers
│   ├── package.json    — dependencies
│   └── .env.example    — environment variable template
└── public/
    ├── index.html      — marketing landing page
    ├── login.html      — user login
    ├── signup.html     — user signup
    ├── app.html        — main task dashboard
    ├── success.html    — post-payment success
    └── cancel.html     — payment cancellation/retention
```

## Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Projects | 3 max | Unlimited |
| Tasks | 50 max | Unlimited |
| Flow State Mode | — | ✓ |
| Streak Analytics | — | ✓ |
| Priority Support | — | ✓ |

## Status: Active — In Development

---
Created: 2026-03-18
Last Updated: 2026-04-15
Last Used: 2026-03-18
Created By: Lionfish7777 | Universe-7777
