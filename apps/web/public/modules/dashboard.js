/* =========================================================
   GS ONE — DASHBOARD V3
   Controlador único del Centro de Operaciones
   ========================================================= */

function dashboardElement(id) {
  return document.getElementById(id);
}

function dashboardArray(value) {
  return Array.isArray(value) ? value : [];
}

function dashboardNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dashboardSetText(id, value) {
  const element = dashboardElement(id);

  if (element) {
    element.textContent = value;
  }
}

function dashboardEscape(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

/* =========================================================
   PERFIL EJECUTIVO
   ========================================================= */

function setupDashboardProfile() {
  const photo = dashboardElement('dashboardProfilePhoto');
  const fallback = dashboardElement('dashboardProfileFallback');

  if (!photo) {
    return;
  }

  const showPhoto = () => {
    photo.classList.remove('photo-unavailable');

    if (fallback) {
      fallback.setAttribute('aria-hidden', 'true');
    }
  };

  const showFallback = () => {
    photo.classList.add('photo-unavailable');

    if (fallback) {
      fallback.removeAttribute('aria-hidden');
    }
  };

  photo.addEventListener('load', showPhoto, { once: true });
  photo.addEventListener('error', showFallback, { once: true });

  if (photo.complete) {
    if (photo.naturalWidth > 0) {
      showPhoto();
    } else {
      showFallback();
    }
  }
}

/* =========================================================
   RELOJ, FECHA Y SALUDO
   ========================================================= */

function dashboardGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Buenos días';
  }

  if (hour < 20) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}

function startDashboardClock() {
  const updateClock = () => {
    const now = new Date();

    dashboardSetText(
      'dashboardTime',
      now.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    );

    dashboardSetText(
      'dashboardDay',
      now.toLocaleDateString('es-CL', {
        weekday: 'long'
      })
    );

    dashboardSetText(
      'dashboardDate',
      now.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    );

    const chronoHand =
      dashboardElement('dashboardChronoHand');

    const minuteHand =
      dashboardElement('dashboardMinuteHand');

    const hourHand =
      dashboardElement('dashboardHourHand');

    const seconds = now.getSeconds();
    const minutes =
      now.getMinutes() + seconds / 60;

    const hours =
      (now.getHours() % 12) + minutes / 60;

    if (chronoHand) {
      chronoHand.style.transform =
        `translateX(-50%) rotate(${seconds * 6}deg)`;
    }

    if (minuteHand) {
      minuteHand.style.transform =
        `translateX(-50%) rotate(${minutes * 6}deg)`;
    }

    if (hourHand) {
      hourHand.style.transform =
        `translateX(-50%) rotate(${hours * 30}deg)`;
    }

    dashboardSetText(
      'gtDigitalClock',
      now.toLocaleTimeString('es-CL', {
        hour12: false
      })
    );

    dashboardSetText(
      'dashboardGreeting',
      dashboardGreeting()
    );
  };

  updateClock();

  if (!window.__gsOneDashboardClock) {
    window.__gsOneDashboardClock =
      setInterval(updateClock, 1000);
  }
}

/* =========================================================
   PRIORIDADES
   ========================================================= */

function renderPriorityItems(items, emptyMessage) {
  if (!items.length) {
    return `
      <div class="exec-priority-item">
        <span>${dashboardEscape(emptyMessage)}</span>
        <span>0</span>
      </div>
    `;
  }

  return items
    .slice(0, 6)
    .map(item => `
      <div class="exec-priority-item">
        <span>
          ${dashboardEscape(
            item.title || 'Pendiente sin título'
          )}
        </span>

        <span>
          ${dashboardEscape(
            item.module || 'Sistema'
          )}
        </span>
      </div>
    `)
    .join('');
}

function openDashboardPriority(item){

  if(!item || !item.targetView){
    return;
  }

  activateView(item.targetView);

  if(
    item.targetType === 'commercial_process' &&
    item.targetId &&
    typeof showCommercialProcess === 'function'
  ){
    showCommercialProcess(item.targetId);
    return;
  }

  if(
    item.targetType === 'task' &&
    item.targetId &&
    typeof openForm === 'function'
  ){
    openForm('tasks', item.targetId);
    return;
  }

  if(
    item.targetType === 'stock' &&
    item.targetId &&
    typeof openForm === 'function'
  ){
    openForm('stock', item.targetId);
    return;
  }

  if(
    item.targetType === 'import' &&
    item.targetId &&
    typeof openForm === 'function'
  ){
    openForm('imports', item.targetId);
  }
}


