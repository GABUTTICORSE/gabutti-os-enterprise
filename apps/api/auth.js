const crypto = require('crypto');

const sessions = new Map();
const SESSION_HOURS = 12;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password;
  delete safe.passwordHash;
  return safe;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  sessions.set(token, { userId: user.id, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
  return { token, expiresAt: expiresAt.toISOString() };
}

function getBearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function getSession(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function revokeSession(req) {
  const token = getBearerToken(req);
  if (token) sessions.delete(token);
}

function migrateUsers(db) {
  let changed = false;
  for (const user of db.users || []) {
    if (!user.organization) { user.organization = 'Gabutti Corse'; changed = true; }
    if (!user.status) { user.status = 'Activo'; changed = true; }
    if (!user.passwordHash && user.password) {
      user.passwordHash = hashPassword(user.password);
      delete user.password;
      changed = true;
    }
  }
  return changed;
}

module.exports = {
  createSession,
  getSession,
  hashPassword,
  migrateUsers,
  revokeSession,
  sanitizeUser,
  verifyPassword
};
