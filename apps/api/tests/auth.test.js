const assert = require('assert');
const {
  decryptTotpSecret,
  encryptTotpSecret,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  migrateUsers
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

console.log('auth.test.js OK');