function renderSemaphoreColumn(
  title,
  level,
  items,
  emptyMessage
){

  const rows = items
    .slice(0, 8)
    .map(item => {

      const payload =
        encodeURIComponent(
          JSON.stringify({
            targetView:item.targetView || '',
            targetType:item.targetType || '',
            targetId:item.targetId || ''
          })
        );

      return `
        <button
          type="button"
          class="semaphore-card ${level}"
          onclick="openDashboardPriority(JSON.parse(decodeURIComponent('${payload}')))"
        >
          <span class="semaphore-card-dot"></span>

          <span class="semaphore-card-body">
            <strong>
              ${dashboardEscape(
                item.title ||
                'Pendiente sin título'
              )}
            </strong>

            <small>
              ${dashboardEscape(
                item.semaphoreLabel ||
                item.module ||
                ''
              )}
            </small>

            <em>
              ${dashboardEscape(
                item.detail || ''
              )}
            </em>
          </span>
        </button>
      `;
    })
    .join('');

  return `
    <section class="semaphore-column ${level}">
      <div class="semaphore-column-head">
        <span class="semaphore-column-light"></span>

        <div>
          <small>${title}</small>
          <strong>${items.length}</strong>
        </div>
      </div>

      <div class="semaphore-column-list">
        ${
          rows ||
          `<div class="semaphore-empty">${emptyMessage}</div>`
        }
      </div>
    </section>
  `;
}


function renderDashboardPriorities(
  critical,
  attention,
  okItems = []
) {

  const container =
    dashboardElement('operationalSemaphore');

  const status =
    dashboardElement('semaphoreStatus');

  const summary =
    dashboardElement('semaphoreSummary');

  const detail =
    dashboardElement('semaphoreDetail');

  const items =
    dashboardElement('semaphoreItems');

  if (
    !container ||
    !status ||
    !summary ||
    !detail ||
    !items
  ) {
    return;
  }

  container.classList.remove(
    'is-ok',
    'is-attention',
    'is-critical'
  );

  if(critical.length > 0){
    container.classList.add('is-critical');
  } else if(attention.length > 0){
    container.classList.add('is-attention');
  } else {
    container.classList.add('is-ok');
  }

  status.textContent = 'CONTROL OPERACIONAL';

  summary.textContent = '';
  detail.textContent = '';

  items.innerHTML = `
    <div class="semaphore-board">

      ${renderSemaphoreColumn(
        'URGENTE',
        'critical',
        critical,
        'Sin urgencias'
      )}

      ${renderSemaphoreColumn(
        'ATENCIÓN',
        'attention',
        attention,
        'Sin asuntos próximos'
      )}

      ${renderSemaphoreColumn(
        'AL DÍA',
        'ok',
        okItems,
        'Sin registros al día'
      )}

    </div>
  `;
}

/* =========================================================
   CLIMA
   ========================================================= */

function weatherDescription(code) {
  const descriptions = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Neblina',
    48: 'Neblina con escarcha',
    51: 'Llovizna débil',
    53: 'Llovizna',
    55: 'Llovizna intensa',
    61: 'Lluvia débil',
    63: 'Lluvia',
    65: 'Lluvia intensa',
    71: 'Nieve débil',
    73: 'Nieve',
    75: 'Nieve intensa',
    80: 'Chubascos débiles',
    81: 'Chubascos',
    82: 'Chubascos intensos',
    95: 'Tormenta',
    96: 'Tormenta con granizo',
    99: 'Tormenta intensa'
  };

  return descriptions[code] ||
    'Condición meteorológica';
}
function weatherIcon(code) {
  if (code === 0) return '☀';
  if ([1, 2].includes(code)) return '◐';
  if ([3, 45, 48].includes(code)) return '☁';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '☂';
  if ([71, 73, 75].includes(code)) return '❄';
  if ([95, 96, 99].includes(code)) return 'ϟ';
  return '●';
}

async function resolveLocationName(
  latitude,
  longitude
) {
  try {
    const url =
      'https://api.bigdatacloud.net/data/reverse-geocode-client' +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      '&localityLanguage=es';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Reverse geocode no disponible');
    }

    const data = await response.json();

    const city =
      data.city ||
      data.locality ||
      data.localityInfo?.administrative?.[3]?.name ||
      data.principalSubdivision ||
      'Zona local';

    const region =
      data.principalSubdivision ||
      data.countryName ||
      '';

    dashboardSetText(
      'weatherLocation',
      String(city).toUpperCase()
    );

    dashboardSetText(
      'weatherRegion',
      region
        ? `${region} · Chile`
        : 'CLIMA LOCAL'
    );

  } catch (error) {
    console.warn(
      'No fue posible resolver ciudad:',
      error
    );

    dashboardSetText(
      'weatherLocation',
      'ZONA LOCAL'
    );

    dashboardSetText(
      'weatherRegion',
      'CLIMA LOCAL'
    );
  }
}

