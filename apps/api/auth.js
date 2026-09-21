const crypto = require('crypto');

const sessions = new Map();

const SESSION_HOURS = 8;
const SESSION_IDLE_MINUTES = 30;
const SESSION_COOKIE = 'gsone_session';

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString('hex')
) {
  const hash = crypto
    .scryptSync(String(password), salt, 64)
    .toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;

  const [salt, expected] = stored.split(':');

  const actual = crypto.scryptSync(
    String(password),
    salt,
    64
  );

  const expectedBuffer = Buffer.from(
    expected,
    'hex'
  );

  return (
    actual.length === expectedBuffer.length &&
    crypto.timingSafeEqual(
      actual,
      expectedBuffer
    )
  );
}

function sanitizeUser(user) {
  if (!user) return null;

  const safe = {
    id: user.id,
    name: user.name,
    email: user.email,
    organization: user.organization,
    role: user.role,
    condition: user.condition,
    status: user.status
  };

  if (user.legacyTitle !== undefined) {
    safe.legacyTitle = user.legacyTitle;
  }

  return safe;
}

function createSession(user) {
  const token = crypto
    .randomBytes(32)
    .toString('hex');

  const createdAt = new Date();

  const expiresAt = new Date(
    createdAt.getTime() +
    SESSION_HOURS * 60 * 60 * 1000
  );

  sessions.set(token, {
    userId: user.id,
    createdAt: createdAt.toISOString(),
    lastActivityAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  });

  return {
    token,
    expiresAt: expiresAt.toISOString()
  };
}

function parseCookies(req) {
  const header = String(
    req.headers.cookie || ''
  );

  const cookies = {};

  for (const part of header.split(';')) {
    const index = part.indexOf('=');

    if (index < 0) continue;

    const key = part
      .slice(0, index)
      .trim();

    const value = part
      .slice(index + 1)
      .trim();

    if (!key) continue;

    try {
      cookies[key] =
        decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function getSessionToken(req) {
  const cookies = parseCookies(req);

  return cookies[SESSION_COOKIE] || '';
}

function getSession(req) {
  const token = getSessionToken(req);

  if (!token) return null;

  const session = sessions.get(token);

  if (!session) return null;

  const now = Date.now();

  if (
    Date.parse(session.expiresAt) <= now
  ) {
    sessions.delete(token);
    return null;
  }

  const lastActivityAt =
    Date.parse(
      session.lastActivityAt ||
      session.createdAt
    );

  const idleLimit =
    SESSION_IDLE_MINUTES *
    60 *
    1000;

  if (
    !Number.isFinite(lastActivityAt) ||
    now - lastActivityAt >= idleLimit
  ) {
    sessions.delete(token);
    return null;
  }

  session.lastActivityAt =
    new Date(now).toISOString();

  return {
    token,
    ...session
  };
}

function revokeSession(req) {
  const token = getSessionToken(req);

  if (token) {
    sessions.delete(token);
  }
}

function createSessionCookie(
  token,
  expiresAt
) {
  const expires =
    new Date(expiresAt).toUTCString();

  return (
    `${SESSION_COOKIE}=` +
    `${encodeURIComponent(token)}; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Strict; ` +
    `Expires=${expires}`
  );
}

function clearSessionCookie() {
  return (
    `${SESSION_COOKIE}=; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Strict; ` +
    `Max-Age=0`
  );
}

function migrateUsers(db) {
  let changed = false;

  for (const user of db.users || []) {
    if (!user.organization) {
      user.organization =
        'Gabutti Corse';

      changed = true;
    }

    if (!user.status) {
      user.status = 'Activo';
      changed = true;
    }

    if (
      !user.passwordHash &&
      user.password
    ) {
      user.passwordHash =
        hashPassword(user.password);

      delete user.password;

      changed = true;
    }
  }

  return changed;
}

module.exports = {
  clearSessionCookie,
  createSession,
  createSessionCookie,
  getSession,
  hashPassword,
  migrateUsers,
  revokeSession,
  sanitizeUser,
  verifyPassword
};