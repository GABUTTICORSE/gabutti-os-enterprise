const crypto = require('crypto');

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyWebhookChallenge(query = {}, verifyToken = '') {
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');

  return {
    ok: mode === 'subscribe' && !!verifyToken && safeEqual(token, verifyToken),
    challenge
  };
}

function verifyMetaSignature(rawBody, signatureHeader = '', appSecret = '') {
  if (!appSecret) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(signatureHeader, expected);
}

function messageText(message = {}) {
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'button') return String(message.button?.text || '').trim();
  if (message.type === 'interactive') {
    return String(
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      ''
    ).trim();
  }
  if (message.type) return `[${message.type}]`;
  return '';
}

function extractInboundMessages(payload = {}) {
  const result = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWaId = new Map(
        contacts.map(contact => [
          String(contact.wa_id || ''),
          String(contact.profile?.name || '').trim()
        ])
      );
      const messages = Array.isArray(value.messages) ? value.messages : [];

      for (const message of messages) {
        const whatsapp = String(message.from || '').trim();
        result.push({
          providerMessageId: String(message.id || '').trim(),
          whatsapp,
          sender: contactByWaId.get(whatsapp) || `WhatsApp ${whatsapp}`,
          message: messageText(message),
          messageType: String(message.type || 'unknown'),
          source: 'WhatsApp Business',
          provider: 'Meta Cloud API',
          phoneNumberId: String(value.metadata?.phone_number_id || ''),
          displayPhoneNumber: String(value.metadata?.display_phone_number || ''),
          providerTimestamp: message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : '',
          rawContextId: String(message.context?.id || '')
        });
      }
    }
  }

  return result;
}

module.exports = {
  extractInboundMessages,
  messageText,
  verifyMetaSignature,
  verifyWebhookChallenge
};