async function loadWeather(
  latitude,
  longitude
) {
  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    '&current=' +
    'temperature_2m,' +
    'apparent_temperature,' +
    'relative_humidity_2m,' +
    'wind_speed_10m,' +
    'weather_code' +
    '&timezone=auto';

  const response = await fetch(weatherUrl);

  if (!response.ok) {
    throw new Error(
      'No fue posible consultar el clima.'
    );
  }

  const data = await response.json();
  const current = data.current || {};

  const temperature = Math.round(
    dashboardNumber(current.temperature_2m)
  );

  const apparent = Math.round(
    dashboardNumber(current.apparent_temperature)
  );

  const humidity = Math.round(
    dashboardNumber(current.relative_humidity_2m)
  );

  const wind = Math.round(
    dashboardNumber(current.wind_speed_10m)
  );

  const description =
    weatherDescription(current.weather_code);

  dashboardSetText(
    'weatherTempMain',
    `${temperature}°C`
  );

  dashboardSetText(
    'weatherTemperature',
    `${description} · Sensación ${apparent}°C`
  );

  dashboardSetText(
    'weatherWind',
    `${wind} km/h`
  );

  dashboardSetText(
    'weatherHumidity',
    `${humidity}%`
  );

  dashboardSetText(
    'weatherIcon',
    weatherIcon(current.weather_code)
  );
}

function updateDashboardLocation() {
  dashboardSetText(
    'weatherLocation',
    'DETECTANDO...'
  );

  dashboardSetText(
    'weatherTemperature',
    'Consultando clima local...'
  );

  if (!navigator.geolocation) {
    dashboardSetText(
      'weatherLocation',
      'UBICACIÓN NO DISPONIBLE'
    );
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      await Promise.allSettled([
        resolveLocationName(
          latitude,
          longitude
        ),
        loadWeather(
          latitude,
          longitude
        )
      ]);
    },

    error => {
      console.warn(
        'Ubicación no autorizada:',
        error
      );

      dashboardSetText(
        'weatherLocation',
        'UBICACIÓN NO AUTORIZADA'
      );

      dashboardSetText(
        'weatherTemperature',
        'Autoriza ubicación en el navegador'
      );
    },

    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

/* =========================================================
   MOTORSPORT LIVE
   ========================================================= */


function dashboardNewsUrl(value = '') {
  const raw = String(value || '').trim();

  // Formato contaminado: [https://...](https://...)
  const markdown = raw.match(
    /^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/
  );

  if (markdown) {
    return markdown[1];
  }

  // URL normal
  const direct = raw.match(/https?:\/\/[^\s\])]+/);

  return direct ? direct[0] : '';
}

async function startMotorsportTicker() {

  const ticker =
    dashboardElement('motorsportTicker');

  if (!ticker) {
    return;
  }

  try {

    const response =
      await api('/api/motorsport/news');

    const news =
      Array.isArray(response.items)
        ? response.items
        : [];

    if (!news.length) {
      ticker.innerHTML = `
        <a href="#" onclick="return false;">
          MOTORSPORT LIVE · Sin novedades publicadas hoy
        </a>
      `;
      return;
    }

    const items = news.map(item => ({
      url: String(item.url || '')
        .replace(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/, '$1'),
      text: [
        item.category,
        item.title,
        item.source
      ]
        .filter(Boolean)
        .join(' · '),
      title: [
        item.source,
        item.category
      ]
        .filter(Boolean)
        .join(' · ')
    }));

    let index = 0;

    const renderItem = () => {
      const item = items[index];

      ticker.innerHTML = `
        <a
          class="motorsport-vertical-item"
          href="${dashboardEscape(item.url)}"
          target="_blank"
          rel="noopener noreferrer"
          title="${dashboardEscape(item.title)}"
        >
          ${dashboardEscape(item.text)}
        </a>
      `;

      index = (index + 1) % items.length;
    };

    renderItem();

    if (window.__gsOneMotorsportRotate) {
      clearInterval(window.__gsOneMotorsportRotate);
    }

    window.__gsOneMotorsportRotate =
      setInterval(
        renderItem,
        5000
      );

  } catch (error) {

    console.error(
      'Motorsport LIVE:',
      error
    );

    ticker.innerHTML = `
      <a href="#" onclick="return false;">
        MOTORSPORT LIVE · No fue posible actualizar las noticias
      </a>
    `;
  }

  if (!window.__gsOneMotorsportRefresh) {

    window.__gsOneMotorsportRefresh =
      setInterval(
        startMotorsportTicker,
        15 * 60 * 1000
      );
  }
}

