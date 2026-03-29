/**
 * Authentication middleware — checks for valid session
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  next();
}

/**
 * Role-specific middleware
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      return res.redirect('/login');
    }
    if (req.session.user.role !== role) {
      return res.status(403).json({ error: `Access denied. ${role} role required.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
