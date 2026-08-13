const assert = require('assert');
const { hashPassword, verifyPassword, sanitizeUser, migrateUsers } = require('../auth');

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

console.log('auth.test.js OK');