/* =========================================================
   DASHBOARD PRINCIPAL
   ========================================================= */

async function renderDashboard() {
  setupDashboardProfile();

  const data =
    await api('/api/dashboard');

  if (
    data.error ||
    !data.kpis
  ) {
    console.error(
      'No se pudo cargar el dashboard:',
      data.error
    );

    dashboardSetText(
      'executiveBriefing',
      'No fue posible cargar el resumen operacional.'
    );

    startDashboardClock();

    return;
  }

  const kpis =
    data.kpis || {};

  const prioritiesData =
    dashboardArray(data.priorities);

  const critical =
    prioritiesData.filter(
      item => item.semaphoreLevel === 'red'
    );

  const attention =
    prioritiesData.filter(
      item => item.semaphoreLevel === 'yellow'
    );

  const okItems =
    prioritiesData.filter(
      item => item.semaphoreLevel === 'green'
    );

  const orders =
    dashboardArray(state.sales_orders);

  const quotes =
    dashboardArray(state.quotes);

  const clients =
    dashboardArray(state.clients);

  const ordersNoStock =
    orders.filter(order =>
      order.status ===
        'Esperando abastecimiento' ||
      order.status ===
        'Pendiente'
    );

  const ordersToInvoice =
    orders.filter(order =>
      order.status ===
        'Stock reservado'
    );

  const ordersToDispatch =
    orders.filter(order =>
      order.status ===
        'Facturado'
    );

  const totalOrderValue =
    orders.reduce(
      (total, order) =>
        total +
        dashboardNumber(order.total),
      0
    );

  const userName =
    typeof currentUser !== 'undefined' &&
    currentUser &&
    currentUser.name
      ? currentUser.name
      : 'Andrea';

  dashboardSetText(
    'dashboardGreeting',
    dashboardGreeting()
  );

  dashboardSetText(
    'dashboardUser',
    userName
  );

  dashboardSetText(
    'dashboardProfileName',
    userName
  );

  dashboardSetText(
    'kCases',
    dashboardNumber(
      kpis.openProcesses
    )
  );

  dashboardSetText(
    'kTasks',
    dashboardNumber(
      kpis.pendingTasks
    )
  );

  dashboardSetText(
    'kStock',
    dashboardNumber(
      kpis.criticalStock
    )
  );

  dashboardSetText(
    'kImports',
    dashboardNumber(
      kpis.activeImports
    )
  );

  dashboardSetText(
    'kReceivable',
    money(
      dashboardNumber(
        kpis.receivable
      )
    )
  );

  dashboardSetText(
    'kPayable',
    money(
      dashboardNumber(
        kpis.payable
      )
    )
  );

  dashboardSetText(
    'criticalCount',
    critical.length
  );

  dashboardSetText(
    'attentionCount',
    attention.length
  );

  dashboardSetText(
    'operationalStatus',
    critical.length > 0
      ? 'Revisar'
      : 'Operativo'
  );

  dashboardSetText(
    'executiveBriefing',
    `Actualmente existen ` +
    `${critical.length} alertas críticas, ` +
    `${attention.length} asuntos importantes, ` +
    `${dashboardNumber(
      kpis.pendingTasks
    )} tareas pendientes y ` +
    `${money(
      dashboardNumber(
        kpis.receivable
      )
    )} registrados por cobrar.`
  );

  dashboardSetText(
    'dashboardOrderValue',
    money(totalOrderValue)
  );

  dashboardSetText(
    'dashboardOrders',
    orders.length
  );

  dashboardSetText(
    'dashboardQuotes',
    quotes.length
  );

  dashboardSetText(
    'dashboardClients',
    clients.length
  );

  dashboardSetText(
    'ordersPending',
    ordersNoStock.length
  );

  dashboardSetText(
    'ordersInvoice',
    ordersToInvoice.length
  );

  dashboardSetText(
    'ordersDispatch',
    ordersToDispatch.length
  );

  renderDashboardPriorities(
    critical,
    attention,
    okItems
  );

  startDashboardClock();
  updateDashboardLocation();
  startMotorsportTicker();
}
