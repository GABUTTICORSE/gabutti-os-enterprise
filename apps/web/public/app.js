let currentUser = null;
let state = {};
let currentCollection = null;


/* =========================================================
   UTILIDADES DEL INBOX
   ========================================================= */

function normalizeContact(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s()+\-]/g, '');
}

function findClientFromInbox(inbox) {
  const email = normalizeContact(inbox.email);
  const whatsapp = normalizeContact(inbox.whatsapp);

  return (state.clients || []).find(client => {
    const sameEmail =
      email &&
      normalizeContact(client.email) === email;

    const sameWhatsapp =
      whatsapp &&
      normalizeContact(client.whatsapp) === whatsapp;

    return sameEmail || sameWhatsapp;
  });
}

function fillForm(values = {}) {
  Object.entries(values).forEach(([name, value]) => {
    const field = recordForm.elements[name];

    if (field) {
      field.value = value ?? '';
    }
  });
}

function openQuoteFromInbox(inbox, client) {
  openForm('quotes');

  fillForm({
    clientName:
      client.name ||
      inbox.sender ||
      'Cliente',

    product:
      inbox.message ||
      '',

    description:
      `Necesidad recibida por ${inbox.source || 'Inbox'}: ` +
      `${inbox.message || ''}`,

    quantity: 1,
    unitPrice: 0,
    status: 'Borrador',

    owner:
      inbox.owner ||
      currentUser?.name ||
      'Andrea'
  });

  recordForm.dataset.clientId = client.id;
  recordForm.dataset.inboxId = inbox.id;
}

async function createClientFromInbox(inbox) {
  const clientData = {
    name:
      inbox.sender ||
      'Contacto sin nombre',

    rut: '',

    whatsapp:
      inbox.whatsapp ||
      '',

    email:
      inbox.email ||
      '',

    discipline: '',
    level: '',
    city: '',

    observations:
      `Cliente creado automáticamente desde Inbox ` +
      `${inbox.number || inbox.id}.`
  };

  const client = await api('/api/clients', {
    method: 'POST',
    body: JSON.stringify(clientData)
  });

  if (client.error) {
    throw new Error(client.error);
  }

  return client;
}

async function markInboxAsProcessed(inbox, client) {
  const updatedInbox = await api(
    `/api/inbox/${inbox.id}`,
    {
      method: 'PUT',

      body: JSON.stringify({
        status: 'Procesado',
        clientId: client.id,
        processedAt: new Date().toISOString(),

        processedBy:
          currentUser?.name ||
          'Andrea'
      })
    }
  );

  if (updatedInbox.error) {
    throw new Error(updatedInbox.error);
  }

  return updatedInbox;
}

async function processInbox(inboxId) {
  const inbox = (state.inbox || []).find(
    item => item.id === inboxId
  );

  if (!inbox) {
    alert('No se encontró la entrada del Inbox.');
    return;
  }

  if (inbox.status === 'Procesado') {
    alert('Esta entrada ya fue procesada.');
    return;
  }

  try {
    let client = findClientFromInbox(inbox);

    if (!client) {
      client = await createClientFromInbox(inbox);
    }

    await markInboxAsProcessed(inbox, client);
    await loadAll();

    const refreshedClient =
      (state.clients || []).find(
        item => item.id === client.id
      ) || client;

    openQuoteFromInbox(
      inbox,
      refreshedClient
    );

  } catch (error) {
    console.error(
      'Error procesando Inbox:',
      error
    );

    alert(
      error.message ||
      'No fue posible procesar la entrada del Inbox.'
    );
  }
}

