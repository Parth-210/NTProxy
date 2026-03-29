const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'ntproxy.db');
let _db = null;

/* ─── Persistence ────────────────────────────────────────── */
function saveDb() {
  if (_db) {
    try {
      const data = _db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) { /* ignore */ }
  }
}

/* ─── Query helpers ─────────────────────────────────────── */
// Run a statement (INSERT/UPDATE/DELETE/CREATE)
function run(sql, params = []) {
  _db.run(sql, params);
  // Retrieve last insert rowid and changes count
  const r1 = _db.exec('SELECT last_insert_rowid()');
  const lastId = r1.length > 0 && r1[0].values.length > 0 ? Number(r1[0].values[0][0]) : null;
  const r2 = _db.exec('SELECT changes()');
  const ch = r2.length > 0 && r2[0].values.length > 0 ? Number(r2[0].values[0][0]) : 0;
  saveDb();
  return { lastInsertRowid: lastId, changes: ch };
}

// Get a single row
function get(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

// Get all rows
function all(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Execute raw SQL (no params)
function exec(sql) {
  _db.exec(sql);
  saveDb();
}

/* ─── DB object (mirrors better-sqlite3 API) ─────────────── */
function getDb() {
  if (!_db) throw new Error('DB not initialized');
  return { run, get, all, exec, prepare: (sql) => ({ run: (p) => run(sql, p) }) };
}

/* ─── Init ───────────────────────────────────────────────── */
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  // Apply pragmas
  _db.run('PRAGMA journal_mode = WAL');
  _db.run('PRAGMA foreign_keys = ON');

  createTables();
  
  // Check if seeding is needed (no professors)
  const profCount = get('SELECT COUNT(*) as count FROM professors').count;
  if (profCount === 0) {
    console.log('🌱 Seed: No data found, seeding demo data...');
    seedDemoData();
  }

  // Auto-save every 15 s
  setInterval(saveDb, 15000);

  return getDb();
}

function createTables() {
  _db.run(`CREATE TABLE IF NOT EXISTS professors (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, password_hash TEXT NOT NULL,
    branch TEXT, semester INTEGER
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, professor_id TEXT NOT NULL,
    FOREIGN KEY (professor_id) REFERENCES professors(id)
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    student_id TEXT NOT NULL, subject_id INTEGER NOT NULL,
    PRIMARY KEY (student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY, subject_id INTEGER NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT, status TEXT DEFAULT 'active',
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL, session_id TEXT NOT NULL, timestamp TEXT NOT NULL,
    UNIQUE(student_id, session_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
    sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expired INTEGER NOT NULL
  )`);
  saveDb();
}

function seedDemoData() {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);

  // Professors
  const profs = [
    ['PROF001', 'Dr. Amit Sharma', passwordHash],
    ['PROF002', 'Dr. Priya Patel', passwordHash],
    ['PROF003', 'Dr. Rajesh Kumar', passwordHash]
  ];
  profs.forEach(p => _db.run('INSERT INTO professors (id, name, password_hash) VALUES (?, ?, ?)', p));

  // Students
  const students = [
    ['STU001', 'Arjun Mehta', passwordHash, 'CSE', 5],
    ['STU002', 'Sneha Gupta', passwordHash, 'CSE', 5],
    ['STU003', 'Rohan Singh', passwordHash, 'IT', 3],
    ['STU004', 'Ananya Desai', passwordHash, 'CSE', 5],
    ['STU005', 'Vikram Joshi', passwordHash, 'ECE', 7],
    ['STU006', 'Kavya Nair', passwordHash, 'IT', 3],
    ['STU007', 'Aditya Verma', passwordHash, 'CSE', 5],
    ['STU008', 'Ishita Sharma', passwordHash, 'ECE', 7],
    ['STU009', 'Manav Patel', passwordHash, 'IT', 3],
    ['STU010', 'Divya Reddy', passwordHash, 'CSE', 5]
  ];
  students.forEach(s => _db.run('INSERT INTO students (id, name, password_hash, branch, semester) VALUES (?, ?, ?, ?, ?)', s));

  // Subjects
  const subs = [
    ['Data Structures', 'PROF001'],
    ['Database Systems', 'PROF001'],
    ['Computer Networks', 'PROF002'],
    ['Operating Systems', 'PROF002'],
    ['Digital Electronics', 'PROF003']
  ];
  const subjectIds = [];
  subs.forEach(s => {
    _db.run('INSERT INTO subjects (name, professor_id) VALUES (?, ?)', s);
    const res = _db.exec('SELECT last_insert_rowid()');
    subjectIds.push(res[0].values[0][0]);
  });

  // Enrollments (Match seed logic roughly)
  const ds_students = ['STU001', 'STU002', 'STU004', 'STU007', 'STU010'];
  const db_students = ['STU001', 'STU002', 'STU004', 'STU007', 'STU010'];
  const cn_students = ['STU001', 'STU002', 'STU003', 'STU006', 'STU009'];
  const os_students = ['STU003', 'STU006', 'STU009'];
  const de_students = ['STU005', 'STU008'];

  ds_students.forEach(sid => _db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subjectIds[0]]));
  db_students.forEach(sid => _db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subjectIds[1]]));
  cn_students.forEach(sid => _db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subjectIds[2]]));
  os_students.forEach(sid => _db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subjectIds[3]]));
  de_students.forEach(sid => _db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid, subjectIds[4]]));

  console.log('✅ Demo data seeded successfully.');
  saveDb();
}

module.exports = { initDb, getDb, saveDb, DB_PATH };
