const BRAND_RULES = [
  { name: 'OMP', patterns: [/\bomp\b/i] },
  { name: 'Bell', patterns: [/\bbell\b/i] },
  { name: 'Stilo', patterns: [/\bstilo\b/i] },
  { name: 'EvoCorse', patterns: [/\bevocorse\b/i, /\bevo corse\b/i] },
  { name: 'Oreca', patterns: [/\boreca\b/i] },
  { name: 'Endless', patterns: [/\bendless\b/i] },
  { name: 'Lifeline', patterns: [/\blifeline\b/i] },
  { name: 'Fastime', patterns: [/\bfastime\b/i] }
];

const CATEGORY_RULES = [
  {
    name: 'Casco',
    patterns: [
      /\b(?:un)?ca(?:s)?co\b/i,
      /\bhelmet\b/i
    ]
  },
  {
    name: 'Butaca',
    patterns: [
      /\bbutaca\b/i,
      /\basiento\b/i,
      /\bseat\b/i
    ]
  },
  {
    name: 'Arnés',
    patterns: [
      /\barn[eé]s\b/i,
      /\bcintur[oó]n\b/i,
      /\bharness\b/i
    ]
  },
  {
    name: 'Volante',
    patterns: [
      /\bvolante\b/i,
      /\bsteering wheel\b/i
    ]
  },
  {
    name: 'Llanta',
    patterns: [
      /\bllanta\b/i,
      /\bllantas\b/i,
      /\bwheel\b/i,
      /\bwheels\b/i
    ]
  },
  {
    name: 'Frenos',
    patterns: [
      /\bpastilla(?:s)?\b/i,
      /\bfreno(?:s)?\b/i,
      /\bbrake(?:s)?\b/i
    ]
  },
  {
    name: 'Extinción',
    patterns: [
      /\bextintor\b/i,
      /\bextinci[oó]n\b/i,
      /\bfire suppression\b/i
    ]
  },
  {
    name: 'Cronometraje',
    patterns: [
      /\bcron[oó]metro\b/i,
      /\btimer\b/i,
      /\bstopwatch\b/i
    ]
  }
];

const INTENT_RULES = [
  {
    name: 'quote_request',
    label: 'Solicitud de cotización',
    patterns: [
      /\bcotiz/i,
      /\bprecio\b/i,
      /\bcu[aá]nto cuesta\b/i,
      /\bvalor\b/i,
      /\bpresupuesto\b/i
    ]
  },
  {
    name: 'purchase_request',
    label: 'Solicitud de compra',
    patterns: [
      /\bquiero comprar\b/i,
      /\bnecesito comprar\b/i,
      /\bcomprar\b/i,
      /\bpedido\b/i,
      /\bencargar\b/i
    ]
  },
  {
    name: 'stock_request',
    label: 'Consulta de stock',
    patterns: [
      /\btienen stock\b/i,
      /\bhay stock\b/i,
      /\bdisponible\b/i,
      /\bdisponibilidad\b/i
    ]
  },
  {
    name: 'technical_question',
    label: 'Consulta técnica',
    patterns: [
      /\bsirve para\b/i,
      /\bcompatible\b/i,
      /\brecomiend/i,
      /\bhomologaci[oó]n\b/i,
      /\bfia\b/i
    ]
  },
  {
    name: 'after_sales',
    label: 'Postventa',
    patterns: [
      /\bgarant[ií]a\b/i,
      /\bcambio\b/i,
      /\bdevoluci[oó]n\b/i,
      /\bfalla\b/i,
      /\bproblema con\b/i
    ]
  }
];

function firstMatch(rules, text){
  for(const rule of rules){
    if(rule.patterns.some(pattern => pattern.test(text))){
      return rule;
    }
  }

  return null;
}

function detectSize(text){
  const patterns = [
    /\btalla\s*(xxl|xl|xs|xxs|s|m|l)\b/i,
    /\bsize\s*(xxl|xl|xs|xxs|s|m|l)\b/i
  ];

  for(const pattern of patterns){
    const match = text.match(pattern);

    if(match){
      return match[1].toUpperCase();
    }
  }

  return '';
}

function detectQuantity(text){
  const patterns = [
    /\b(\d+)\s*(?:unidad|unidades|casco|cascos|butaca|butacas|arn[eé]s|llanta|llantas)\b/i,
    /\bcantidad\s*[:\-]?\s*(\d+)\b/i
  ];

  for(const pattern of patterns){
    const match = text.match(pattern);

    if(match){
      return Number(match[1]);
    }
  }

  return 1;
}

function detectProduct(text, brand, category){
  let cleaned = text
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if(brand){
    cleaned = cleaned.replace(
      new RegExp(`\\b${brand.replace(/\s+/g, '\\s*')}\\b`, 'i'),
      ''
    );
  }

  if(category){
    const categoryWords = {
      Casco: /\bcasco\b/i,
      Butaca: /\bbutaca\b/i,
      Arnés: /\barn[eé]s\b/i,
      Volante: /\bvolante\b/i,
      Llanta: /\bllanta(?:s)?\b/i,
      Frenos: /\bpastilla(?:s)?|freno(?:s)?\b/i,
      Extinción: /\bextintor|extinci[oó]n\b/i,
      Cronometraje: /\bcron[oó]metro\b/i
    };

    const pattern = categoryWords[category];

    if(pattern){
      cleaned = cleaned.replace(pattern, '');
    }
  }

  const modelMatch = cleaned.match(
    /\b[A-Z]{1,5}[- ]?\d{1,5}[A-Z0-9-]*\b/i
  );

  return modelMatch ? modelMatch[0].toUpperCase() : '';
}

function calculateConfidence(result){
  let points = 0;

  if(result.intent !== 'other') points += 0.35;
  if(result.brand) points += 0.20;
  if(result.category) points += 0.15;
  if(result.product) points += 0.20;
  if(result.size) points += 0.10;

  return Math.min(Number(points.toFixed(2)), 1);
}

function classifyInboxMessage(input = {}){
  const message = String(input.message || '').trim();
  const sender = String(input.sender || '').trim();
  const source = String(input.source || '').trim();

  const brandRule = firstMatch(BRAND_RULES, message);
  const categoryRule = firstMatch(CATEGORY_RULES, message);
  const intentRule = firstMatch(INTENT_RULES, message);

  const result = {
    intent: intentRule?.name || 'other',
    intentLabel: intentRule?.label || 'Otro',
    brand: brandRule?.name || '',
    category: categoryRule?.name || '',
    product: '',
    size: detectSize(message),
    quantity: detectQuantity(message),
    priority: 'Normal',
    sender,
    source,
    originalMessage: message,
    confidence: 0
  };

  result.product = detectProduct(
    message,
    result.brand,
    result.category
  );

  if(
    /\burgente\b/i.test(message) ||
    /\bhoy\b/i.test(message) ||
    /\blo antes posible\b/i.test(message)
  ){
    result.priority = 'Alta';
  }

  result.confidence = calculateConfidence(result);

  return result;
}

module.exports = {
  classifyInboxMessage
};
