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


const BASE32_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer) {
  let bits = '';
  let output = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);

    const padded =
      chunk.padEnd(5, '0');

    output += BASE32_ALPHABET[
      parseInt(padded, 2)
    ];
  }

  return output;
}

function decodeBase32(value) {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[\s=-]/g, '');

  if (!normalized) {
    throw new Error(
      'Secreto TOTP Base32 vacío'
    );
  }

  let bits = '';

  for (const char of normalized) {
    const index =
      BASE32_ALPHABET.indexOf(char);

    if (index < 0) {
      throw new Error(
        'Secreto TOTP Base32 inválido'
      );
    }

    bits += index
      .toString(2)
      .padStart(5, '0');
  }

  const bytes = [];

  for (
    let i = 0;
    i + 8 <= bits.length;
    i += 8
  ) {
    bytes.push(
      parseInt(bits.slice(i, i + 8), 2)
    );
  }

  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return encodeBase32(
    crypto.randomBytes(20)
  );
}


function generateTotpCode(
  secret,
  timestamp = Date.now()
) {
  const key = decodeBase32(secret);

  const counter = Math.floor(
    Number(timestamp) / 1000 / 30
  );

  const counterBuffer =
    Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(
    BigInt(counter)
  );

  const digest = crypto
    .createHmac('sha1', key)
    .update(counterBuffer)
    .digest();

  const offset =
    digest[digest.length - 1] & 0x0f;

  const binary =
    (
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)
    ) >>> 0;

  return String(
    binary % 1000000
  ).padStart(6, '0');
}

function verifyTotpCode(
  secret,
  code,
  timestamp = Date.now(),
  window = 1
) {
  const normalizedCode =
    String(code || '').trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  for (
    let offset = -window;
    offset <= window;
    offset += 1
  ) {
    const expected = generateTotpCode(
      secret,
      Number(timestamp) +
        offset * 30000
    );

    const actualBuffer =
      Buffer.from(normalizedCode);

    const expectedBuffer =
      Buffer.from(expected);

    if (
      actualBuffer.length ===
        expectedBuffer.length &&
      crypto.timingSafeEqual(
        actualBuffer,
        expectedBuffer
      )
    ) {
      return true;
    }
  }

  return false;
}


function hashRecoveryCode(code) {
  return crypto
    .createHash('sha256')
    .update(
      String(code || '')
        .trim()
        .toUpperCase()
    )
    .digest('hex');
}

function generateRecoveryCodes(count = 10) {
  const codes = [];

  for (let i = 0; i < count; i += 1) {
    const raw = crypto
      .randomBytes(8)
      .toString('hex')
      .toUpperCase();

    codes.push(
      `${raw.slice(0, 4)}-${raw.slice(4, 8)}-` +
      `${raw.slice(8, 12)}-${raw.slice(12, 16)}`
    );
  }

  return {
    codes,
    hashes: codes.map(hashRecoveryCode)
  };
}

function verifyRecoveryCode(
  code,
  storedHashes
) {
  const candidate =
    hashRecoveryCode(code);

  for (const stored of storedHashes || []) {
    const actual =
      Buffer.from(candidate, 'hex');

    const expected =
      Buffer.from(String(stored), 'hex');

    if (
      actual.length === expected.length &&
      crypto.timingSafeEqual(
        actual,
        expected
      )
    ) {
      return true;
    }
  }

  return false;
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

    if (user.totpEnabled === undefined) {
      user.totpEnabled = false;
      changed = true;
    }

    if (!Array.isArray(user.recoveryCodeHashes)) {
      user.recoveryCodeHashes = [];
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
  encodeBase32,
  encryptTotpSecret,
  decodeBase32,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSecret,
  getSession,
  hashRecoveryCode,
  verifyTotpCode,
  hashPassword,
  migrateUsers,
  revokeSession,
  rotateSession,
  sanitizeUser,
  verifyPassword,
  verifyRecoveryCode};