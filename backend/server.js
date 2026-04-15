import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import {
  initDB,
  createUser, getUserByEmail, getUserById,
  setUserPro, setUserProByEmail, updateStreak, updateLastLogin,
  getProjects, getProjectCount, createProject, deleteProject,
  getTasks, getTaskCount, getDailyFocus, getCompletedTodayCount,
  createTask, updateTask, deleteTask
} from './database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET, SESSION_SECRET } = process.env;
if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
  console.error('Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID in .env');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 4242;

// Stripe webhook needs raw body — must be before express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object;
    const email = checkoutSession.customer_details?.email;
    const customerId = checkoutSession.customer;
    if (email) {
      await setUserProByEmail(email, customerId);
      console.log(`Pro activated for ${email}`);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

app.use(session({
  secret: SESSION_SECRET || 'taskflowpro-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

const FREE_PROJECT_LIMIT = 3;
const FREE_TASK_LIMIT = 50;

// ─── AUTH ──────────────────────────────────────────────────────────────────

app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await getUserByEmail(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = await bcrypt.hash(password, 10);
  const result = await createUser(email.toLowerCase(), hash);
  req.session.userId = result.lastInsertRowid;
  req.session.email = email.toLowerCase();

  res.json({ success: true, email: email.toLowerCase(), isPro: false });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await getUserByEmail(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  req.session.userId = user.id;
  req.session.email = user.email;
  await updateLastLogin(user.id);

  res.json({ success: true, email: user.email, isPro: !!user.is_pro });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    email: user.email,
    isPro: !!user.is_pro,
    streakCount: user.streak_count,
    proActivatedAt: user.pro_activated_at
  });
});

app.post('/auth/set-pro', requireAuth, async (req, res) => {
  await setUserPro(req.session.userId);
  res.json({ success: true });
});

// ─── PROJECTS ──────────────────────────────────────────────────────────────

app.get('/projects', requireAuth, async (req, res) => {
  res.json(await getProjects(req.session.userId));
});

app.post('/projects', requireAuth, async (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });

  const user = await getUserById(req.session.userId);
  if (!user.is_pro && await getProjectCount(req.session.userId) >= FREE_PROJECT_LIMIT) {
    return res.status(403).json({ error: 'Free plan limit reached', limit: FREE_PROJECT_LIMIT, upgrade: true });
  }

  const result = await createProject(req.session.userId, name.trim(), color || '#6366f1');
  res.json({ id: result.lastInsertRowid, name: name.trim(), color: color || '#6366f1', user_id: req.session.userId });
});

app.delete('/projects/:id', requireAuth, async (req, res) => {
  await deleteProject(parseInt(req.params.id), req.session.userId);
  res.json({ success: true });
});

// ─── TASKS ─────────────────────────────────────────────────────────────────

app.get('/tasks', requireAuth, async (req, res) => {
  const { projectId } = req.query;
  res.json(await getTasks(req.session.userId, projectId ? parseInt(projectId) : null));
});

app.get('/tasks/focus', requireAuth, async (req, res) => {
  res.json(await getDailyFocus(req.session.userId));
});

app.get('/tasks/stats', requireAuth, async (req, res) => {
  const user = await getUserById(req.session.userId);
  res.json({
    completedToday: await getCompletedTodayCount(req.session.userId),
    streakCount: user.streak_count,
    totalActive: await getTaskCount(req.session.userId)
  });
});

app.post('/tasks', requireAuth, async (req, res) => {
  const { title, notes, priority, dueDate, projectId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Task title required' });

  const user = await getUserById(req.session.userId);
  if (!user.is_pro && await getTaskCount(req.session.userId) >= FREE_TASK_LIMIT) {
    return res.status(403).json({ error: 'Free plan limit reached', limit: FREE_TASK_LIMIT, upgrade: true });
  }

  const result = await createTask(req.session.userId, projectId, title.trim(), notes, priority, dueDate);
  res.json({ id: result.lastInsertRowid, title: title.trim(), priority: priority || 'medium', status: 'active' });
});

app.put('/tasks/:id', requireAuth, async (req, res) => {
  await updateTask(parseInt(req.params.id), req.session.userId, req.body);
  if (req.body.status === 'completed') {
    const newStreak = await updateStreak(req.session.userId);
    return res.json({ success: true, streakCount: newStreak });
  }
  res.json({ success: true });
});

app.delete('/tasks/:id', requireAuth, async (req, res) => {
  await deleteTask(parseInt(req.params.id), req.session.userId);
  res.json({ success: true });
});

// ─── PAGES ─────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(join(__dirname, '../public/index.html')));

app.get('/app', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.sendFile(join(__dirname, '../public/app.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/app');
  res.sendFile(join(__dirname, '../public/login.html'));
});

app.get('/signup', (req, res) => {
  if (req.session.userId) return res.redirect('/app');
  res.sendFile(join(__dirname, '../public/signup.html'));
});

// ─── STRIPE CHECKOUT ───────────────────────────────────────────────────────

app.post('/create-checkout-session', requireAuth, async (req, res) => {
  const user = await getUserById(req.session.userId);
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${req.headers.origin || 'http://localhost:' + PORT}/success.html`,
      cancel_url: `${req.headers.origin || 'http://localhost:' + PORT}/cancel.html`,
    });
    res.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── START ─────────────────────────────────────────────────────────────────

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ TaskFlow Pro running at http://localhost:${PORT}\n`);
    });
  })
  .catch(err => {
    console.error('Database init failed:', err.message);
    process.exit(1);
  });
