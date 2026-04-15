# Agent Behavior — TaskFlow Pro
### Universe-7777 | Lionfish7777

## Permitted Actions

- Read and modify all files in this project
- Install npm packages listed in package.json
- Run `npm start` to test the server locally
- Run `npm install` to install dependencies
- Create new routes in server.js
- Modify the SQLite schema in database.js
- Update public HTML/CSS/JS files
- Run git commands (add, commit, status, log)
- Deploy to Railway via CLI or dashboard

## Restricted Actions

- Never delete user data from the database without explicit permission
- Never push to GitHub without a confirmed commit message from Lionfish7777
- Never switch from test Stripe keys to live keys without explicit confirmation
- Never expose STRIPE_SECRET_KEY or SESSION_SECRET in any frontend file
- Never commit the .env file — only .env.example
- Never modify success.html or cancel.html Stripe redirect logic without testing first

## Workflow Rules

1. Always read existing code before modifying it
2. Test every new route locally before marking it complete
3. Keep server.js organized — group routes by resource (auth, tasks, projects, stripe)
4. Always run `npm install` after adding packages to package.json
5. Confirm Stripe webhook is working before switching to live keys
6. Every deploy must pass local test checklist first

## Tool Permissions

- Bash: allowed for npm commands, git, server testing
- File read/write: full access within this project directory
- Network: only to Stripe API and Railway deployment

---
Created: 2026-03-18
Last Updated: 2026-03-18
Last Used: 2026-03-18
Created By: Lionfish7777 | Universe-7777
