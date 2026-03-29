require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb, getDb } = require('./db/setup');

const app = express();
const PORT = process.env.PORT || 3000;

/* ─── Custom SQLite Session Store ───────────────────────── */
class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try {
      const db = getDb();
      const row = db.get('SELECT sess FROM user_sessions WHERE sid = ? AND expired > ?', [sid, Date.now()]);
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) { callback(err); }
  }
  set(sid, sessData, callback) {
    try {
      const db = getDb();
      const maxAge = sessData.cookie?.maxAge ?? 86400000;
      const expired = Date.now() + maxAge;
      // DELETE then INSERT to avoid REPLACE issues with sql.js
      db.run('DELETE FROM user_sessions WHERE sid = ?', [sid]);
      db.run('INSERT INTO user_sessions (sid, sess, expired) VALUES (?, ?, ?)', [sid, JSON.stringify(sessData), expired]);
      callback(null);
    } catch (err) { callback(err); }
  }
  destroy(sid, callback) {
    try {
      getDb().run('DELETE FROM user_sessions WHERE sid = ?', [sid]);
      callback(null);
    } catch (err) { callback(err); }
  }
}

/* ─── Middleware ────────────────────────────────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(session({
  store: new SQLiteSessionStore(),
  name: 'ntproxy_sid',
  secret: process.env.SESSION_SECRET || 'ntproxy_secret_fallback',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

/* ─── Static Files ──────────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

/* ─── API Routes ─────────────────────────────────────────── */
app.use('/api', require('./routes/auth'));
app.use('/api/prof', require('./routes/professor'));
app.use('/api/student', require('./routes/student'));
app.use('/mark', require('./routes/mark'));

/* ─── Page Routes ────────────────────────────────────────── */
const sendPage = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));

app.get('/login',              sendPage('login.html'));
app.get('/mark-result',        sendPage('mark-result.html'));
app.get('/student/dashboard',  (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'student') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'student', 'dashboard.html'));
});
app.get('/student/attendance', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'student') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'student', 'attendance.html'));
});
app.get('/scan', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'student') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'student', 'scanner.html'));
});
app.get('/prof/dashboard', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'professor') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'prof', 'dashboard.html'));
});
app.get('/prof/session', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'professor') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'prof', 'session.html'));
});
app.get('/prof/attendance', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'professor') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'prof', 'attendance.html'));
});
app.get('/prof/reports', (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'professor') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'prof', 'reports.html'));
});
app.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect(req.session.user.role === 'professor' ? '/prof/dashboard' : '/student/dashboard');
  }
  res.redirect('/login');
});

/* ─── Boot ───────────────────────────────────────────────── */
async function start() {
  await initDb();
  console.log('✅ Database initialized');

  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   🎓 NTProxy — IIIT Surat            ║`);
    console.log(`  ║   QR Attendance Management System    ║`);
    console.log(`  ╠══════════════════════════════════════╣`);
    console.log(`  ║   http://localhost:${PORT}              ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
