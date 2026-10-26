const {
  runInboxCreatedAutomation
} = require('./inbox_automation');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function actorName(actor) {
  return String(actor?.name || '').trim() || 'Ventas';
}

function samePerson(owner, actor) {
  if (!actor || actor.role === 'Executive') return true;

  const name = actorName(actor);
  const value = String(owner || '').trim();

  return !value || value === name || value === 'Ventas';
}

function createSalesInbox({
  db,
  body = {},
  actor,
  uid,
  nextNumber,
  log
}) {
  const message = String(body.message || '').trim();
  const sender = String(body.sender || '').trim();

  if (!message && !sender) {
    throw httpError(
      400,
      'Indica el mensaje o el nombre de quien consulta.'
    );
  }

  db.inbox = db.inbox || [];

  const item = {
    id: uid('inb'),
    number: nextNumber(db, 'inbox'),
    createdAt: new Date().toISOString(),
    source: String(body.source || 'Manual').trim() || 'Manual',
    sender,
    whatsapp: String(body.whatsapp || '').trim(),
    email: String(body.email || '').trim(),
    message,
    status: 'Nuevo',
    owner: String(body.owner || '').trim() || actorName(actor)
  };

  db.inbox.unshift(item);

  log(
    db,
    'create',
    'inbox',
    `Entrada ${item.number || item.id} registrada por ${actorName(actor)}`
  );

  return {
    ok: true,
    inbox: item
  };
}

function processSalesInbox({
  db,
  inboxId,
  actor,
  uid,
  nextNumber,
  log
}) {
  db.inbox = db.inbox || [];

  const inbox = db.inbox.find(item => item.id === inboxId);

  if (!inbox) {
    throw httpError(404, 'Entrada de Inbox no encontrada.');
  }

  if (!String(inbox.owner || '').trim()) {
    inbox.owner = actorName(actor);
  }

  const result = runInboxCreatedAutomation(
    db,
    inbox,
    {
      uid,
      log,
      actorName: actorName(actor),
      nextNumber
    }
  );

  if (result.client && !result.client.number) {
    result.client.number = nextNumber(db, 'clients');
  }

  if (result.client && !result.client.owner) {
    result.client.owner = inbox.owner;
  }

  inbox.processedAt = inbox.processedAt || new Date().toISOString();
  inbox.processedBy = actorName(actor);

  log(
    db,
    'process',
    'inbox',
    `Inbox ${inbox.number || inbox.id} convertido por ${actorName(actor)}`
  );

  return {
    ok: true,
    inbox,
    client: result.client || null,
    commercialProcess: result.commercialProcess || null,
    task: result.task || null,
    analysis: result.analysis || null
  };
}

function recordSalesInvoice({
  db,
  body = {},
  actor,
  log
}) {
  const type = String(body.taxDocumentType || body.type || '').trim();
  const number = String(body.taxDocumentNumber || body.number || '').trim();

  if (!['Factura', 'Boleta'].includes(type)) {
    throw httpError(400, 'El documento debe ser Factura o Boleta.');
  }

  if (!number || number.length > 40 || /[\r\n]/.test(number)) {
    throw httpError(400, 'Indica el número o folio emitido en LibreDTE.');
  }

  db.sales_orders = db.sales_orders || [];
  db.quotes = db.quotes || [];

  const orderId = String(body.orderId || '').trim();
  const quoteId = String(body.quoteId || '').trim();

  const order = db.sales_orders.find(item =>
    (orderId && item.id === orderId) ||
    (quoteId && item.quoteId === quoteId)
  );

  if (!order) {
    throw httpError(
      404,
      'No hay un pedido para esta cotización. Acéptala antes de registrar la factura.'
    );
  }

  if (!samePerson(order.owner, actor)) {
    throw httpError(403, 'Este pedido no está asignado a tu usuario.');
  }

  const when = body.taxDocumentDate
    ? new Date(body.taxDocumentDate)
    : new Date();

  if (Number.isNaN(when.getTime())) {
    throw httpError(400, 'La fecha del documento no es válida.');
  }

  order.taxDocumentType = type;
  order.taxDocumentNumber = number;
  order.taxDocumentDate = when.toISOString();
  order.invoicedAt = new Date().toISOString();
  order.invoicedBy = actorName(actor);
  order.invoiceSource = 'LibreDTE';
  order.status = 'Facturado';

  const quote = db.quotes.find(item => item.id === (order.quoteId || quoteId));

  if (quote) {
    quote.taxDocumentType = type;
    quote.taxDocumentNumber = number;
    quote.taxDocumentDate = order.taxDocumentDate;
    quote.invoiceSource = 'LibreDTE';
    quote.invoicedBy = actorName(actor);
  }

  log(
    db,
    'invoice',
    'sales_orders',
    `${type} ${number} registrada en ${order.number || order.id} por ${actorName(actor)} (emitida en LibreDTE)`
  );

  return {
    ok: true,
    order,
    quote: quote || null
  };
}

function listSalesFollowUps(db, actor) {
  const tasks = (db.tasks || []).filter(task => {
    if (task.status === 'Hecha') return false;

    const type = String(task.type || '');
    const title = String(task.title || '');
    const code = String(task.automationCode || '');
    const isFollowUp =
      /seguimiento/i.test(type) ||
      /seguimiento/i.test(title) ||
      code.startsWith('QUOTE_') ||
      type === 'Inbox';

    return isFollowUp && samePerson(task.owner, actor);
  });

  const quotes = (db.quotes || []).filter(quote => {
    const open = ['Enviada', 'Esperando respuesta'].includes(quote.status);

    return open && samePerson(quote.owner, actor);
  });

  return {
    ok: true,
    tasks,
    quotes
  };
}

module.exports = {
  actorName,
  createSalesInbox,
  listSalesFollowUps,
  processSalesInbox,
  recordSalesInvoice
};
