const TIME_ZONE = 'America/Santiago';

const SEARCHES = [
  {
    query: '"Formula 1" OR F1 when:1d',
    category: 'F1',
    type: 'sport'
  },
  {
    query: '"World Rally Championship" OR WRC OR "Rally Chile" OR "Rally Biobio" when:1d',
    category: 'Rally / WRC',
    type: 'sport'
  },
  {
    query: '"World Endurance Championship" OR WEC OR IMSA OR IndyCar when:1d',
    category: 'Circuito',
    type: 'sport'
  },
  {
    query: 'Dakar OR "rally raid" when:1d',
    category: 'Dakar',
    type: 'sport'
  },
  {
    query: 'FIA motorsport when:1d',
    category: 'FIA',
    type: 'sport'
  },

  { query: '"OMP Racing" when:1d', category: 'OMP', type: 'brand' },
  { query: '"Bell Racing" motorsport when:1d', category: 'Bell', type: 'brand' },
  { query: '"Stilo" motorsport helmet when:1d', category: 'Stilo', type: 'brand' },
  { query: '"EvoCorse" motorsport when:1d', category: 'EvoCorse', type: 'brand' },
  { query: '"ORECA" motorsport when:1d', category: 'Oreca', type: 'brand' },
  { query: '"Endless" brakes motorsport when:1d', category: 'Endless', type: 'brand' },
  { query: '"Lifeline" motorsport fire when:1d', category: 'Lifeline', type: 'brand' },
  { query: '"Fastime" motorsport when:1d', category: 'Fastime', type: 'brand' }
];

const CATEGORY_LIMITS = {
  'F1': 3,
  'Rally / WRC': 3,
  'Circuito': 2,
  'Dakar': 2,
  'FIA': 2,
  'OMP': 1,
  'Bell': 1,
  'Stilo': 1,
  'EvoCorse': 1,
  'Oreca': 1,
  'Endless': 1,
  'Lifeline': 1,
  'Fastime': 1
};


function cleanNewsUrl(value = '') {
  const raw = String(value || '').trim();

  const markdownMatch = raw.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/
  );

  if (markdownMatch) {
    return markdownMatch[2];
  }

  const urlMatch = raw.match(
    /https?:\/\/[^\s)\]]+/
  );

  return urlMatch ? urlMatch[0] : raw;
}

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function tag(block, name) {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
  );

  return match ? decodeXml(match[1]).trim() : '';
}

function chileDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const get = type =>
    parts.find(part => part.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isToday(value) {
  return chileDayKey(value) === chileDayKey(new Date());
}

function matchesCategory(item) {
  const text = `${item.title} ${item.source}`.toLowerCase();

  switch (item.category) {
    case 'F1':
      return /\bf1\b|formula 1|fórmula 1/.test(text);

    case 'Rally / WRC':
      return /\bwrc\b|world rally championship|rally chile|rally biob[ií]o|\brally\b/.test(text);

    case 'Circuito':
      return /\bwec\b|world endurance championship|\bimsa\b|indycar|endurance/.test(text);

    case 'Dakar':
      return /dakar|rally raid|rally-raid/.test(text);

    case 'FIA':
      return /\bfia\b|fédération internationale|federacion internacional|federación internacional/.test(text);

    default:
      return true;
  }
}

function isImportantBrandNews(item) {
  const text = `${item.title} ${item.source}`.toLowerCase();

  const brand =
    item.category.toLowerCase();

  if (!text.includes(brand)) {
    return false;
  }

  return /new|nuevo|nueva|launch|lanz|homolog|fia|partnership|partner|acuerdo|supplier|proveedor|victory|win|champion|record|technology|innovation|producto|helmet|racewear|brake|racing/.test(text);
}

function parseFeed(xml, meta) {
  const blocks =
    String(xml).match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks
    .map(block => {
      const source = tag(block, 'source');
      let title = tag(block, 'title');

      if (source && title.endsWith(` - ${source}`)) {
        title = title
          .slice(0, -(source.length + 3))
          .trim();
      }

      return {
        title,
        url: cleanNewsUrl(tag(block, 'link')),
        source,
        publishedAt: tag(block, 'pubDate'),
        category: meta.category,
        type: meta.type
      };
    })
    .filter(item =>
      item.title &&
      item.url &&
      item.publishedAt &&
      isToday(item.publishedAt)
    )
    .filter(matchesCategory)
    .filter(item =>
      item.type !== 'brand' ||
      isImportantBrandNews(item)
    );
}

async function loadSearch(meta) {
  const q = encodeURIComponent(meta.query);

  const url =
    `https://news.google.com/rss/search?q=${q}` +
    '&hl=es-419&gl=CL&ceid=CL:es-419';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GS-ONE-Motorsport-Live/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`RSS HTTP ${response.status}`);
  }

  return parseFeed(
    await response.text(),
    meta
  );
}

async function getTodayMotorsportNews(limit = 18) {
  const responses =
    await Promise.allSettled(
      SEARCHES.map(loadSearch)
    );

  const allNews = responses
    .filter(result =>
      result.status === 'fulfilled'
    )
    .flatMap(result => result.value)
    .sort((a, b) =>
      Date.parse(b.publishedAt) -
      Date.parse(a.publishedAt)
    );

  const seen = new Set();
  const counts = {};
  const selected = [];

  for (const item of allNews) {
    const key = item.title
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (seen.has(key)) {
      continue;
    }

    const categoryLimit =
      CATEGORY_LIMITS[item.category] || 1;

    const used =
      counts[item.category] || 0;

    if (used >= categoryLimit) {
      continue;
    }

    seen.add(key);
    counts[item.category] = used + 1;
    selected.push(item);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

module.exports = {
  getTodayMotorsportNews
};
