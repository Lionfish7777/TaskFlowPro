# SKILL.md — TaskFlow Pro
### Universe-7777 | Lionfish7777

## Skill Name
SaaS Freemium Build — Full Stack Launch Protocol

## What This Skill Does

Guides the complete build and launch of a freemium SaaS product from
existing marketing shell to fully functional, deployed, payment-ready
application. Covers: PostgreSQL database setup, session-based auth,
Stripe webhook integration, app dashboard construction, free/pro
feature gating, and Railway deployment.

## Stack Pattern

- Node.js + Express.js (backend)
- PostgreSQL + pg (database — connection pooling, production-ready)
- express-session + bcryptjs (auth — no external service needed)
- Stripe Checkout + webhooks (payments)
- Vanilla HTML/CSS/JS (frontend — no build step, ships fast)
- Railway (deployment — connects to GitHub, live in 5 minutes)

## When To Reference It

- When building any freemium SaaS product from scratch or from a partial build
- When adding auth + database to an existing Express app
- When wiring Stripe payments to user accounts
- When deploying a Node.js app to Railway
- When building a task/productivity app with free/pro gating

## Reusable For

- Any Universe-7777 project that needs: auth + database + Stripe + deploy
- The butler intelligence pattern (daily focus, streak tracking, flow state)
  is reusable for any productivity-focused product
- The freemium gating pattern (client + server-side checks) is reusable
  for any SaaS with tiered pricing

## Butler Intelligence Pattern (V1)

Rule-based intelligence — no external AI API required:
1. Daily Focus: surface top 3 tasks (overdue → due today → high priority)
2. Streak tracking: increment daily if ≥1 task completed
3. Smart greeting: time-of-day aware ("Good morning / afternoon / evening")
4. Flow State Mode: single-task full-screen focus view
5. Completion celebration: animation + encouraging message on complete

## Key Files

- `backend/server.js` — all routes
- `backend/database.js` — PostgreSQL schema
- `public/app.html` — dashboard
- `public/login.html` — auth
- `public/signup.html` — auth

---
Created: 2026-03-18
Last Updated: 2026-04-15
Last Used: 2026-03-18
Created By: Lionfish7777 | Universe-7777
