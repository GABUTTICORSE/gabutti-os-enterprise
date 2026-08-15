const assert = require('assert');
const crypto = require('crypto');
const {
  extractInboundMessages,
  verifyMetaSignature,
  verifyWebhookChallenge
} = require('../integrations/whatsapp/whatsapp.webhook');

const verification = verifyWebhookChallenge(
  {
    'hub.mode': 'subscribe',
    'hub.verify_token': 'gs-one-test',
    'hub.challenge': '12345'
  },
  'gs-one-test'
);
assert.equal(verification.ok, true);
assert.equal(verification.challenge, '12345');

const raw = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
const secret = 'secret-test';
const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
assert.equal(verifyMetaSignature(raw, signature, secret), true);
assert.equal(verifyMetaSignature(raw, 'sha256=bad', secret), false);

const payload = {
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        metadata: {
          display_phone_number: '56900000000',
          phone_number_id: '123456'
        },
        contacts: [{
          profile: { name: 'Cliente Prueba' },
          wa_id: '56911111111'
        }],
        messages: [{
          from: '56911111111',
          id: 'wamid.test',
          timestamp: '1760000000',
          type: 'text',
          text: { body: 'Hola, necesito cotizar un casco Bell talla M' }
        }]
      }
    }]
  }]
};

const messages = extractInboundMessages(payload);
assert.equal(messages.length, 1);
assert.equal(messages[0].providerMessageId, 'wamid.test');
assert.equal(messages[0].sender, 'Cliente Prueba');
assert.equal(messages[0].whatsapp, '56911111111');
assert.equal(messages[0].message, 'Hola, necesito cotizar un casco Bell talla M');
assert.equal(messages[0].source, 'WhatsApp Business');

console.log('whatsapp_webhook.test.js OK');