async function replyWhatsApp(inboxId) {
  const inbox = (state.inbox || []).find(
    item => item.id === inboxId
  );

  if (!inbox) {
    alert('No se encontró la entrada del Inbox.');
    return;
  }

  if (!inbox.whatsapp) {
    alert('Esta entrada no tiene número de WhatsApp.');
    return;
  }

  const message = prompt(
    `Responder por WhatsApp a ${inbox.sender || inbox.whatsapp}:`
  );

  if (!message || !message.trim()) {
    return;
  }

  try {
    const result = await api(
      `/api/whatsapp-send/${inbox.id}`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: message.trim()
        })
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    alert('Mensaje enviado por WhatsApp correctamente.');

    await loadAll();

  } catch (error) {
    console.error(
      'Error enviando WhatsApp:',
      error
    );

    alert(
      error.message ||
      'No fue posible enviar el mensaje por WhatsApp.'
    );
  }
}
/* =========================================================
   ESQUEMAS DE FORMULARIOS
   ========================================================= */

const schemas = {
  clients: {
    title: 'Cliente',

    fields: [
      ['name', 'Nombre', 'text'],
      ['rut', 'RUT', 'text'],
      ['whatsapp', 'WhatsApp', 'text'],
      ['email', 'Mail', 'email'],

      [
        'discipline',
        'Disciplina',
        'select',
        [
          'Rally',
          'Karting',
          'Fórmula',
          'Track Day',
          'Drift',
          'Rally Cross',
          'Off Road',
          'Otra'
        ]
      ],

      [
        'level',
        'Nivel',
        'select',
        [
          'Principiante',
          'Amateur',
          'Avanzado',
          'Profesional'
        ]
      ],

      ['city', 'Ciudad', 'text']
    ]
  },

  inbox: {
    title: 'Entrada de Inbox',

    fields: [
      [
        'source',
        'Origen',
        'select',
        [
          'WhatsApp Business',
          'Instagram',
          'Facebook',
          'Gmail',
          'Teléfono',
          'Visita',
          'Referido',
          'Web'
        ]
      ],

      [
        'sender',
        'Nombre del remitente',
        'text'
      ],

      [
        'email',
        'Correo',
        'email'
      ],

      [
        'whatsapp',
        'WhatsApp',
        'text'
      ],

      [
        'message',
        'Mensaje / necesidad',
        'text'
      ],

      [
        'status',
        'Estado',
        'select',
        [
          'Nuevo',
          'Pendiente',
          'Procesado',
          'Descartado'
        ]
      ],

      [
        'owner',
        'Responsable',
        'text'
      ]
    ]
  },

  commercial_processes: {
    title: 'Proceso Comercial',

    fields: [
      [
        'clientName',
        'Cliente',
        'text'
      ],

      [
        'product',
        'Producto / necesidad',
        'text'
      ],

      [
        'status',
        'Estado',
        'select',
        [
          'Nuevo',
          'Diagnóstico',
          'Asesoría',
          'Cotización',
          'Negociación',
          'Venta Confirmada',
          'Esperando Pago',
          'Pagado',
          'Preparación',
          'Entregado',
          'Postventa',
          'Cerrado',
          'Perdido'
        ]
      ],

      [
        'value',
        'Valor estimado',
        'number'
      ],

      [
        'owner',
        'Responsable',
        'text'
      ],

      [
        'nextAction',
        'Próxima acción',
        'text'
      ],
      [
        'nextDate',
        'Fecha de seguimiento',
        'date'
      ]
    ]
  },

  quotes: {
    title: 'Cotización',

    fields: [
      [
        'clientName',
        'Cliente',
        'text'
      ],

      [
        'product',
        'Producto',
        'text'
      ],

      [
        'description',
        'Descripción',
        'text'
      ],

      [
        'quantity',
        'Cantidad',
        'number'
      ],

      [
        'unitPrice',
        'Precio unitario',
        'number'
      ],

      [
        'status',
        'Estado',
        'select',
        [
          'Borrador',
          'Enviada',
          'Aceptada',
          'Rechazada'
        ]
      ],

      [
        'owner',
        'Responsable',
        'text'
      ]
    ]
  },

  products: {
    title: 'Producto',

    fields: [
      ['sku', 'SKU', 'text'],
      ['name', 'Nombre', 'text'],
      ['brand', 'Marca', 'text'],
      ['model', 'Modelo', 'text'],
      ['category', 'Categoría', 'text'],
      ['homologation', 'Homologación', 'text'],
      ['material', 'Materialidad', 'text'],
      ['price', 'Precio', 'number']
    ]
  },

  stock: {
    title: 'Stock',

    fields: [
      ['product', 'Producto', 'text'],
      ['sku', 'SKU', 'text'],
      ['available', 'Disponible', 'number'],
      ['minimum', 'Mínimo', 'number'],
      ['location', 'Ubicación', 'text']
    ]
  },

  imports: {
    title: 'Importación',

    fields: [
      [
        'supplier',
        'Proveedor',
        'text'
      ],

      [
        'description',
        'Descripción',
        'text'
      ],

      [
        'status',
        'Estado',
        'select',
        [
          'Pedido proveedor',
          'Pago proveedor',
          'Pago Tuvia',
          'En tránsito',
          'En aduana',
          'Lista retiro',
          'Entregada',
          'Detenida'
        ]
      ],

      [
        'critical',
        'Crítica',
        'select',
        [
          'Sí',
          'No'
        ]
      ],

      [
        'eta',
        'ETA',
        'date'
      ]
    ]
  },

  tasks: {
    title: 'Tarea',

    fields: [
      ['title', 'Título', 'text'],
      ['type', 'Tipo', 'text'],
      ['owner', 'Responsable', 'text'],
      ['dueDate', 'Vencimiento', 'date'],

      [
        'status',
        'Estado',
        'select',
        [
          'Pendiente',
          'Hecha'
        ]
      ]
    ]
  },

  finance: {
    title: 'Movimiento financiero',

    fields: [
      ['concept', 'Concepto', 'text'],

      [
        'type',
        'Tipo',
        'select',
        [
          'Cobro',
          'Pago',
          'Venta',
          'Gasto'
        ]
      ],

      ['amount', 'Monto', 'number'],

      [
        'status',
        'Estado',
        'select',
        [
          'Pendiente',
          'Cobrado',
          'Pagado'
        ]
      ]
    ]
  }
};


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document
  .querySelectorAll('.nav')
  .forEach(button => {
    button.onclick = () => {
      document
        .querySelectorAll('.nav')
        .forEach(item => {
          item.classList.remove('active');
        });

      document
        .querySelectorAll('.view')
        .forEach(item => {
          item.classList.remove('active');
        });

      button.classList.add('active');

      const view = document.getElementById(
        button.dataset.view
      );

      if (view) {
        view.classList.add('active');
      }
    };
  });


