const express = require('express');
const fs = require('fs');
const path = require('path');
const { readDB, writeDB } = require('./database');
const { nextNumber } = require('./numbers');
const { runCreationAutomations } = require('./automation');
const {
  extractInboundMessages,
  verifyMetaSignature,
  verifyWebhookChallenge
} = require('./integrations/whatsapp/whatsapp.webhook');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'whatsapp.local.json');
const PORT = Number(process.env.WHATSAPP_PORT || 3101);

function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readConfig() {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {}

  return {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || file.verifyToken || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || file.appSecret || ''
  };
}

function log(db, action, entity, detail) {
  db.activity = db.activity || [];
  db.activity.unshift({
    id: uid('act'),
    at: new Date().toISOString(),
    action,
    entity,
    detail
  });
}

function createInboxItem(db, inbound) {
  db.inbox = db.inbox || [];

  const duplicate = db.inbox.find(item =>
    inbound.providerMessageId &&
    item.providerMessageId === inbound.providerMessageId
  );

  if (duplicate) return { item: duplicate, duplicate: true };

  const item = {
    id: uid('inb'),
    number: nextNumber(db, 'inbox'),
    createdAt: new Date().toISOString(),
    source: inbound.source,
    sender: inbound.sender,
    whatsapp: inbound.whatsapp,
    email: '',
    message: inbound.message,
    status: 'Nuevo',
    owner: 'Andrea',
    provider: inbound.provider,
    providerMessageId: inbound.providerMessageId,
    providerTimestamp: inbound.providerTimestamp,
    messageType: inbound.messageType,
    phoneNumberId: inbound.phoneNumberId,
    displayPhoneNumber: inbound.displayPhoneNumber,
    rawContextId: inbound.rawContextId
  };

  db.inbox.unshift(item);

  runCreationAutomations(
    db,
    {
      event: 'record.created',
      collection: 'inbox',
      item
    },
    { uid, log }
  );

  log(
    db,
    'whatsapp_inbound',
    'inbox',
    `Mensaje ${item.providerMessageId || item.id} recibido desde ${item.whatsapp || 'WhatsApp'}`
  );

  return { item, duplicate: false };
}

const app = express();

app.get('/health', (_req, res) => {
  const config = readConfig();
  res.json({
    ok: true,
    service: 'GS ONE WhatsApp Inbound',
    configured: !!config.verifyToken && !!config.appSecret
  });
});

app.get('/webhooks/whatsapp', (req, res) => {
  const { verifyToken } = readConfig();
  const verification = verifyWebhookChallenge(req.query, verifyToken);

  if (!verification.ok) {
    return res.status(403).send('Forbidden');
  }

  return res.status(200).send(verification.challenge);
});

app.post(
  '/webhooks/whatsapp',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res) => {
    const config = readConfig();
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const signature = String(req.get('x-hub-signature-256') || '');

    if (!verifyMetaSignature(rawBody, signature, config.appSecret)) {
      return res.status(401).json({ error: 'Firma de Meta inválida.' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      return res.status(400).json({ error: 'Payload JSON inválido.' });
    }

    const inboundMessages = extractInboundMessages(payload);

    if (!inboundMessages.length) {
      return res.status(200).json({ ok: true, received: 0 });
    }

    const db = readDB();
    const results = inboundMessages.map(inbound => createInboxItem(db, inbound));
    writeDB(db);

    return res.status(200).json({
      ok: true,
      received: results.filter(result => !result.duplicate).length,
      duplicates: results.filter(result => result.duplicate).length,
      inboxIds: results.map(result => result.item.id)
    });
  }
);

app.listen(PORT, () => {
  console.log(`GS ONE WhatsApp Inbound running at http://localhost:${PORT}`);
});
