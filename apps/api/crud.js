function normalizeContact(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s()+\-]/g, '');
}

function normalizeName(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function findExistingClient(db, inbox) {
  const email = normalizeContact(inbox.email);
  const whatsapp = normalizeContact(inbox.whatsapp);
  const rut = normalizeContact(inbox.rut);
  const sender = normalizeName(inbox.sender);

  return (db.clients || []).find(client => {
    const clientEmail =
      normalizeContact(client.email);

    const clientWhatsapp =
      normalizeContact(client.whatsapp);

    const clientRut =
      normalizeContact(client.rut);

    const clientName =
      normalizeName(client.name);

    const sameEmail =
      email &&
      clientEmail &&
      email === clientEmail;

    const sameWhatsapp =
      whatsapp &&
      clientWhatsapp &&
      whatsapp === clientWhatsapp;

    const sameRut =
      rut &&
      clientRut &&
      rut === clientRut;

    /*
      El nombre se usa solamente como último respaldo.

      Para reducir duplicados falsos, se exige que el nombre
      tenga al menos cuatro caracteres.
    */
    const sameName =
      sender.length >= 4 &&
      clientName &&
      sender === clientName;

    return (
      sameEmail ||
      sameWhatsapp ||
      sameRut ||
      sameName
    );
  });
}

function createClientFromInbox({
  db,
  inbox,
  uid,
  nextNumber,
  log
}) {
  db.clients = db.clients || [];

  const client = {
    id: uid('cli'),
    number: nextNumber(db, 'clients'),
    createdAt: new Date().toISOString(),

    name:
      inbox.sender ||
      'Contacto sin nombre',

    rut:
      inbox.rut ||
      '',

    whatsapp:
      inbox.whatsapp ||
      '',

    email:
      inbox.email ||
      '',

    discipline:
      inbox.discipline ||
      '',

    level:
      inbox.level ||
      '',

    city:
      inbox.city ||
      '',

    status: 'Prospecto',

    source:
      inbox.source ||
      'Inbox',

    inboxId:
      inbox.id,

    observations:
      `Cliente creado automáticamente desde ` +
      `Inbox ${inbox.number || inbox.id}.`
  };

  db.clients.unshift(client);

  log(
    db,
    'auto_create',
    'clients',
    `Cliente ${client.number || client.id} ` +
    `creado desde Inbox ${inbox.number || inbox.id}`
  );

  return client;
}

function createQuoteFromInbox({
  db,
  inbox,
  client,
  uid,
  nextNumber,
  log
}) {
  db.quotes = db.quotes || [];

  const quote = {
    id: uid('quo'),
    number: nextNumber(db, 'quotes'),
    createdAt: new Date().toISOString(),

    clientId:
      client.id,

    clientNumber:
      client.number ||
      '',

    clientName:
      client.name ||
      inbox.sender ||
      'Cliente',

    inboxId:
      inbox.id,

    source:
      'Inbox',

    sourceChannel:
      inbox.source ||
      'Inbox',

    product:
      inbox.product ||
      inbox.message ||
      'Necesidad por definir',

    description:
      `Solicitud recibida por ` +
      `${inbox.source || 'Inbox'}: ` +
      `${inbox.message || ''}`,

    quantity:
      Number(inbox.quantity || 1),

    unitPrice:
      Number(inbox.unitPrice || 0),

    total:
      Number(inbox.quantity || 1) *
      Number(inbox.unitPrice || 0),

    status:
      'Borrador',

    owner:
      inbox.owner ||
      'Andrea'
  };

  db.quotes.unshift(quote);

  log(
    db,
    'auto_create',
    'quotes',
    `Cotización ${quote.number || quote.id} ` +
    `creada desde Inbox ${inbox.number || inbox.id}`
  );

  return quote;
}

function processNewInbox({
  db,
  inbox,
  uid,
  nextNumber,
  log
}) {
  db.clients = db.clients || [];
  db.quotes = db.quotes || [];

  /*
    Evita procesar dos veces una misma entrada.
  */
  if (
    inbox.status === 'Procesado' &&
    inbox.quoteId
  ) {
    return inbox;
  }

  /*
    Primero verificamos si ya existe una cotización
    relacionada con este Inbox.
  */
  let quote = db.quotes.find(item =>
    item.inboxId === inbox.id
  );

  /*
    Después buscamos el cliente existente.
  */
  let client = findExistingClient(
    db,
    inbox
  );

  /*
    Si el Inbox ya tenía un clientId, intentamos
    recuperar directamente ese cliente.
  */
  if (!client && inbox.clientId) {
    client = db.clients.find(item =>
      item.id === inbox.clientId
    );
  }

  /*
    Si no existe cliente, lo creamos.
  */
  if (!client) {
    client = createClientFromInbox({
      db,
      inbox,
      uid,
      nextNumber,
      log
    });
  }

  /*
    Si todavía no existe cotización,
    la creamos automáticamente.
  */
  if (!quote) {
    quote = createQuoteFromInbox({
      db,
      inbox,
      client,
      uid,
      nextNumber,
      log
    });
  }

  /*
    Finalmente dejamos todas las relaciones guardadas
    dentro del registro Inbox.
  */
  inbox.clientId =
    client.id;

  inbox.clientNumber =
    client.number ||
    '';

  inbox.clientName =
    client.name ||
    '';

  inbox.quoteId =
    quote.id;

  inbox.quoteNumber =
    quote.number ||
    '';

  inbox.status =
    'Procesado';

  inbox.processedAt =
    new Date().toISOString();

  inbox.processedBy =
    inbox.owner ||
    'Sistema';

  inbox.processingResult =
    client.inboxId === inbox.id
      ? 'Cliente y cotización creados'
      : 'Cliente existente y cotización creada';

  log(
    db,
    'auto_process',
    'inbox',
    `Inbox ${inbox.number || inbox.id} procesado. ` +
    `Cliente ${client.number || client.id}. ` +
    `Cotización ${quote.number || quote.id}.`
  );

  return inbox;
}

function createRecord({
  db,
  collection,
  body,
  uid,
  nextNumber,
  addHistory,
  hasHistory,
  log
}) {
  db[collection] =
    db[collection] ||
    [];

  db.activity =
    db.activity ||
    [];

  db.tasks =
    db.tasks ||
    [];

  db.history =
    db.history ||
    [];

  db.clients =
    db.clients ||
    [];

  db.quotes =
    db.quotes ||
    [];

  const number =
    nextNumber(
      db,
      collection
    );

  const item = {
    id: uid(
      collection.slice(0, 3)
    ),

    number,

    createdAt:
      new Date().toISOString(),

    ...body
  };

  db[collection].unshift(item);

  /*
    AUTOMATIZACIÓN DEL INBOX

    Inbox:
    - busca cliente
    - crea cliente si no existe
    - crea cotización
    - no crea proceso comercial
    - no crea tarea
  */
  if (collection === 'inbox') {
    processNewInbox({
      db,
      inbox: item,
      uid,
      nextNumber,
      log
    });
  }

  /*
    La cotización manual o creada desde otro módulo
    conserva su registro de historial cuando ya viene
    relacionada con un proceso comercial.
  */
  if (
    collection === 'quotes' &&
    item.processId
  ) {
    const historyExists =
      hasHistory(
        db,
        item.processId,
        'Cotización generada',
        item.id
      );

    if (!historyExists) {
      addHistory(db, {
        processId:
          item.processId,

        clientId:
          item.clientId ||
          '',

        type:
          'Cotización',

        title:
          'Cotización generada',

        description:
          `${item.number || item.id} fue generada`,

        sourceId:
          item.id
      });
    }
  }

  /*
    Un proceso comercial creado de forma explícita
    puede generar su tarea inicial.

    El Inbox no crea procesos automáticamente.
  */
  if (
    collection ===
    'commercial_processes'
  ) {
    db.tasks.unshift({
      id: uid('tsk'),

      createdAt:
        new Date().toISOString(),

      title:
        `Seguimiento proceso: ` +
        `${item.clientName || 'Cliente'} - ` +
        `${item.product || ''}`,

      type:
        'Proceso Comercial',

      owner:
        item.owner ||
        'Andrea',

      dueDate:
        item.nextDate ||
        '',

      status:
        'Pendiente',

      processId:
        item.id,

      sourceId:
        item.id
    });
  }

  /*
    Automatización existente para stock crítico.
  */
  if (
    collection === 'stock' &&
    Number(item.available || 0) <=
    Number(item.minimum || 0)
  ) {
    db.tasks.unshift({
      id: uid('tsk'),

      createdAt:
        new Date().toISOString(),

      title:
        `Revisar stock crítico: ` +
        `${item.product || 'Producto'}`,

      type:
        'Stock',

      owner:
        'Andrea',

      dueDate:
        new Date()
          .toISOString()
          .slice(0, 10),

      status:
        'Pendiente',

      sourceId:
        item.id
    });
  }

  log(
    db,
    'create',
    collection,
    `Creado ${item.id}`
  );

  return item;
}

module.exports = {
  createRecord
};