/* =========================================================
   API
   ========================================================= */

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };


  const response = await fetch(
    path,
    {
  ...options,
  headers,
  credentials: 'same-origin'
}
  );

  let data;

  try {
    data = await response.json();

  } catch {
    data = {
      error:
        `Respuesta inválida del servidor ` +
        `(${response.status}).`
    };
  }

  if (
  response.status === 401 &&
  path !== '/api/login' &&
  path !== '/api/login/2fa' &&
  path !== '/api/me'
) {

    localStorage.removeItem(
      'gsone_user'
    );

    location.reload();
  }

  if (
    !response.ok &&
    !data.error
  ) {
    data.error =
      `Error del servidor ` +
      `(${response.status}).`;
  }

  return data;
}


/* =========================================================
   UTILIDADES VISUALES
   ========================================================= */

function money(value) {
  return (
    '$' +
    Number(value || 0)
      .toLocaleString('es-CL')
  );
}

function tag(text, className = '') {
  return `
    <span class="tag ${className}">
      ${text || '-'}
    </span>
  `;
}

function rec(
  title,
  meta = '',
  tags = ''
) {
  return `
    <div class="rec">
      <h3>${title}</h3>

      <div>
        ${tags}
      </div>

      <div class="meta">
        ${meta}
      </div>
    </div>
  `;
}


/* =========================================================
   LOGIN
   ========================================================= */

const clientProfile =
  document.getElementById(
    'clientProfile'
  );

const twoFactorForm =
  document.getElementById(
    'twoFactorForm'
  );

let twoFactorChallenge = null;

