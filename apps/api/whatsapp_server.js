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

  const automationResult = runCreationAutomations(
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

  return {
    item,
    duplicate: false,
    automationResult
  };
}

function simulatorHtml() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GS ONE · WhatsApp Simulator</title>
<style>
  :root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  *{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#f4f5f7;min-height:100vh;display:grid;place-items:center;padding:28px}
  .shell{width:min(980px,100%);display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{background:#15181d;border:1px solid #2a2f36;border-radius:18px;padding:22px;box-shadow:0 18px 45px rgba(0,0,0,.28)}
  h1,h2{margin:0 0 8px}.eyebrow{font-size:12px;letter-spacing:.14em;color:#9ba3ad;text-transform:uppercase}.meta{color:#9ba3ad;line-height:1.5;margin-top:8px}
  label{display:block;font-size:13px;color:#c5cad1;margin:14px 0 6px}input,textarea{width:100%;border:1px solid #343b45;border-radius:10px;background:#0f1115;color:#fff;padding:11px 12px;font:inherit}textarea{min-height:150px;resize:vertical}
  button{margin-top:16px;width:100%;border:0;border-radius:10px;padding:12px 14px;font-weight:700;cursor:pointer;background:#fff;color:#111}.examples{display:grid;gap:8px;margin-top:14px}.examples button{margin:0;background:#232831;color:#f4f5f7;text-align:left;font-weight:500}
  pre{white-space:pre-wrap;word-break:break-word;background:#0f1115;border:1px solid #2b3139;border-radius:12px;padding:14px;min-height:330px;color:#dce2e8}.status{font-size:13px;color:#9ba3ad;margin-top:10px}.ok{color:#74d99f}.error{color:#ff8c8c}
  @media(max-width:760px){.shell{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
  <section class="card">
    <div class="eyebrow">GS ONE · WhatsApp Inbound v1</div>
    <h1>Simulador de mensaje</h1>
    <p class="meta">Este formulario entra por el mismo motor de Inbox que usará Meta. No envía ningún WhatsApp real.</p>
    <label>Nombre del contacto</label>
    <input id="sender" value="Cliente Prueba">
    <label>WhatsApp</label>
    <input id="phone" value="56911111111">
    <label>Mensaje</label>
    <textarea id="message">Hola, necesito cotizar un casco Bell talla M</textarea>
    <button id="send">Procesar en GS ONE</button>
    <div id="status" class="status">Listo para simular.</div>
    <div class="examples">
      <button data-message="Hola, necesito cotizar un casco Bell talla M">Cotización · Casco Bell talla M</button>
      <button data-message="Tienen stock de llantas EvoCorse?">Stock · Llantas EvoCorse</button>
      <button data-message="Este arnés OMP sirve para homologación FIA?">Consulta técnica · Arnés OMP</button>
      <button data-message="Tengo un problema con un producto que compré, necesito garantía">Postventa · Garantía</button>
    </div>
  </section>
  <section class="card">
    <div class="eyebrow">Resultado del motor</div>
    <h2>Conversión automática</h2>
    <p class="meta">Verás el Inbox creado, la interpretación, el cliente asociado, la tarea y el proceso comercial.</p>
    <pre id="result">Aún no se ha procesado un mensaje.</pre>
  </section>
</div>
<script>
const sender=document.getElementById('sender');
const phone=document.getElementById('phone');
const message=document.getElementById('message');
const result=document.getElementById('result');
const status=document.getElementById('status');
document.querySelectorAll('[data-message]').forEach(button=>button.addEventListener('click',()=>{message.value=button.dataset.message;}));
document.getElementById('send').addEventListener('click',async()=>{
  status.className='status';status.textContent='Procesando...';result.textContent='Procesando mensaje en GS ONE...';
  try{
    const response=await fetch('/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender:sender.value,whatsapp:phone.value,message:message.value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'No fue posible procesar el mensaje.');
    status.className='status ok';status.textContent='Mensaje procesado correctamente.';
    result.textContent=JSON.stringify(data,null,2);
  }catch(error){status.className='status error';status.textContent=error.message;result.textContent=error.stack||error.message;}
});
</script>
</body>
</html>`;
}

const app = express();

app.get('/health', (_req, res) => {
  const config = readConfig();
  res.json({
    ok: true,
    service: 'GS ONE WhatsApp Inbound',
    configured: !!config.verifyToken && !!config.appSecret,
    simulator: '/simulator'
  });
});

app.get('/simulator', (_req, res) => {
  res.type('html').send(simulatorHtml());
});

app.post('/simulate', express.json({ limit: '64kb' }), (req, res) => {
  const sender = String(req.body?.sender || '').trim();
  const whatsapp = String(req.body?.whatsapp || '').replace(/\D/g, '');
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const db = readDB();
  const inbound = {
    providerMessageId: 'sim_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    whatsapp,
    sender: sender || (whatsapp ? `WhatsApp ${whatsapp}` : 'Cliente Simulado'),
    message,
    messageType: 'text',
    source: 'WhatsApp Business · Simulador',
    provider: 'GS ONE Simulator',
    phoneNumberId: 'simulator',
    displayPhoneNumber: 'SIMULADOR',
    providerTimestamp: new Date().toISOString(),
    rawContextId: ''
  };

  const result = createInboxItem(db, inbound);
  writeDB(db);

  const item = result.item;
  const analysis = (db.inbox_analysis || []).find(entry => entry.id === item.analysisId || entry.inboxId === item.id) || null;
  const client = (db.clients || []).find(entry => entry.id === item.clientId) || null;
  const task = (db.tasks || []).find(entry => entry.id === item.taskId || entry.inboxId === item.id) || null;
  const commercialProcess = (db.commercial_processes || []).find(entry => entry.id === item.processId || entry.inboxId === item.id) || null;

  return res.status(201).json({
    ok: true,
    simulated: true,
    inbox: item,
    analysis,
    client,
    task,
    commercialProcess
  });
});

app.get('/webhooks/whatsapp', (req, res) => {
  const { verifyToken } = readConfig();
  const verification = verifyWebhookChallenge(req.query, verifyToken);

  console.log('[WA WEBHOOK] GET verification', {
    ok: verification.ok,
    mode: req.query['hub.mode'] || '',
    hasChallenge: !!req.query['hub.challenge']
  });

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

    console.log('[WA WEBHOOK] POST received', {
      bytes: rawBody.length,
      hasSignature: !!signature,
      contentType: req.get('content-type') || '',
      userAgent: req.get('user-agent') || ''
    });

    const signatureOk = verifyMetaSignature(rawBody, signature, config.appSecret);
    console.log('[WA WEBHOOK] signature', { ok: signatureOk });

    if (!signatureOk) {
      return res.status(401).json({ error: 'Firma de Meta inválida.' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      console.log('[WA WEBHOOK] invalid JSON');
      return res.status(400).json({ error: 'Payload JSON inválido.' });
    }

    const inboundMessages = extractInboundMessages(payload);
    console.log('[WA WEBHOOK] parsed', {
      object: payload.object || '',
      entries: Array.isArray(payload.entry) ? payload.entry.length : 0,
      inboundMessages: inboundMessages.length
    });

    if (!inboundMessages.length) {
      return res.status(200).json({ ok: true, received: 0 });
    }

    const db = readDB();
    const results = inboundMessages.map(inbound => createInboxItem(db, inbound));
    writeDB(db);

    console.log('[WA WEBHOOK] stored', {
      received: results.filter(result => !result.duplicate).length,
      duplicates: results.filter(result => result.duplicate).length,
      inboxIds: results.map(result => result.item.id)
    });

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
  console.log(`Simulador disponible en http://localhost:${PORT}/simulator`);
});
