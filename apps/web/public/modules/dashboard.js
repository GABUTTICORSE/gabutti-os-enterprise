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
        second: '2-digit'
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

function renderDashboardPriorities(
  critical,
  attention
) {
  const priorities =
    dashboardElement('priorities');

  if (!priorities) {
    return;
  }

  priorities.innerHTML = `
    <div class="exec-priority-group critical">
      <div class="exec-priority-title">
        <span>● Crítico</span>
        <span>${critical.length}</span>
      </div>

      ${renderPriorityItems(
        critical,
        'No existen alertas críticas'
      )}
    </div>

    <div class="exec-priority-group attention">
      <div class="exec-priority-title">
        <span>● Atención</span>
        <span>${attention.length}</span>
      </div>

      ${renderPriorityItems(
        attention,
        'No existen asuntos importantes pendientes'
      )}
    </div>

    <div class="exec-priority-group operational">
      <div class="exec-priority-title">
        <span>● Operativo</span>

        <span>
          ${critical.length === 0
            ? 'Todo OK'
            : 'Revisar'}
        </span>
      </div>

      <div class="exec-priority-item">
        <span>
          Sistema ejecutándose correctamente
        </span>

        <span>GS ONE</span>
      </div>

      <div class="exec-priority-item">
        <span>
          Información obtenida desde registros reales
        </span>

        <span>Actualizado</span>
      </div>
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
    dashboardNumber(
      current.temperature_2m
    )
  );

  const apparentTemperature = Math.round(
    dashboardNumber(
      current.apparent_temperature
    )
  );

  dashboardSetText(
    'weatherTemperature',
    `${temperature}°C · ` +
    `${weatherDescription(
      current.weather_code
    )} · ` +
    `Sensación ${apparentTemperature}°C`
  );
}

function updateDashboardLocation() {
  dashboardSetText(
    'weatherLocation',
    'Detectando ubicación...'
  );

  dashboardSetText(
    'weatherTemperature',
    'Consultando clima local...'
  );

  if (!navigator.geolocation) {
    dashboardSetText(
      'weatherLocation',
      'Ubicación no disponible'
    );

    dashboardSetText(
      'weatherTemperature',
      'Geolocalización no disponible'
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(
    async position => {
      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      dashboardSetText(
        'weatherLocation',
        'Ubicación actual'
      );

      try {
        await loadWeather(
          latitude,
          longitude
        );

      } catch (error) {
        console.error(
          'Error consultando clima:',
          error
        );

        dashboardSetText(
          'weatherTemperature',
          'Clima temporalmente no disponible'
        );
      }
    },

    error => {
      console.warn(
        'Ubicación no autorizada:',
        error
      );

      dashboardSetText(
        'weatherLocation',
        'Ubicación no autorizada'
      );

      dashboardSetText(
        'weatherTemperature',
        'Autoriza la ubicación en el navegador'
      );
    },

    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000
    }
  );
}

/* =========================================================
   MOTORSPORT LIVE
   ========================================================= */

function startMotorsportTicker() {
  const ticker =
    dashboardElement('motorsportTicker');

  if (!ticker) {
    return;
  }

  const news = [
    'GS ONE conectado al ecosistema motorsport',
    'FIA · Reglamentos y homologaciones',
    'WRC · Noticias y resultados internacionales',
    'Rally nacional · Calendarios y novedades',
    'OMP · Bell · Stilo · EvoCorse',
    'Oreca · Endless · Lifeline · Fastime',
    'Dakar · WEC · IMSA · Fórmula 1'
  ];

  ticker.innerHTML = news
    .map(item => `
      <span>${dashboardEscape(item)}</span>
    `)
    .join('');
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
      item => item.priority === 'Alta'
    );

  const attention =
    prioritiesData.filter(
      item => item.priority !== 'Alta'
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
    attention
  );

  startDashboardClock();
  updateDashboardLocation();
  startMotorsportTicker();
}
