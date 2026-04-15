import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

// ─── INIT ───────────────────────────────────────────────────────────────────

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_pro INTEGER DEFAULT 0,
      pro_activated_at TIMESTAMPTZ,
      stripe_customer_id VARCHAR(255),
      streak_count INTEGER DEFAULT 0,
      last_streak_date DATE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50) DEFAULT '#6366f1',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      notes TEXT DEFAULT '',
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'active',
      due_date DATE,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── USER HELPERS ──────────────────────────────────────────────────────────

export async function createUser(email, passwordHash) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email, passwordHash]
  );
  return { lastInsertRowid: result.rows[0].id };
}

export async function getUserByEmail(email) {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0] || null;
}

export async function getUserById(id) {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function setUserPro(userId, stripeCustomerId = null) {
  await pool.query(
    `UPDATE users SET is_pro = 1, pro_activated_at = NOW(),
     stripe_customer_id = COALESCE($2, stripe_customer_id) WHERE id = $1`,
    [userId, stripeCustomerId]
  );
}

export async function setUserProByEmail(email, stripeCustomerId = null) {
  await pool.query(
    `UPDATE users SET is_pro = 1, pro_activated_at = NOW(),
     stripe_customer_id = COALESCE($2, stripe_customer_id) WHERE email = $1`,
    [email, stripeCustomerId]
  );
}

export async function updateLastLogin(userId) {
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

export async function updateStreak(userId) {
  const userResult = await pool.query(
    `SELECT streak_count, last_streak_date FROM users WHERE id = $1`, [userId]
  );
  const user = userResult.rows[0];
  if (!user) return 0;

  const todayStr = today();
  const lastDate = user.last_streak_date
    ? new Date(user.last_streak_date).toISOString().split('T')[0]
    : null;

  if (lastDate === todayStr) return user.streak_count;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newStreak = lastDate === yesterday ? user.streak_count + 1 : 1;

  await pool.query(
    `UPDATE users SET streak_count = $1, last_streak_date = $2 WHERE id = $3`,
    [newStreak, todayStr, userId]
  );
  return newStreak;
}

// ─── PROJECT HELPERS ───────────────────────────────────────────────────────

export async function getProjects(userId) {
  const result = await pool.query(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at ASC`, [userId]
  );
  return result.rows;
}

export async function getProjectCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM projects WHERE user_id = $1`, [userId]
  );
  return parseInt(result.rows[0].count);
}

export async function createProject(userId, name, color) {
  const result = await pool.query(
    `INSERT INTO projects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id`,
    [userId, name, color]
  );
  return { lastInsertRowid: result.rows[0].id };
}

export async function deleteProject(projectId, userId) {
  await pool.query(
    `DELETE FROM projects WHERE id = $1 AND user_id = $2`, [projectId, userId]
  );
}

// ─── TASK HELPERS ──────────────────────────────────────────────────────────

export async function getTasks(userId, projectId = null) {
  const base = `
    SELECT t.*, p.name AS project_name, p.color AS project_color
    FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = $1`;

  const result = projectId !== null
    ? await pool.query(base + ` AND t.project_id = $2 ORDER BY t.created_at DESC`, [userId, projectId])
    : await pool.query(base + ` ORDER BY t.created_at DESC`, [userId]);

  return result.rows;
}

export async function getTaskCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM tasks WHERE user_id = $1 AND status = 'active'`, [userId]
  );
  return parseInt(result.rows[0].count);
}

export async function getDailyFocus(userId) {
  const todayStr = today();
  const result = await pool.query(`
    SELECT t.*, p.name AS project_name, p.color AS project_color
    FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = $1 AND t.status = 'active'
    ORDER BY
      CASE WHEN t.due_date < $2 THEN 0 ELSE 1 END,
      CASE WHEN t.due_date = $2 THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 1 END
    LIMIT 3
  `, [userId, todayStr]);
  return result.rows;
}

export async function getCompletedTodayCount(userId) {
  const todayStr = today();
  const result = await pool.query(`
    SELECT COUNT(*) AS count FROM tasks
    WHERE user_id = $1 AND status = 'completed' AND DATE(completed_at AT TIME ZONE 'UTC') = $2
  `, [userId, todayStr]);
  return parseInt(result.rows[0].count);
}

export async function createTask(userId, projectId, title, notes, priority, dueDate) {
  const result = await pool.query(
    `INSERT INTO tasks (user_id, project_id, title, notes, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, projectId ? parseInt(projectId) : null, title, notes || '', priority || 'medium', dueDate || null]
  );
  return { lastInsertRowid: result.rows[0].id };
}

export async function updateTask(taskId, userId, fields) {
  const allowed = ['title', 'notes', 'priority', 'status', 'due_date', 'project_id'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.status === 'completed') {
    updates.push(`completed_at = $${idx++}`);
    values.push(new Date().toISOString());
  }
  if (!updates.length) return null;

  values.push(taskId, userId);
  const result = await pool.query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteTask(taskId, userId) {
  await pool.query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`, [taskId, userId]
  );
}

export default pool;
