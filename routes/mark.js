const express = require('express');
const router = express.Router();
const { getDb } = require('../db/setup');
const { validateToken } = require('../utils/token');

router.get('/', (req, res) => {
  const { session_id, token } = req.query;

  if (!session_id || !token) {
    return res.redirect('/mark-result.html?status=error&message=' + encodeURIComponent('Invalid QR code. Missing session or token.'));
  }

  // Not logged in → redirect to login, preserve return URL
  if (!req.session?.user) {
    const redirectUrl = `/mark?session_id=${session_id}&token=${token}`;
    return res.redirect('/login.html?redirect=' + encodeURIComponent(redirectUrl));
  }

  if (req.session.user.role !== 'student') {
    return res.redirect('/mark-result.html?status=error&message=' + encodeURIComponent('Only students can mark attendance.'));
  }

  const db = getDb();
  const session = db.get("SELECT * FROM sessions WHERE session_id = ? AND status = 'active'", [session_id]);
  if (!session) {
    return res.redirect('/mark-result.html?status=error&message=' + encodeURIComponent('Session not found or has ended.'));
  }

  const secret = process.env.SESSION_SECRET || 'ntproxy_secret_fallback';
  if (!validateToken(session_id, token, secret)) {
    return res.redirect('/mark-result.html?status=error&message=' + encodeURIComponent('QR code has expired. Please scan the latest QR code.'));
  }

  const enrollment = db.get('SELECT 1 FROM enrollments WHERE student_id = ? AND subject_id = ?',
    [req.session.user.id, session.subject_id]);
  if (!enrollment) {
    return res.redirect('/mark-result.html?status=error&message=' + encodeURIComponent('You are not enrolled in this subject.'));
  }

  const existing = db.get('SELECT 1 FROM attendance WHERE student_id = ? AND session_id = ?',
    [req.session.user.id, session_id]);
  if (existing) {
    return res.redirect('/mark-result.html?status=success&message=' + encodeURIComponent('Your attendance is already marked for this session!'));
  }

  db.run('INSERT INTO attendance (student_id, session_id, timestamp) VALUES (?, ?, ?)',
    [req.session.user.id, session_id, new Date().toISOString()]);

  const subject = db.get('SELECT name FROM subjects WHERE id = ?', [session.subject_id]);
  const subjectName = subject?.name || 'this subject';

  return res.redirect('/mark-result.html?status=success&message=' + encodeURIComponent(`Attendance marked successfully for ${subjectName}!`));
});

module.exports = router;
