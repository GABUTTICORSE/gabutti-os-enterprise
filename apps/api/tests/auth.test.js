const assert = require('assert');
const {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpCode,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  migrateUsers,
  verifyRecoveryCode,
  verifyTotpCode
} = require('../auth');

const testPassword = 'test-password-local';
const stored = hashPassword(testPassword);
assert.ok(stored.includes(':'), 'El hash debe incluir salt');
assert.strictEqual(verifyPassword(testPassword, stored), true);
assert.strictEqual(verifyPassword('incorrecta', stored), false);

const db = { users: [{ id: 'u1', email: 'a@b.cl', password: 'secreta-de-prueba' }] };
assert.strictEqual(migrateUsers(db), true);
assert.ok(db.users[0].passwordHash);
assert.strictEqual(db.users[0].password, undefined);
assert.strictEqual(db.users[0].organization, 'Gabutti Corse');
assert.strictEqual(db.users[0].status, 'Activo');
assert.strictEqual(sanitizeUser(db.users[0]).passwordHash, undefined);


const testTotpSecret = 'PRUEBA-TOTP-NO-REAL';
const encryptedTotpSecret =
  encryptTotpSecret(testTotpSecret);

assert.ok(
  encryptedTotpSecret.startsWith('v1:'),
  'El secreto TOTP debe usar formato cifrado v1'
);

assert.strictEqual(
  encryptedTotpSecret.includes(testTotpSecret),
  false,
  'El secreto TOTP no debe quedar en texto plano'
);

assert.strictEqual(
  decryptTotpSecret(encryptedTotpSecret),
  testTotpSecret,
  'El secreto TOTP debe descifrarse correctamente'
);


const rfcTotpSecret =
  'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const rfcTotpTimestamp = 59 * 1000;

assert.strictEqual(
  generateTotpCode(
    rfcTotpSecret,
    rfcTotpTimestamp
  ),
  '287082',
  'TOTP debe coincidir con el vector RFC'
);

assert.strictEqual(
  verifyTotpCode(
    rfcTotpSecret,
    '287082',
    rfcTotpTimestamp,
    0
  ),
  true,
  'TOTP válido debe ser aceptado'
);

assert.strictEqual(
  verifyTotpCode(
    rfcTotpSecret,
    '000000',
    rfcTotpTimestamp,
    0
  ),
  false,
  'TOTP incorrecto debe ser rechazado'
);


const recovery =
  generateRecoveryCodes();

assert.strictEqual(
  recovery.codes.length,
  10,
  'Deben generarse 10 códigos de recuperación'
);

assert.strictEqual(
  recovery.hashes.length,
  10,
  'Deben generarse 10 hashes de recuperación'
);

assert.strictEqual(
  new Set(recovery.codes).size,
  10,
  'Los códigos de recuperación deben ser únicos'
);

assert.strictEqual(
  verifyRecoveryCode(
    recovery.codes[0],
    recovery.hashes
  ),
  true,
  'Un código de recuperación válido debe aceptarse'
);

assert.strictEqual(
  verifyRecoveryCode(
    'AAAA-BBBB-CCCC-DDDD',
    recovery.hashes
  ),
  false,
  'Un código de recuperación incorrecto debe rechazarse'
);

console.log('auth.test.js OK');
