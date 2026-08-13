const assert = require('assert');

const {
  classifyInboxMessage
} = require('../inbox_classifier');

const cases = [
  {
    message: 'Hola, necesito cotizar un casco Bell HP10 talla L.',
    expected: {
      intent: 'quote_request',
      brand: 'Bell',
      category: 'Casco',
      product: 'HP10',
      size: 'L'
    }
  },
  {
    message: 'Hola, necesito cotizar uncaco Bell HP10 talla L urgente.',
    expected: {
      intent: 'quote_request',
      brand: 'Bell',
      category: 'Casco',
      product: 'HP10',
      size: 'L',
      priority: 'Alta'
    }
  },
  {
    message: 'Quiero comprar 2 llantas EvoCorse X3MA.',
    expected: {
      intent: 'purchase_request',
      brand: 'EvoCorse',
      category: 'Llanta',
      product: 'X3MA',
      quantity: 2
    }
  },
  {
    message: '¿Tienen stock de pastillas Endless para rally?',
    expected: {
      intent: 'stock_request',
      brand: 'Endless',
      category: 'Frenos'
    }
  },
  {
    message: 'Necesito saber si este arnés OMP tiene homologación FIA.',
    expected: {
      intent: 'technical_question',
      brand: 'OMP',
      category: 'Arnés'
    }
  }
];

for (const testCase of cases) {
  const result = classifyInboxMessage({
    message: testCase.message,
    sender: 'Cliente prueba',
    source: 'WhatsApp Business'
  });

  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    assert.strictEqual(
      result[key],
      expectedValue,
      `${testCase.message}: ${key} debía ser ${expectedValue}, pero fue ${result[key]}`
    );
  }

  console.log('✓', testCase.message);
  console.log(result);
}

console.log('\nClasificador de Inbox: pruebas correctas.');
