const SALES_ROLE = 'Ventas';
const EXECUTIVE_ROLE = 'Executive';

const SALES_WRITE = [
  'clients',
  'inbox',
  'commercial_processes',
  'quotes',
  'quote_items',
  'tasks'
];

// sales_orders se lee para ver el pedido y el folio, pero no se escribe
// por la API genérica: así Ventas no mueve stock ni crea cobros.
// El folio emitido en LibreDTE entra solo por POST /api/sales/invoices.
const SALES_READ = [
  ...SALES_WRITE,
  'sales_orders',
  'inbox_analysis',
  'history',
  'products',
  'catalogs',
  'transport_companies',
  'transport_branches'
];

function isExecutive(user) {
  return user?.role === EXECUTIVE_ROLE;
}

function isSales(user) {
  return user?.role === SALES_ROLE;
}

function canAccessCollection(user, collection, method) {
  if (isExecutive(user)) return true;
  if (!isSales(user)) return false;

  const verb = String(method || 'GET').toUpperCase();

  if (verb === 'GET') return SALES_READ.includes(collection);

  return SALES_WRITE.includes(collection);
}

function workspaceForUser(user, db, sanitizeUser) {
  if (isExecutive(user)) {
    return {
      ...db,
      users: (db.users || []).map(sanitizeUser)
    };
  }

  if (!isSales(user)) return null;

  const workspace = {};

  for (const collection of SALES_READ) {
    workspace[collection] = db[collection] || [];
  }

  workspace.users = [sanitizeUser(user)].filter(Boolean);
  workspace.roles = (db.roles || []).filter(role => role.name === SALES_ROLE);

  return workspace;
}

module.exports = {
  EXECUTIVE_ROLE,
  SALES_READ,
  SALES_ROLE,
  SALES_WRITE,
  canAccessCollection,
  isExecutive,
  isSales,
  workspaceForUser
};
