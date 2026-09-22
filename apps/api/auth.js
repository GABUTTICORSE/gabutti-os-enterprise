const crypto = require('crypto');

const sessions = new Map();

const SESSION_HOURS = 8;
const SESSION_IDLE_MINUTES = 30;
const SESSION_ROTATION_MINUTES = 30;
const SESSION_COOKIE = 'gsone_session';

const TOTP_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getTotpEncryptionKey() {
  const encoded = String(
    process.env.GS_ONE_TOTP_ENCRYPTION_KEY || ''
  ).trim();

  if (!encoded) {
    throw new Error(
      'GS_ONE_TOTP_ENCRYPTION_KEY no configurada'
    );
  }

  const key = Buffer.from(encoded, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'GS_ONE_TOTP_ENCRYPTION_KEY debe contener 32 bytes'
    );
  }

  return key;
}

function encryptTotpSecret(secret) {
  const iv = crypto.randomBytes(12);
  const key = getTotpEncryptionKey();

  const cipher = crypto.createCipheriv(
    TOTP_ENCRYPTION_ALGORITHM,
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(secret), 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

function decryptTotpSecret(stored) {
  const parts = String(stored || '').split(':');

  if (
    parts.length !== 4 ||
    parts[0] !== 'v1'
  ) {
    throw new Error(
      'Secreto TOTP cifrado inválido'
    );
  }

  const [, iv64, tag64, encrypted64] = parts;
  const key = getTotpEncryptionKey();

  const decipher = crypto.createDecipheriv(
    TOTP_ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(iv64, 'base64')
  );

  decipher.setAuthTag(
    Buffer.from(tag64, 'base64')
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(encrypted64, 'base64')
    ),
    decipher.final()
  ]).toString('utf8');
}

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

function rotateSession(session) {
  if (!session || !session.token) {
    return null;
  }

  const createdAt = Date.parse(
    session.createdAt
  );

  const now = Date.now();

  if (
    !Number.isFinite(createdAt) ||
    now - createdAt <
      SESSION_ROTATION_MINUTES *
      60 *
      1000
  ) {
    return null;
  }

  const oldToken = session.token;
  const newToken = crypto
    .randomBytes(32)
    .toString('hex');

  const rotatedAt =
    new Date(now).toISOString();

  sessions.set(newToken, {
    userId: session.userId,
    createdAt: rotatedAt,
    lastActivityAt: rotatedAt,
    expiresAt: session.expiresAt
  });

  sessions.delete(oldToken);

  return {
    token: newToken,
    expiresAt: session.expiresAt
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
  decryptTotpSecret,
  encryptTotpSecret,
  getSession,
  hashPassword,
  migrateUsers,
  revokeSession,
  rotateSession,
  sanitizeUser,
  verifyPassword
};