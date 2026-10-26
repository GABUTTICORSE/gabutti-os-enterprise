const assert = require('assert');
const {
  canAccessCollection,
  workspaceForUser
} = require('../access');
const {
  createApiToken,
  findActiveApiToken,
  publicApiTokens,
  sanitizeUser
} = require('../auth');
const {
  createSalesInbox,
  listSalesFollowUps,
  processSalesInbox,
  recordSalesInvoice
} = require('../sales_flow');

const ventas = {
  id: 'u_ventas',
  name: 'Elisa',
  email: 'ventas@example.com',
  role: 'Ventas',
  status: 'Activo',
  passwordHash: 'salt:hash',
  apiTokens: [{ id: 'tok_old', tokenHash: 'no-mostrar', hint: 'abcd' }]
};

const executive = {
  id: 'u_exec',
  name: 'Andrea',
  role: 'Executive',
  status: 'Activo'
};

const db = {
  finance: [{ id: 'f1', amount: 10 }],
  imports: [{ id: 'i1' }],
  users: [ventas, executive],
  roles: [{ name: 'Ventas' }, { name: 'Executive' }],
  inbox: [],
  clients: [],
  quotes: [{ id: 'q1', status: 'Enviada', owner: 'Otra persona' }],
  quote_items: [],
  sales_orders: [],
  tasks: [
    { id: 't1', title: 'Seguimiento día 3', type: 'Seguimiento', status: 'Pendiente', owner: 'Elisa' },
    { id: 't2', title: 'Seguimiento día 5', type: 'Seguimiento', status: 'Pendiente', owner: 'Otra persona' }
  ],
  products: [{ id: 'p1', name: 'Casco', price: 1000 }],
  activity: []
};

const workspace = workspaceForUser(ventas, db, sanitizeUser);
assert.ok(workspace, 'Ventas debe recibir un espacio de trabajo');
assert.equal(workspace.finance, undefined);
assert.equal(workspace.imports, undefined);
assert.ok(Array.isArray(workspace.inbox));
assert.ok(Array.isArray(workspace.quotes));
assert.ok(Array.isArray(workspace.sales_orders));
assert.equal(workspace.users.length, 1);
assert.equal(workspace.users[0].name, 'Elisa');
assert.equal(workspace.users[0].passwordHash, undefined);
assert.equal(workspace.users[0].apiTokens, undefined);

const full = workspaceForUser(executive, db, sanitizeUser);
assert.equal(full.finance.length, 1);
assert.equal(full.users[0].passwordHash, undefined);

assert.equal(workspaceForUser({ role: 'Equipo' }, db, sanitizeUser), null);
assert.equal(canAccessCollection({ role: 'Equipo' }, 'inbox', 'GET'), false);
assert.equal(canAccessCollection(ventas, 'finance', 'GET'), false);
assert.equal(canAccessCollection(ventas, 'finance', 'POST'), false);
assert.equal(canAccessCollection(ventas, 'imports', 'GET'), false);
assert.equal(canAccessCollection(ventas, 'inbox', 'POST'), true);
assert.equal(canAccessCollection(ventas, 'quotes', 'PUT'), true);
assert.equal(canAccessCollection(ventas, 'products', 'GET'), true);
assert.equal(canAccessCollection(ventas, 'products', 'PUT'), false);
assert.equal(canAccessCollection(ventas, 'sales_orders', 'GET'), true);
assert.equal(canAccessCollection(ventas, 'sales_orders', 'PUT'), false);
assert.equal(canAccessCollection(executive, 'finance', 'GET'), true);

const created = createApiToken();
assert.equal(created.secret.startsWith('gsone_'), true);
assert.equal(created.tokenHash.includes(created.secret), false);
assert.equal(created.prefix, created.secret.slice(0, 16));

const tokenDb = {
  users: [{
    id: 'u_ventas',
    name: 'Elisa',
    role: 'Ventas',
    status: 'Activo',
    apiTokens: [{
      id: 'tok1',
      name: 'asistente',
      tokenHash: created.tokenHash,
      prefix: created.prefix,
      hint: created.hint,
      revokedAt: ''
    }]
  }]
};

