const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { getDb } = require('../db/setup');
const { requireRole } = require('../middleware/auth');
const { generateToken } = require('../utils/token');

const profAuth = requireRole('professor');

// ─── SUBJECTS ───────────────────────────────────────────

router.get('/subjects', profAuth, (req, res) => {
  const db = getDb();
  const subjects = db.all(`
    SELECT s.id, s.name, s.professor_id,
      (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id) as student_count,
      (SELECT COUNT(*) FROM sessions ss WHERE ss.subject_id = s.id) as session_count
    FROM subjects s WHERE s.professor_id = ?
  `, [req.session.user.id]);
  res.json({ subjects });
});

router.post('/subjects', profAuth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Subject name is required' });
  const db = getDb();
  const result = db.run('INSERT INTO subjects (name, professor_id) VALUES (?, ?)', [name.trim(), req.session.user.id]);
  res.json({ success: true, subjectId: result.lastInsertRowid });
});

router.delete('/subjects/:id', profAuth, (req, res) => {
  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [req.params.id, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  db.run('DELETE FROM enrollments WHERE subject_id = ?', [req.params.id]);
  db.run('DELETE FROM subjects WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── ENROLLMENT ──────────────────────────────────────────

router.get('/subjects/:id/students', profAuth, (req, res) => {
  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [req.params.id, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const students = db.all(`
    SELECT s.id, s.name, s.branch, s.semester
    FROM students s JOIN enrollments e ON s.id = e.student_id
    WHERE e.subject_id = ? ORDER BY s.name
  `, [req.params.id]);
  res.json({ students, subject });
});

router.post('/subjects/:id/enroll', profAuth, (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0)
    return res.status(400).json({ error: 'Student IDs array is required' });

  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [req.params.id, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  let enrolled = 0, notFound = [];
  for (const sid of studentIds) {
    const student = db.get('SELECT id FROM students WHERE id = ?', [sid.trim()]);
    if (!student) { notFound.push(sid.trim()); continue; }
    // Check if already enrolled
    const exists = db.get('SELECT 1 FROM enrollments WHERE student_id = ? AND subject_id = ?', [sid.trim(), req.params.id]);
    if (!exists) {
      db.run('INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)', [sid.trim(), req.params.id]);
      enrolled++;
    }
  }
  res.json({ success: true, enrolled, notFound });
});

router.delete('/subjects/:id/students/:studentId', profAuth, (req, res) => {
  getDb().run('DELETE FROM enrollments WHERE student_id = ? AND subject_id = ?', [req.params.studentId, req.params.id]);
  res.json({ success: true });
});

router.get('/students/search', profAuth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ students: [] });
  const db = getDb();
  const students = db.all(
    `SELECT id, name, branch, semester FROM students WHERE id LIKE ? OR name LIKE ? LIMIT 20`,
    [`%${q}%`, `%${q}%`]
  );
  res.json({ students });
});

// ─── SESSIONS ───────────────────────────────────────────

router.post('/session/start', profAuth, (req, res) => {
  const { subjectId } = req.body;
  if (!subjectId) return res.status(400).json({ error: 'Subject ID is required' });

  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [subjectId, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const active = db.get("SELECT * FROM sessions WHERE subject_id = ? AND status = 'active'", [subjectId]);
  if (active) return res.status(400).json({ error: 'An active session already exists', sessionId: active.session_id });

  const sessionId = uuidv4();
  db.run('INSERT INTO sessions (session_id, subject_id, start_time, status) VALUES (?, ?, ?, ?)',
    [sessionId, subjectId, new Date().toISOString(), 'active']);
  res.json({ success: true, sessionId });
});

router.post('/session/end', profAuth, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

  const db = getDb();
  const session = db.get(`
    SELECT s.*, sub.professor_id FROM sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE s.session_id = ? AND s.status = 'active'
  `, [sessionId]);

  if (!session) return res.status(404).json({ error: 'Active session not found' });
  if (session.professor_id !== req.session.user.id) return res.status(403).json({ error: 'Access denied' });

  db.run("UPDATE sessions SET status = 'ended', end_time = ? WHERE session_id = ?",
    [new Date().toISOString(), sessionId]);
  res.json({ success: true });
});

router.get('/session/:id/qr', profAuth, async (req, res) => {
  const db = getDb();
  const session = db.get(`
    SELECT s.*, sub.professor_id, sub.name as subject_name FROM sessions s
    JOIN subjects sub ON s.subject_id = sub.id WHERE s.session_id = ?
  `, [req.params.id]);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.professor_id !== req.session.user.id) return res.status(403).json({ error: 'Access denied' });
  if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' });

  const token = generateToken(session.session_id, process.env.SESSION_SECRET || 'ntproxy_secret_fallback');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/mark?session_id=${session.session_id}&token=${token}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ qr: qrDataUrl, url, token, subjectName: session.subject_name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ─── ATTENDANCE ─────────────────────────────────────────

router.get('/session/:id/attendance', profAuth, (req, res) => {
  const db = getDb();
  const session = db.get(`
    SELECT s.*, sub.professor_id, sub.name as subject_name FROM sessions s
    JOIN subjects sub ON s.subject_id = sub.id WHERE s.session_id = ?
  `, [req.params.id]);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.professor_id !== req.session.user.id) return res.status(403).json({ error: 'Access denied' });

  const students = db.all(`
    SELECT st.id, st.name, st.branch, st.semester,
      CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as present,
      a.timestamp
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    LEFT JOIN attendance a ON a.student_id = st.id AND a.session_id = ?
    WHERE e.subject_id = ? ORDER BY st.name
  `, [req.params.id, session.subject_id]);

  const presentCount = students.filter(s => s.present == 1).length;
  res.json({ students, presentCount, totalCount: students.length, session });
});

router.post('/session/:id/attendance/toggle', profAuth, (req, res) => {
  const { studentId, present } = req.body;
  if (!studentId) return res.status(400).json({ error: 'Student ID is required' });

  const db = getDb();
  const session = db.get(`
    SELECT s.*, sub.professor_id FROM sessions s
    JOIN subjects sub ON s.subject_id = sub.id WHERE s.session_id = ?
  `, [req.params.id]);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.professor_id !== req.session.user.id) return res.status(403).json({ error: 'Access denied' });

  if (present) {
    const exists = db.get('SELECT 1 FROM attendance WHERE student_id = ? AND session_id = ?', [studentId, req.params.id]);
    if (!exists) {
      db.run('INSERT INTO attendance (student_id, session_id, timestamp) VALUES (?, ?, ?)',
        [studentId, req.params.id, new Date().toISOString()]);
    }
  } else {
    db.run('DELETE FROM attendance WHERE student_id = ? AND session_id = ?', [studentId, req.params.id]);
  }
  res.json({ success: true });
});

router.get('/session/:id/attendance/csv', profAuth, (req, res) => {
  const db = getDb();
  const session = db.get(`
    SELECT s.*, sub.professor_id, sub.name as subject_name FROM sessions s
    JOIN subjects sub ON s.subject_id = sub.id WHERE s.session_id = ?
  `, [req.params.id]);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.professor_id !== req.session.user.id) return res.status(403).json({ error: 'Access denied' });

  const students = db.all(`
    SELECT st.id, st.name, st.branch, st.semester,
      CASE WHEN a.id IS NOT NULL THEN 'Present' ELSE 'Absent' END as status,
      COALESCE(a.timestamp, '') as timestamp
    FROM enrollments e
    JOIN students st ON e.student_id = st.id
    LEFT JOIN attendance a ON a.student_id = st.id AND a.session_id = ?
    WHERE e.subject_id = ? ORDER BY st.name
  `, [req.params.id, session.subject_id]);

  let csv = 'Student ID,Name,Branch,Semester,Status,Timestamp\n';
  students.forEach(s => { csv += `${s.id},"${s.name}",${s.branch || ''},${s.semester || ''},${s.status},${s.timestamp}\n`; });

  const filename = `${(session.subject_name || 'Attendance').replace(/\s+/g, '_')}_${session.start_time.substring(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// ─── REPORTS ────────────────────────────────────────────

router.get('/reports/:subjectId', profAuth, (req, res) => {
  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [req.params.subjectId, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const sessions = db.all("SELECT session_id, start_time, end_time, status FROM sessions WHERE subject_id = ? ORDER BY start_time DESC", [req.params.subjectId]);
  const totalSessions = sessions.length;

  const students = db.all(`
    SELECT st.id, st.name, st.branch, st.semester,
      (SELECT COUNT(*) FROM attendance a JOIN sessions ss ON a.session_id = ss.session_id
       WHERE a.student_id = st.id AND ss.subject_id = ?) as attended
    FROM enrollments e JOIN students st ON e.student_id = st.id
    WHERE e.subject_id = ? ORDER BY st.name
  `, [req.params.subjectId, req.params.subjectId]);

  students.forEach(s => {
    s.percentage = totalSessions > 0 ? Math.round((s.attended / totalSessions) * 100) : 0;
  });

  res.json({ subject, sessions, students, totalSessions });
});

router.get('/reports/:subjectId/csv', profAuth, (req, res) => {
  const db = getDb();
  const subject = db.get('SELECT * FROM subjects WHERE id = ? AND professor_id = ?', [req.params.subjectId, req.session.user.id]);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const sessions = db.all('SELECT session_id, start_time FROM sessions WHERE subject_id = ? ORDER BY start_time', [req.params.subjectId]);
  const students = db.all(`SELECT st.id, st.name FROM enrollments e JOIN students st ON e.student_id = st.id WHERE e.subject_id = ? ORDER BY st.name`, [req.params.subjectId]);

  let csv = 'Student ID,Name';
  sessions.forEach(s => { csv += `,${s.start_time.substring(0, 10)}`; });
  csv += ',Total,Percentage\n';

  students.forEach(st => {
    csv += `${st.id},"${st.name}"`;
    let total = 0;
    sessions.forEach(s => {
      const att = db.get('SELECT id FROM attendance WHERE student_id = ? AND session_id = ?', [st.id, s.session_id]);
      csv += `,${att ? 'P' : 'A'}`;
      if (att) total++;
    });
    const pct = sessions.length > 0 ? Math.round((total / sessions.length) * 100) : 0;
    csv += `,${total},${pct}%\n`;
  });

  const filename = `${(subject.name || 'Report').replace(/\s+/g, '_')}_Report.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

router.get('/sessions', profAuth, (req, res) => {
  const db = getDb();
  const sessions = db.all(`
    SELECT s.session_id, s.subject_id, s.start_time, s.status, sub.name as subject_name
    FROM sessions s JOIN subjects sub ON s.subject_id = sub.id
    WHERE sub.professor_id = ? ORDER BY s.start_time DESC LIMIT 50
  `, [req.session.user.id]);
  res.json({ sessions });
});

module.exports = router;
