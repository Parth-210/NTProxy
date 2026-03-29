const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/setup');

// POST /api/login
router.post('/login', (req, res) => {
  const { id, password, role } = req.body;
  if (!id || !password || !role) return res.status(400).json({ error: 'ID, password, and role are required' });

  const db = getDb();
  let user;
  if (role === 'professor') {
    user = db.get('SELECT * FROM professors WHERE id = ?', [id]);
  } else if (role === 'student') {
    user = db.get('SELECT * FROM students WHERE id = ?', [id]);
  } else {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.user = {
    id: user.id,
    name: user.name,
    role,
    ...(role === 'student' ? { branch: user.branch, semester: user.semester } : {})
  };

  res.json({ success: true, user: req.session.user });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('ntproxy_sid');
    res.json({ success: true });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

module.exports = router;
