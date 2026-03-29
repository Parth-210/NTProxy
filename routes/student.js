const express = require('express');
const router = express.Router();
const { getDb } = require('../db/setup');
const { requireRole } = require('../middleware/auth');

const studentAuth = requireRole('student');

router.get('/subjects', studentAuth, (req, res) => {
  const db = getDb();
  const subjects = db.all(`
    SELECT sub.id, sub.name,
      (SELECT p.name FROM professors p WHERE p.id = sub.professor_id) as professor_name,
      (SELECT COUNT(*) FROM sessions ss WHERE ss.subject_id = sub.id) as total_sessions,
      (SELECT COUNT(*) FROM attendance a
       JOIN sessions ss ON a.session_id = ss.session_id
       WHERE a.student_id = ? AND ss.subject_id = sub.id) as attended
    FROM enrollments e JOIN subjects sub ON e.subject_id = sub.id
    WHERE e.student_id = ? ORDER BY sub.name
  `, [req.session.user.id, req.session.user.id]);

  subjects.forEach(s => {
    s.percentage = s.total_sessions > 0 ? Math.round((s.attended / s.total_sessions) * 100) : 100;
  });
  res.json({ subjects });
});

router.get('/attendance/:subjectId', studentAuth, (req, res) => {
  const db = getDb();
  const enrollment = db.get('SELECT 1 FROM enrollments WHERE student_id = ? AND subject_id = ?',
    [req.session.user.id, req.params.subjectId]);
  if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this subject' });

  const subject = db.get(`
    SELECT sub.*, p.name as professor_name FROM subjects sub
    JOIN professors p ON sub.professor_id = p.id WHERE sub.id = ?
  `, [req.params.subjectId]);

  const records = db.all(`
    SELECT ss.session_id, ss.start_time, ss.status,
      CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as present,
      a.timestamp as marked_at
    FROM sessions ss
    LEFT JOIN attendance a ON a.session_id = ss.session_id AND a.student_id = ?
    WHERE ss.subject_id = ? ORDER BY ss.start_time DESC
  `, [req.session.user.id, req.params.subjectId]);

  const attended = records.filter(r => r.present == 1).length;
  const total = records.length;
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;

  res.json({ subject, records, attended, total, percentage });
});

module.exports = router;
