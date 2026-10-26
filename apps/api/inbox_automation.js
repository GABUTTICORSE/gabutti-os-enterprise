const {
  classifyInboxMessage
} = require('./inbox_classifier');

function runInboxCreatedAutomation(
  db,
  inboxItem,
  helpers = {}
){
  const uid = helpers.uid;
  const log = helpers.log;

  if(typeof uid !== 'function'){
    throw new Error(
      'runInboxCreatedAutomation necesita la función uid.'
    );
  }

  if(typeof log !== 'function'){
    throw new Error(
      'runInboxCreatedAutomation necesita la función log.'
    );
  }

  db.clients = db.clients || [];
  db.tasks = db.tasks || [];
  db.commercial_processes =
    db.commercial_processes || [];
  db.inbox_analysis = db.inbox_analysis || [];

  const assignedOwner =
    String(inboxItem.owner || helpers.actorName || '').trim() ||
    'Ventas';

  inboxItem.owner = assignedOwner;

  let changed = false;

  const normalize = value => String(value || '').trim().toLowerCase();
  const senderEmail = normalize(inboxItem.email);
  const senderWhatsapp = String(inboxItem.whatsapp || '').replace(/\D/g, '');
  const senderName = String(inboxItem.sender || '').trim();

  let client = db.clients.find(item => {
    const emailMatches = senderEmail && normalize(item.email) === senderEmail;
    const itemWhatsapp = String(item.whatsapp || '').replace(/\D/g, '');
    const whatsappMatches = senderWhatsapp && itemWhatsapp === senderWhatsapp;
    return emailMatches || whatsappMatches;
  });

  if(!client && (senderName || senderEmail || senderWhatsapp)){
    client = {
      id: uid('cli'),
      createdAt: new Date().toISOString(),
      name: senderName || senderEmail || `Contacto ${senderWhatsapp}`,
      rut: '',
      whatsapp: inboxItem.whatsapp || '',
      email: inboxItem.email || '',
      discipline: 'Por definir',
      level: 'Por definir',
      city: '',
      source: inboxItem.source || 'Inbox',
      status: 'Prospecto',
      owner: assignedOwner,
      number: typeof helpers.nextNumber === 'function'
        ? helpers.nextNumber(db, 'clients')
        : '',
      createdAutomatically: true,
      sourceInboxId: inboxItem.id
    };
    db.clients.unshift(client);
    log(db, 'auto_create', 'clients', `Cliente ${client.name} creado desde Inbox ${inboxItem.id}`);
    changed = true;
  }

  const classification = classifyInboxMessage({
    message: inboxItem.message,
    sender: inboxItem.sender,
    source: inboxItem.source
  });

  let analysis = db.inbox_analysis.find(item =>
    item.inboxId === inboxItem.id
  );

  if(!analysis){
    analysis = {
      id: uid('ina'),
      createdAt: new Date().toISOString(),
      inboxId: inboxItem.id,
      intent: classification.intent,
      intentLabel: classification.intentLabel,
      brand: classification.brand,
      category: classification.category,
      product: classification.product,
      size: classification.size,
      quantity: classification.quantity,
      priority: classification.priority,
      confidence: classification.confidence,
      sender: classification.sender,
      source: classification.source,
      originalMessage:
        classification.originalMessage,
      status: 'Analizado'
    };

    db.inbox_analysis.unshift(analysis);

    log(
      db,
      'auto_analyze',
      'inbox_analysis',
      `Inbox ${inboxItem.id} clasificado como ${analysis.intent}`
    );

    changed = true;
  }

  let task = db.tasks.find(item =>
    item.type === 'Inbox' &&
    item.sourceId === inboxItem.id
  );

  if(!task){
    const taskDetail = [
      analysis.intentLabel,
      analysis.brand,
      analysis.product
    ]
      .filter(Boolean)
      .join(' - ');

    task = {
      id: uid('tsk'),
      createdAt: new Date().toISOString(),
      title:
        `Revisar inbox: ${
          inboxItem.sender ||
          inboxItem.source ||
          'Entrada'
        }${
          taskDetail
            ? ` - ${taskDetail}`
            : ''
        }`,
      type: 'Inbox',
      owner: assignedOwner,
      dueDate: new Date()
        .toISOString()
        .slice(0, 10),
      status: 'Pendiente',
      priority: analysis.priority,
      sourceId: inboxItem.id,
      inboxId: inboxItem.id,
      analysisId: analysis.id
    };

    db.tasks.unshift(task);
    changed = true;
  }

  let commercialProcess =
    db.commercial_processes.find(item =>
      item.inboxId === inboxItem.id
    );

  if(!commercialProcess){
    const productDescription = [
      analysis.brand,
      analysis.product,
      analysis.category,
      analysis.size
        ? `Talla ${analysis.size}`
        : ''
    ]
      .filter(Boolean)
      .join(' ');

    commercialProcess = {
      id: uid('pc'),
      createdAt: new Date().toISOString(),
      clientId: client?.id || '',
      clientName:
        client?.name ||
        inboxItem.sender ||
        'Contacto nuevo',
      product:
        productDescription ||
        inboxItem.message ||
        'Necesidad por definir',
      status: 'Nuevo',
      value: 0,
      owner: assignedOwner,
      nextDate: new Date()
        .toISOString()
        .slice(0, 10),
      source: 'Inbox',
      inboxId: inboxItem.id,
      analysisId: analysis.id,
      intent: analysis.intent,
      intentLabel: analysis.intentLabel,
      brand: analysis.brand,
      category: analysis.category,
      productModel: analysis.product,
      size: analysis.size,
      quantity: analysis.quantity,
      priority: analysis.priority,
      confidence: analysis.confidence,
      contactEmail: inboxItem.email || '',
      contactWhatsapp: inboxItem.whatsapp || ''
    };

    db.commercial_processes.unshift(
      commercialProcess
    );

    log(
      db,
      'auto_create',
      'commercial_processes',
      `Proceso creado desde Inbox ${inboxItem.id}`
    );

    changed = true;
  }

  inboxItem.status = 'Convertido';
  inboxItem.clientId = client?.id || '';
  inboxItem.analysisId = analysis.id;
  inboxItem.processId = commercialProcess.id;
  inboxItem.taskId = task.id;

  return {
    changed,
    client,
    analysis,
    task,
    commercialProcess,
    inboxItem
  };
}

module.exports = {
  runInboxCreatedAutomation
};
