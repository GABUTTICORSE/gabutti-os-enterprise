function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

async function sendTextMessage({
  accessToken,
  phoneNumberId,
  to,
  text,
  apiVersion = 'v25.0'
}) {
  const token = String(accessToken || '').trim();
  const senderId = String(phoneNumberId || '').trim();
  const recipient = normalizePhone(to);
  const body = String(text || '').trim();

  if (!token) {
    throw new Error('Falta WhatsApp access token.');
  }

  if (!senderId) {
    throw new Error('Falta WhatsApp phone number ID.');
  }

  if (!recipient) {
    throw new Error('Falta número WhatsApp destinatario.');
  }

  if (!body) {
    throw new Error('El mensaje no puede estar vacío.');
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${senderId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `WhatsApp Cloud API respondió HTTP ${response.status}.`;

    const error = new Error(message);
    error.status = response.status;
    error.response = data;
    throw error;
  }

  return {
    ok: true,
    recipient,
    messageId: data?.messages?.[0]?.id || '',
    response: data
  };
}

module.exports = {
  normalizePhone,
  sendTextMessage
};