const match = findActiveApiToken(tokenDb, created.secret);
assert.equal(match && match.user.id, 'u_ventas');
const published = publicApiTokens(tokenDb.users[0]);
assert.equal(published[0].hint, created.hint);
assert.equal(published[0].tokenHash, undefined);
assert.equal(Object.prototype.hasOwnProperty.call(published[0], 'tokenHash'), false);

match.token.revokedAt = new Date().toISOString();
assert.equal(findActiveApiToken(tokenDb, created.secret), null);

let counter = 0;
const uid = prefix => `${prefix}_${++counter}`;
const log = (database, action, entity, detail) => {
  database.activity.unshift({ action, entity, detail });
};
const nextNumber = (database, collection) => {
  database.counters = database.counters || {};
  database.counters[collection] = (database.counters[collection] || 0) + 1;
  return String(database.counters[collection]);
};

const flowDb = {
  clients: [],
  tasks: [],
  commercial_processes: [],
  inbox_analysis: [],
  inbox: [],
  quotes: [],
  sales_orders: [],
  finance: [],
  activity: []
};

const inboxResult = createSalesInbox({
  db: flowDb,
  body: {
    sender: 'Mario Rossi',
    email: 'mario@example.com',
    whatsapp: '+56 9 1234 5678',
    message: 'Necesito cotización casco Bell HP10 talla M',
    source: 'Manual'
  },
  actor: ventas,
  uid,
  nextNumber,
  log
});

assert.equal(inboxResult.inbox.owner, 'Elisa');

const processed = processSalesInbox({
  db: flowDb,
  inboxId: inboxResult.inbox.id,
  actor: ventas,
  uid,
  nextNumber,
  log
});

assert.equal(processed.client.status, 'Prospecto');
assert.equal(processed.client.rut, '');
assert.equal(processed.client.owner, 'Elisa');
assert.equal(processed.commercialProcess.owner, 'Elisa');
assert.equal(processed.task.owner, 'Elisa');
assert.equal(flowDb.clients.length, 1);

processSalesInbox({
  db: flowDb,
  inboxId: inboxResult.inbox.id,
  actor: ventas,
  uid,
  nextNumber,
  log
});
assert.equal(flowDb.clients.length, 1, 'No debe duplicar el prospecto');

flowDb.sales_orders.push({
  id: 'sal_1',
  number: 'PV-000001',
  quoteId: 'q_elisa',
  owner: 'Elisa',
  status: 'Pendiente',
  total: 1000
});
flowDb.quotes.push({
  id: 'q_elisa',
  status: 'Aceptada',
  owner: 'Elisa'
});

const invoice = recordSalesInvoice({
  db: flowDb,
  body: {
    quoteId: 'q_elisa',
    taxDocumentType: 'Factura',
    taxDocumentNumber: '188'
  },
  actor: ventas,
  log
});

assert.equal(invoice.order.status, 'Facturado');
assert.equal(invoice.order.taxDocumentNumber, '188');
assert.equal(invoice.order.invoiceSource, 'LibreDTE');
assert.equal(invoice.order.invoicedBy, 'Elisa');
assert.equal(invoice.quote.taxDocumentNumber, '188');
assert.equal(flowDb.finance.length, 0, 'Registrar la factura no crea un movimiento de finanzas');
assert.ok(flowDb.activity.some(item => item.action === 'invoice' && item.detail.includes('Elisa')));

assert.throws(
  () => recordSalesInvoice({
    db: flowDb,
    body: { orderId: 'sal_1', taxDocumentType: 'Nota', taxDocumentNumber: '1' },
    actor: ventas,
    log
  }),
  error => error.status === 400
);

const followUps = listSalesFollowUps({
  tasks: db.tasks,
  quotes: db.quotes
}, ventas);
assert.equal(followUps.tasks.length, 1);
assert.equal(followUps.tasks[0].id, 't1');
assert.equal(followUps.quotes.length, 0);

console.log('OK sales access');