loginForm.onsubmit =
  async event => {
    event.preventDefault();

    const data =
      Object.fromEntries(
        new FormData(
          event.target
        ).entries()
      );

    const response =
      await api(
        '/api/login',
        {
          method: 'POST',
          body: JSON.stringify(data)
        }
      );

    if (response.requiresTwoFactor) {
      twoFactorChallenge =
        response.challenge;

      loginForm.classList.add(
        'hidden'
      );

      twoFactorForm.classList.remove(
        'hidden'
      );

      const codeInput =
        twoFactorForm.querySelector(
          'input[name="code"]'
        );

      if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
      }

      return;
    }

    if (!response.ok) {
      alert(
        response.error ||
        'Error'
      );

      return;
    }

    currentUser =
      response.user;

    localStorage.gsone_user =
      JSON.stringify(
        currentUser
      );

    showApp();
  };

twoFactorForm.onsubmit =
  async event => {
    event.preventDefault();

    if (!twoFactorChallenge) {
      alert(
        'El desafío de seguridad venció. Ingresa nuevamente.'
      );

      location.reload();
      return;
    }

    const formData =
      new FormData(event.target);

    const code =
      String(
        formData.get('code') || ''
      ).trim();

    const response =
      await api(
        '/api/login/2fa',
        {
          method: 'POST',
          body: JSON.stringify({
            challenge:
              twoFactorChallenge,
            code
          })
        }
      );

    if (!response.ok) {
      alert(
        response.error ||
        'Código de seguridad inválido'
      );

      return;
    }

    twoFactorChallenge = null;

    currentUser =
      response.user;

    localStorage.gsone_user =
      JSON.stringify(
        currentUser
      );

    showApp();
  };

function showApp() {
  loginView.classList.add(
    'hidden'
  );

  appView.classList.remove(
    'hidden'
  );

  userInfo.textContent =
    `${currentUser.name} · ` +
    `${currentUser.condition} · ` +
    `${currentUser.role}`;

  loadAll();
  loadIdentity();
}

async function logout() {
  await api(
    '/api/logout',
    {
      method: 'POST'
    }
  );

  localStorage.removeItem(
    'gsone_user'
  );

  location.reload();
}


/* =========================================================
   CARGA GENERAL
   ========================================================= */

