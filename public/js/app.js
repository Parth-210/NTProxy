/* ─── api.js — Shared API utilities for NTProxy ──────────── */

// ─── Core fetch wrapper ──────────────────────────────────
async function api(url, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'same-origin'
  };
  const merged = { ...defaults, ...options, headers: { ...defaults.headers, ...options.headers } };
  if (merged.body && typeof merged.body === 'object') {
    merged.body = JSON.stringify(merged.body);
  }
  const res = await fetch(url, merged);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Auth helpers ────────────────────────────────────────
async function getCurrentUser() {
  try { return (await api('/api/me')).user; }
  catch { return null; }
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  window.location.href = '/login';
}

// ─── Guard helpers ───────────────────────────────────────
async function requireStudent(redirectTo) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') {
    window.location.href = redirectTo || '/login';
    return null;
  }
  return user;
}

async function requireProfessor(redirectTo) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'professor') {
    window.location.href = redirectTo || '/login';
    return null;
  }
  return user;
}

// ─── Toast notifications ─────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ─── Navbar user display ─────────────────────────────────
function initNavbar(user) {
  const nameEl = document.getElementById('navbar-name');
  const avatarEl = document.getElementById('navbar-avatar');
  const logoutBtn = document.getElementById('logout-btn');

  if (nameEl && user) nameEl.textContent = user.name;
  if (avatarEl && user) avatarEl.textContent = user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

// ─── Progress ring builder ───────────────────────────────
function buildProgressRing(pct, size = 64) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const cls = pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad';
  return `
    <div class="progress-ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle class="track" cx="${size/2}" cy="${size/2}" r="${r}"/>
        <circle class="fill ${cls}" cx="${size/2}" cy="${size/2}" r="${r}"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      </svg>
      <span class="progress-ring-label" style="font-size:${size < 80 ? '0.85' : '1'}rem">${pct}%</span>
    </div>`;
}

// ─── Date helpers ─────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(isoString) {
  if (!isoString) return '—';
  return `${formatDate(isoString)}, ${formatTime(isoString)}`;
}

// ─── NTProxy SVG Logo ─────────────────────────────────────
const LOGO_SVG = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo-icon">
  <rect width="40" height="40" rx="10" fill="url(#lg1)"/>
  <rect x="6" y="6" width="11" height="11" rx="2" fill="white" opacity="0.9"/>
  <rect x="8" y="8" width="7" height="7" rx="1" fill="url(#lg1)"/>
  <rect x="10" y="10" width="3" height="3" fill="white"/>
  <rect x="23" y="6" width="11" height="11" rx="2" fill="white" opacity="0.9"/>
  <rect x="25" y="8" width="7" height="7" rx="1" fill="url(#lg1)"/>
  <rect x="27" y="10" width="3" height="3" fill="white"/>
  <rect x="6" y="23" width="11" height="11" rx="2" fill="white" opacity="0.9"/>
  <rect x="8" y="25" width="7" height="7" rx="1" fill="url(#lg1)"/>
  <rect x="10" y="27" width="3" height="3" fill="white"/>
  <rect x="23" y="23" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
  <rect x="30" y="23" width="4" height="4" rx="1" fill="white" opacity="0.7"/>
  <rect x="23" y="30" width="4" height="4" rx="1" fill="white" opacity="0.7"/>
  <rect x="29" y="29" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
  <defs>
    <linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366f1"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
</svg>`;

// Make logo available
window.LOGO_SVG = LOGO_SVG;
window.buildProgressRing = buildProgressRing;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.showToast = showToast;
window.initNavbar = initNavbar;
window.api = api;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.requireStudent = requireStudent;
window.requireProfessor = requireProfessor;