async function loadAll() {
  state =
    await api('/api/db');

  await renderDashboard();

  renderLists();

  if (
    typeof renderCommercialProcesses ===
    'function'
  ) {
    renderCommercialProcesses();
  }

  if (
    typeof renderQuotes ===
    'function'
  ) {
    renderQuotes();
  }

  if (
    typeof renderSalesOrders ===
    'function'
  ) {
    renderSalesOrders();
  }

  if (
    typeof setupCatalogSelectors ===
    'function'
  ) {
    setupCatalogSelectors();
  }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function renderDashboardLegacy() {
  const dashboard =
    await api(
      '/api/dashboard'
    );

  if (
    dashboard.error ||
    !dashboard.kpis
  ) {
    console.error(
      'No se pudo cargar el dashboard:',
      dashboard.error
    );

    return;
  }

  kCases.textContent =
    dashboard.kpis.openProcesses;

  kTasks.textContent =
    dashboard.kpis.pendingTasks;

  kStock.textContent =
    dashboard.kpis.criticalStock;

  kImports.textContent =
    dashboard.kpis.activeImports;

  kReceivable.textContent =
    money(
      dashboard.kpis.receivable
    );

  kPayable.textContent =
    money(
      dashboard.kpis.payable
    );

  health.textContent =
    dashboard.health + '%';

  if (
    typeof executiveBriefing !==
    'undefined'
  ) {
    executiveBriefing.innerHTML =
      `Buenos días, ${currentUser.name}. ` +
      `Hoy tienes ` +
      `${dashboard.kpis.openProcesses} ` +
      `procesos abiertos, ` +
      `${dashboard.kpis.pendingTasks} ` +
      `tareas pendientes, ` +
      `${dashboard.kpis.criticalStock} ` +
      `productos con stock crítico y ` +
      `${money(
        dashboard.kpis.receivable
      )} por cobrar.`;
  }

  const prioritiesData =
    dashboard.priorities ||
    [];

  priorities.innerHTML =
    prioritiesData.length

      ? prioritiesData
          .map(priority => `
            <div
              class="priority ${priority.priority}"
            >
              <h3>
                ${priority.title}
              </h3>

              <p class="meta">
                ${priority.module}
                ·
                ${priority.detail}
              </p>

              ${tag(
                priority.priority,

                priority.priority ===
                'Alta'
                  ? 'red'
                  : 'yellow'
              )}
            </div>
          `)
          .join('')

      : '<p class="meta">Sin prioridades.</p>';
}


/* =========================================================
   LISTADOS
   ========================================================= */

function renderLists() {
  const inboxData =
    state.inbox ||
    [];

  const clientsData =
    state.clients ||
    [];

  const processesData =
    state.commercial_processes ||
    [];

  const quotesData =
    state.quotes ||
    [];

  const productsData =
    state.products ||
    [];

  const stockData =
    state.stock ||
    [];

  const importsData =
    state.imports ||
    [];

  const tasksData =
    state.tasks ||
    [];

  const financeData =
    state.finance ||
    [];

  const activityData =
    state.activity ||
    [];


  /* -------------------------
     INBOX
     ------------------------- */

  inboxList.innerHTML =
    inboxData
      .map(inbox => {
        const processed =
          inbox.status ===
          'Procesado';

        let statusColor =
          'blue';

        if (
          inbox.status ===
          'Nuevo'
        ) {
          statusColor =
            'yellow';
        }

        if (
          inbox.status ===
          'Pendiente'
        ) {
          statusColor =
            'blue';
        }

        if (processed) {
          statusColor =
            'green';
        }

        if (
          inbox.status ===
          'Descartado'
        ) {
          statusColor =
            'red';
        }

        return `
          <div class="rec">
            <h3>
              ${inbox.sender || 'Entrada'}
              —
              ${inbox.source || '-'}
            </h3>

            <div>
              ${tag(
                inbox.status || 'Nuevo',
                statusColor
              )}
            </div>

            <div class="meta">
              ${inbox.message || '-'}
              ·
              ${
                inbox.email ||
                inbox.whatsapp ||
                'Sin contacto'
              }
              ·
              ${inbox.owner || '-'}
            </div>

            <div
              style="margin-top:12px"
            >
              <button
                type="button"
                class="secondary compact"
                onclick="processInbox('${inbox.id}')"
                ${
                  processed
                    ? 'disabled'
                    : ''
                }
              >
                ${
                  processed
                    ? 'Procesado'
                    : 'Procesar'
                }
              </button>              

               ${
                String(inbox.source || '').includes('WhatsApp') &&
                inbox.whatsapp
                  ? `
                    <button
                      type="button"
                      class="secondary compact"
                      onclick="replyWhatsApp('${inbox.id}')"
                      style="margin-left:8px"
                    >
                      Responder por WhatsApp
                    </button>
                  `
                  : ''
              }

            </div>
          </div>
        `;
      })
      .join('') ||

    '<p class="meta">Sin entradas.</p>';


  /* -------------------------
     CLIENTES
     ------------------------- */

  clientsList.innerHTML =
    clientsData
      .map(client => `
        <div
          class="client-row client-row-with-action"
          onclick="showClientProfile('${client.id}')"
        >
          <div
            class="client-mini-avatar"
          >
            ${
              (
                client.name ||
                'C'
              )
                .charAt(0)
                .toUpperCase()
            }
          </div>

          <div
            class="client-row-main"
          >
            <div
              class="client-number"
            >
              ${
                client.number ||
                'CLI-PENDIENTE'
              }
            </div>

            <strong>
              ${
                client.name ||
                'Cliente'
              }
            </strong>

            <div class="meta">
              ${
                client.dispatch?.city ||
                client.city ||
                '-'
              }
              ·
              ${
                client.discipline ||
                '-'
              }
            </div>
          </div>

          <button
            type="button"
            class="secondary compact"
            onclick="
              event.stopPropagation();
              showClientProfile('${client.id}');
            "
          >
            Ver ficha
          </button>
        </div>
      `)
      .join('') ||

    '<p class="meta">Sin clientes. El próximo será CLI-000001.</p>';


  /* -------------------------
     COTIZACIONES
     ------------------------- */

  quotesList.innerHTML =
    quotesData
      .map(quote =>
        rec(
          `${
            quote.clientName ||
            'Cliente'
          } — ${
            quote.product ||
            'Producto'
          }`,

          `${
            quote.status ||
            '-'
          } · ${
            money(
              Number(
                quote.quantity ||
                0
              ) *
              Number(
                quote.unitPrice ||
                0
              )
            )
          } · ${
            quote.owner ||
            '-'
          }`,

          tag(
            quote.status ||
            'Borrador',

            quote.status ===
            'Aceptada'
              ? 'green'
              : 'yellow'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin cotizaciones.</p>';


  /* -------------------------
     PRODUCTOS
     ------------------------- */

  productsList.innerHTML =
    productsData
      .map(product =>
        rec(
          `${
            product.name ||
            'Producto'
          } ${
            product.model ||
            ''
          }`,

          `SKU ${
            product.sku ||
            '-'
          } · ${
            product.brand ||
            '-'
          } · ${
            product.homologation ||
            '-'
          } · ${
            money(
              product.price
            )
          }`,

          tag(
            product.category,
            'blue'
          ) +

          tag(
            product.material,
            'green'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin productos.</p>';


  /* -------------------------
     STOCK
     ------------------------- */

  stockList.innerHTML =
    stockData
      .map(stockItem => {
        const critical =
          Number(
            stockItem.available ||
            0
          ) <=

          Number(
            stockItem.minimum ||
            0
          );

        return rec(
          stockItem.product ||
          'Producto',

          `SKU ${
            stockItem.sku ||
            '-'
          } · Disponible ${
            stockItem.available ||
            0
          } · Mínimo ${
            stockItem.minimum ||
            0
          } · ${
            stockItem.location ||
            '-'
          }`,

          tag(
            critical
              ? 'Crítico'
              : 'OK',

            critical
              ? 'red'
              : 'green'
          )
        );
      })
      .join('') ||

    '<p class="meta">Sin stock.</p>';


  /* -------------------------
     IMPORTACIONES
     ------------------------- */

  importsList.innerHTML =
    importsData
      .map(importItem =>
        rec(
          `${
            importItem.supplier ||
            'Proveedor'
          } — ${
            importItem.description ||
            'Importación'
          }`,

          `${
            importItem.status ||
            '-'
          } · ETA ${
            importItem.eta ||
            '-'
          }`,

          tag(
            importItem.critical ===
            'Sí'
              ? 'Crítica'
              : 'Normal',

            importItem.critical ===
            'Sí'
              ? 'red'
              : 'green'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin importaciones.</p>';


  /* -------------------------
     TAREAS
     ------------------------- */

  tasksList.innerHTML =
    tasksData
      .map(task =>
        rec(
          task.title ||
          'Tarea',

          `${
            task.type ||
            '-'
          } · ${
            task.owner ||
            '-'
          } · ${
            task.dueDate ||
            '-'
          }`,

          tag(
            task.status ||
            'Pendiente',

            task.status ===
            'Hecha'
              ? 'green'
              : 'yellow'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin tareas.</p>';


  /* -------------------------
     FINANZAS
     ------------------------- */

  financeList.innerHTML =
    financeData
      .map(movement =>
        rec(
          movement.concept ||
          'Movimiento',

          `${
            movement.type ||
            '-'
          } · ${
            money(
              movement.amount
            )
          } · ${
            movement.status ||
            '-'
          }`,

          tag(
            movement.status,

            movement.status ===
            'Pendiente'
              ? 'yellow'
              : 'green'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin movimientos.</p>';


  /* -------------------------
     ACTIVIDAD
     ------------------------- */

  activityList.innerHTML =
    activityData
      .map(activity =>
        rec(
          `${
            activity.action ||
            '-'
          } · ${
            activity.entity ||
            '-'
          }`,

          `${
            activity.detail ||
            '-'
          } · ${
            activity.at ||
            ''
          }`,

          tag(
            'log',
            'blue'
          )
        )
      )
      .join('') ||

    '<p class="meta">Sin actividad.</p>';
}


/* =========================================================
   PROCESO COMERCIAL
   ========================================================= */

/* =========================================================
   DEMO Y EXPORTACIÓN
   ========================================================= */

async function exportDB() {
  const database =
    await api('/api/db');

  const blob =
    new Blob(
      [
        JSON.stringify(
          database,
          null,
          2
        )
      ],

      {
        type:
          'application/json'
      }
    );

  const link =
    document.createElement(
      'a'
    );

  link.href =
    URL.createObjectURL(
      blob
    );

  link.download =
    'gabutti_os_enterprise_export.json';

  link.click();

  URL.revokeObjectURL(
    link.href
  );
}


/* =========================================================
   IDENTIDAD
   ========================================================= */

async function loadIdentity() {
  const element =
    document.getElementById(
      'identityContent'
    );

  if (!element) {
    return;
  }

  const data =
    await api(
      '/api/identity'
    );

  if (data.error) {
    element.innerHTML =
      `<p class="meta">` +
      `${data.error}` +
      `</p>`;

    return;
  }

  const people =
    data.people ||
    [];

  const roles =
    data.roles ||
    [];

  const accessLog =
    data.accessLog ||
    [];

  element.innerHTML = `
    <div class="identity-grid">
      <div class="identity-card">
        <span>
          Organización
        </span>

        <strong>
          ${
            data.organization ||
            '-'
          }
        </strong>

        <small>
          Founder Company de GS ONE
        </small>
      </div>

      <div class="identity-card">
        <span>
          Personas activas
        </span>

        <strong>
          ${people.length}
        </strong>

        <small>
          Identidades habilitadas
        </small>
      </div>

      <div class="identity-card">
        <span>
          Roles
        </span>

        <strong>
          ${roles.length}
        </strong>

        <small>
          Modelo de permisos vigente
        </small>
      </div>
    </div>

    <h3>
      Seguridad de acceso
    </h3>

    <div class="identity-card">
      <span>
        Autenticación en dos pasos
      </span>

      <strong>
        ${
          data.twoFactor?.enabled
            ? 'ACTIVADA'
            : 'DESACTIVADA'
        }
      </strong>

      <small>
        ${
          data.twoFactor?.enabled
            ? 'Tu cuenta requiere contraseña y código de seguridad.'
            : 'Protege tu cuenta con Authenticator y códigos de recuperación.'
        }
      </small>

      ${
        data.twoFactor?.enabled
          ? `
              ${tag('2FA activo', 'green')}

              <button
                type="button"
                onclick="regenerateRecoveryCodes()"
              >
                Regenerar códigos de recuperación
              </button>
            `
          : `<button
               type="button"
               onclick="startTwoFactorSetup()"
             >
               Activar autenticación en dos pasos
             </button>`
      }
    </div>

    <h3>
      Personas
    </h3>

    <div class="list">
      ${
        people.length

          ? people
              .map(person =>
                rec(
                  person.name,

                  `${
                    person.email ||
                    '-'
                  } · ${
                    person.organization ||
                    '-'
                  }${
                    person.legacyTitle
                      ? ` · ${person.legacyTitle}`
                      : ''
                  }`,

                  tag(
                    person.condition,
                    'blue'
                  ) +

                  tag(
                    person.role,
                    'green'
                  )
                )
              )
              .join('')

          : '<p class="meta">Sin personas registradas.</p>'
      }
    </div>

    <h3>
      Accesos recientes
    </h3>

    <div class="list">
      ${
        accessLog.length

          ? accessLog
              .map(access =>
                rec(
                  access.action ===
                  'login'
                    ? 'Ingreso correcto'
                    : 'Intento fallido',

                  `${
                    access.detail ||
                    '-'
                  } · ${
                    access.at
                      ? new Date(
                          access.at
                        )
                          .toLocaleString(
                            'es-CL'
                          )
                      : '-'
                  }`,

                  tag(
                    access.action ===
                    'login'
                      ? 'Autorizado'
                      : 'Rechazado',

                    access.action ===
                    'login'
                      ? 'green'
                      : 'red'
                  )
                )
              )
              .join('')

          : '<p class="meta">Sin accesos registrados.</p>'
      }
    </div>
  `;
}


async function startTwoFactorSetup() {
  const password =
    prompt(
      'Confirma tu contraseña de GS ONE:'
    );

  if (!password) {
    return;
  }

  const setup =
    await api(
      '/api/2fa-setup',
      {
        method: 'POST',
        body: JSON.stringify({
          password
        })
      }
    );

  if (!setup.ok) {
    alert(
      setup.error ||
      'No fue posible iniciar 2FA'
    );

    return;
  }

  const message =
    'CONFIGURACIÓN AUTHENTICATOR\n\n' +
    '1. Abre Google Authenticator o Microsoft Authenticator.\n' +
    '2. Agrega una cuenta manualmente.\n' +
    '3. Nombre: GS ONE\n' +
    '4. Clave secreta:\n\n' +
    setup.secret +
    '\n\n' +
    'Luego ingresa el código de 6 dígitos que genere la aplicación.';

  alert(message);

  const code =
    prompt(
      'Código de 6 dígitos de Authenticator:'
    );

  if (!code) {
    return;
  }

  const enabled =
    await api(
      '/api/2fa-enable',
      {
        method: 'POST',
        body: JSON.stringify({
          setupToken:
            setup.setupToken,
          code:
            String(code).trim()
        })
      }
    );

  if (!enabled.ok) {
    alert(
      enabled.error ||
      'No fue posible activar 2FA'
    );

    return;
  }

  const recoveryCodes =
    enabled.recoveryCodes || [];

  alert(
    '2FA ACTIVADO CORRECTAMENTE.\n\n' +
    'GUARDA ESTOS CÓDIGOS DE RECUPERACIÓN EN UN LUGAR SEGURO.\n' +
    'CADA CÓDIGO FUNCIONA UNA SOLA VEZ:\n\n' +
    recoveryCodes.join('\n')
  );

  await loadIdentity();
}



async function regenerateRecoveryCodes() {
  const password =
    prompt(
      'Confirma tu contraseña de GS ONE:'
    );

  if (!password) {
    return;
  }

  const code =
    prompt(
      'Ingresa el código actual de 6 dígitos de Authenticator:'
    );

  if (!code) {
    return;
  }

  const response =
    await api(
      '/api/2fa-recovery-regenerate',
      {
        method: 'POST',
        body: JSON.stringify({
          password,
          code: String(code).trim()
        })
      }
    );

  if (!response.ok) {
    alert(
      response.error ||
      'No fue posible regenerar los códigos de recuperación'
    );

    return;
  }

  const recoveryCodes =
    response.recoveryCodes || [];

  alert(
    'NUEVOS CÓDIGOS DE RECUPERACIÓN\n\n' +
    'Los códigos anteriores quedaron invalidados.\n\n' +
    'GUARDA ESTOS CÓDIGOS EN UN LUGAR SEGURO.\n' +
    'CADA CÓDIGO FUNCIONA UNA SOLA VEZ:\n\n' +
    recoveryCodes.join('\n')
  );
}


/* =========================================================
   RESTAURAR SESIÓN
   ========================================================= */
(async () => {
  try {
    const response =
      await api('/api/me');

    if (response.user) {
      currentUser =
        response.user;

      localStorage.gsone_user =
        JSON.stringify(
          currentUser
        );

      showApp();
    }

  } catch (error) {
    console.error(
      'No fue posible restaurar la sesión:',
      error
    );
  }
})();

