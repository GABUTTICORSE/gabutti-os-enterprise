function processStatusColor(status){
  if(['Sin stock','Esperando abastecimiento','Pago vencido','Atrasado'].includes(status)){
    return 'red';
  }

  if(['Nuevo','Esperando Pago','Cotización enviada','Venta Confirmada','Pendiente'].includes(status)){
    return 'yellow';
  }

  if(['Stock reservado','Facturado','Pagado','Listo para despacho','Despachado'].includes(status)){
    return 'green';
  }

  if(['Cerrado','Finalizado'].includes(status)){
    return 'blue';
  }

  return 'yellow';
}

function processCard(p){
  const color = processStatusColor(p.status || '');

  return `
    <div class="process-card" onclick="showCommercialProcess('${p.id}')">
      <div>
        <h3>${p.number || p.id} · ${p.product || 'Proceso comercial'}</h3>
        <p class="meta">${p.clientName || '-'} · ${p.owner || '-'}</p>
      </div>

      <div class="process-right">
        ${tag(p.status || '-', color)}
        <strong>${money(p.value)}</strong>
      </div>
    </div>
  `;
}
function renderCommercialProcesses(){
  casesList.innerHTML = (state.commercial_processes || [])
    .map(p => processCard(p))
    .join('') || '<p class="meta">Sin procesos comerciales.</p>';
}
function showCommercialProcess(id){

  const process = state.commercial_processes.find(p => p.id === id);
  if(!process) return;

  const relatedTasks = (state.tasks || []).filter(t =>
    (t.title || '').toLowerCase().includes((process.clientName || '').toLowerCase())
  );

  const timeline = (state.history || [])
    .filter(h => h.processId === process.id)
    .sort((a,b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

  const profile = document.getElementById('commercialProfile');
  if(!profile) return;

  profile.innerHTML = `
    <h2>${process.clientName}</h2>
    <p class="meta">${process.product}</p>

    <div class="profile-grid">
      <div class="profile-box">
        <b>Estado</b><br>
        ${tag(process.status, process.status === 'Esperando Pago' ? 'red' : 'yellow')}
      </div>

      <div class="profile-box">
        <b>Valor</b><br>
        ${money(process.value)}
      </div>

      <div class="profile-box">
        <b>Responsable</b><br>
        ${process.owner || '-'}
      </div>

      <div class="profile-box">
        <b>Próxima fecha</b><br>
        ${process.nextDate || '-'}
      </div>
    </div>

    <div class="quick-actions">
      <button onclick="createQuoteFromProcess('${process.id}')">📄 Generar cotización</button>
      <button>💰 Registrar pago</button>
      <button>📦 Reservar stock</button>
      <button>🚚 Programar despacho</button>
    </div>

    <h3 style="margin-top:25px">Tareas relacionadas</h3>

    ${
      relatedTasks.length
      ? relatedTasks.map(t => `
        <div class="rec">
          <h3>${t.title}</h3>
          <div class="meta">${t.status} · ${t.owner}</div>
        </div>
      `).join('')
      : '<p class="meta">No existen tareas relacionadas.</p>'
    }

    <h3 style="margin-top:25px">Timeline del proceso</h3>

    ${
      timeline.length
      ? timeline.map(h => `
        <div class="timeline-item">
          <strong>${h.type || 'Evento'}</strong>
          <h3>${h.title || '-'}</h3>
          <div class="meta">${h.description || '-'}</div>
          <div class="meta">${h.createdAt ? new Date(h.createdAt).toLocaleString('es-CL') : '-'}</div>
        </div>
      `).join('')
      : '<p class="meta">Sin historial todavía.</p>'
    }
  `;
}

async function createQuoteFromProcess(id){

  const process = state.commercial_processes.find(p => p.id === id);
  if(!process) return;

  const existingQuote = (state.quotes || []).find(q =>
    q.processId === process.id &&
    q.status !== 'Rechazada'
  );

  if(existingQuote){
    alert('Este proceso ya tiene una cotización activa.');

    await loadAll();
    activateView('quotes');
    showQuote(existingQuote.id);

    return;
  }

  const quote = await api('/api/quotes',{
    method:'POST',
    body:JSON.stringify({
      clientId:process.clientId,
      clientName:process.clientName,
      product:process.product,
      description:'Cotización generada desde proceso comercial',
      quantity:1,
      unitPrice:process.value,
      status:'Borrador',
      owner:process.owner,
      processId:process.id
    })
  });

  await loadAll();

  activateView('quotes');

  if(quote?.id){
    showQuote(quote.id);
  }

}
function quoteCardClass(status){

  const classes = {
    'Borrador': 'quote-card-gray',
    'Enviada': 'quote-card-blue',
    'Esperando respuesta': 'quote-card-orange',
    'Sin respuesta': 'quote-card-black',
    'Aceptada': 'quote-card-green',
    'Rechazada': 'quote-card-red'
  };

  return classes[status] || 'quote-card-gray';
}
function quoteStatusColor(status){

  switch(status){

    case 'Borrador':
      return 'gray';

    case 'Enviada':
      return 'blue';

    case 'Esperando respuesta':
      return 'yellow';

    case 'Sin respuesta':
      return 'black';

    case 'Aceptada':
      return 'green';

    case 'Rechazada':
      return 'red';

    default:
      return 'gray';

  }

}
function quotePriority(status){

  const priorities = {
    'Sin respuesta': 1,
    'Esperando respuesta': 2,
    'Enviada': 3,
    'Borrador': 4,
    'Aceptada': 5,
    'Rechazada': 6
  };

  return priorities[status] || 99;
}
function renderQuotes(){

  const list = document.getElementById('quotesList');
  if(!list) return;

 const orderedQuotes = [...(state.quotes || [])].sort((a, b) => {

  const priorityDifference =
    quotePriority(a.status) - quotePriority(b.status);

  if(priorityDifference !== 0){
    return priorityDifference;
  }

  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
});

list.innerHTML = orderedQuotes.map(q => `
   <div
  class="process-card ${quoteCardClass(q.status)}"
  onclick="console.log('CLICK COTIZACIÓN','${q.id}'); showQuote('${q.id}')"
>

      <div>
        <h3>${q.number || q.id} · ${q.clientName || 'Cliente'}</h3>
        <p class="meta">${q.product}</p>
      </div>

      <div class="process-right">
        ${tag(
  q.status || 'Borrador',
  quoteStatusColor(q.status)
)}
        <strong>${money((q.quantity || 1) * (q.unitPrice || 0))}</strong>
      </div>

    </div>
  `).join('') || '<p class="meta">Sin cotizaciones.</p>';

}

function showQuote(id){

  const quote = (state.quotes || []).find(q => q.id === id);
  if(!quote) return;

  const profile = document.getElementById('quoteProfile');
  if(!profile) return;

  const quoteItems = (state.quote_items || []).filter(
    item => item.quoteId === quote.id
  );

  const netTotal = quoteItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);

    const subtotal = quantity * unitPrice;
    const lineTotal =
      subtotal - (subtotal * discount / 100);

    return sum + lineTotal;
  }, 0);

  const iva = netTotal * 0.19;
  const grandTotal = netTotal + iva;

  profile.innerHTML = `
    <h2>${quote.clientName || 'Cliente'}</h2>

    <p class="meta">
      ${quote.number || quote.id} · ${quote.status || 'Borrador'}
    </p>

    <div class="profile-grid">
      <div class="profile-box">
        <b>Estado</b><br>
        ${tag(quote.status || 'Borrador', 'blue')}
      </div>

      <div class="profile-box">
        <b>Productos</b><br>
        ${quoteItems.length}
      </div>

      <div class="profile-box">
        <b>Responsable</b><br>
        ${quote.owner || '-'}
      </div>

      <div class="profile-box">
        <b>Total cotización</b><br>
        ${money(grandTotal)}
      </div>
    </div>

    <h3 style="margin-top:25px">Productos</h3>

    <div class="quick-actions">
      <button onclick="openQuoteItemForm('${quote.id}')">
        ➕ Agregar producto
      </button>
    </div>

    ${
      quoteItems.length
        ? `
          <div class="quote-items-table">

            <div class="quote-item quote-item-header">
              <div>SKU</div>
              <div>Producto</div>
              <div>Cantidad</div>
              <div>Precio</div>
              <div>Descuento</div>
              <div>Total</div>
              <div>Acciones</div>
            </div>

            ${quoteItems.map(item => {
              const quantity = Number(item.quantity || 0);
              const unitPrice = Number(item.unitPrice || 0);
              const discount = Number(item.discount || 0);

              const subtotal = quantity * unitPrice;
              const lineTotal =
                subtotal - (subtotal * discount / 100);

              return `
                <div class="quote-item">
                  <div>${item.sku || '-'}</div>
                  <div>${item.product || 'Producto'}</div>
                  <div>${quantity}</div>
                  <div>${money(unitPrice)}</div>
                  <div>${discount}%</div>
                  <div><b>${money(lineTotal)}</b></div>

                  <div class="quote-item-actions">
                    <button onclick="editQuoteItem('${item.id}')">
                      ✏️
                    </button>

                    <button onclick="deleteQuoteItem('${item.id}','${quote.id}')">
                      🗑
                    </button>
                  </div>
                </div>
              `;
            }).join('')}

            <div class="quote-total">
              <div>
                <span>Neto</span>
                <strong>${money(netTotal)}</strong>
              </div>

              <div>
                <span>IVA 19%</span>
                <strong>${money(iva)}</strong>
              </div>

              <div>
                <span>Total</span>
                <strong>${money(grandTotal)}</strong>
              </div>
            </div>

          </div>
        `
        : `
          <p class="meta">
            Esta cotización todavía no tiene productos agregados.
          </p>
        `
    }

    <h3 style="margin-top:25px">Descripción</h3>

    <p>${quote.description || '-'}</p>

    <div class="quick-actions">
      <button onclick="generateQuotePdf('${quote.id}')">
  📄 PDF
</button>

${
  quote.status === 'Borrador'
    ? `
      <button onclick="markQuoteAsSent('${quote.id}')">
        📤 Marcar como enviada
      </button>
    `
    : ''
}

<button onclick="acceptQuote('${quote.id}')">
  ✅ Aceptar
</button>

<button onclick="rejectQuote('${quote.id}')">
  ❌ Rechazar
</button>
    </div>
  `;
    profile.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


async function acceptQuote(id){
  const result = await api('/api/quotes/'+id,{
    method:'PUT',
    body:JSON.stringify({
      status:'Aceptada'
    })
  });

  if(result.error){
    alert(result.error);
    return;
  }

  await loadAll();

const order = state.sales_orders.find(o => o.quoteId === id);

if(order){
  activateView('sales_orders');
  showSalesOrder(order.id);

  alert(
    '✅ Cotización aceptada.\n\n' +
    'Se creó el Pedido de Venta ' + order.number
  );
} else {
  activateView('quotes');
  }
} 

function renderSalesOrders(){
  const list = document.getElementById('salesOrdersList');
  if(!list) return;

  list.innerHTML = (state.sales_orders || []).map(o => `
    <div class="process-card" onclick="showSalesOrder('${o.id}')">
      <div>
        <h3>${o.number || o.id} · ${o.clientName || 'Cliente'}</h3>
        <p class="meta">${o.product || 'Producto'}</p>
      </div>

      <div class="process-right">
        ${tag(o.status || 'Pendiente', processStatusColor(o.status || ''))}
        <strong>${money(o.total || 0)}</strong>
      </div>
    </div>
  `).join('') || '<p class="meta">Sin pedidos de venta.</p>';
}

function showSalesOrder(id){

  const order = state.sales_orders.find(o => o.id===id);
  if(!order) return;

  const profile=document.getElementById('salesOrderProfile');
  if(!profile) return;
  
const hasTaxDocument = Boolean(
  order.taxDocumentType &&
  order.taxDocumentNumber
);
  const statusColor={
    'Pendiente':'yellow',
    'Stock reservado':'blue',
    'Facturado':'green',
    'Despachado':'purple',
    'Entregado':'green',
    'Cerrado':'gray'
  };

  const step1=['Pendiente','Stock reservado','Facturado','Despachado','Entregado'].includes(order.status);
  const step2=['Stock reservado','Facturado','Despachado','Entregado'].includes(order.status);
  const step3=['Facturado','Despachado','Entregado'].includes(order.status);
  const step4=['Despachado','Entregado'].includes(order.status);
  const step5=['Entregado'].includes(order.status);

  profile.innerHTML=`

<div class="order-header">

<h2>${order.number}</h2>

<div class="meta">
Cliente
</div>

<h3>${order.clientName}</h3>

${tag(order.status,statusColor[order.status]||'yellow')}

</div>


<div class="order-flow">

<div class="flow-step ${step1?'done':''}">
✔
<br>
Cotización
</div>

<div class="flow-line ${step2?'done':''}"></div>

<div class="flow-step ${step2?'done':''}">
📦
<br>
Stock
</div>

<div class="flow-line ${step3?'done':''}"></div>

<div class="flow-step ${step3?'done':''}">
🧾
<br>
Factura
</div>

<div class="flow-line ${step4?'done':''}"></div>

<div class="flow-step ${step4?'done':''}">
🚚
<br>
Despacho
</div>

<div class="flow-line ${step5?'done':''}"></div>

<div class="flow-step ${step5?'done':''}">
🏁
<br>
Entrega
</div>

</div>


<div class="profile-grid">

<div class="profile-box">
<b>Producto</b><br>
${order.product}
</div>

<div class="profile-box">
<b>Cantidad</b><br>
${order.quantity}
</div>

<div class="profile-box">
<b>Precio Unitario</b><br>
${money(order.unitPrice)}
</div>

<div class="profile-box">
<b>Total</b><br>
${money(order.total)}
</div>

<div class="profile-box">
<b>Fecha creación</b><br>
${new Date(order.createdAt).toLocaleDateString('es-CL')}
</div>

<div class="profile-box">
<b>Pedido</b><br>
${order.number}
</div>

</div>

<div class="quick-actions">

${
  order.status !== 'Cerrado'
    ? `
      <button onclick="nextSalesOrderStep('${order.id}')">
        ▶ ${nextSalesOrderLabel(order)}
      </button>
    `
    : `
      <button disabled>
        🏁 Pedido cerrado
      </button>
    `
}
${
  !order.taxDocumentType || !order.taxDocumentNumber
    ? `
      <button onclick="openTaxDocumentForm('${order.id}','Boleta')">
        🧾 Asociar boleta
      </button>

      <button onclick="openTaxDocumentForm('${order.id}','Factura')">
        📄 Asociar factura
      </button>
    `
    : `
      <button disabled>
        ${order.taxDocumentType} N.º ${order.taxDocumentNumber}
      </button>
    `
}
${
  hasTaxDocument
    ? `
      <button onclick="openDispatchForm('${order.id}')">
        📦 Generar etiqueta
      </button>
    `
    : `
      <button disabled>
        🔒 Etiqueta bloqueada
      </button>
    `
}

<button onclick="window.print()">

🖨 Imprimir

</button>

</div>

<h3 style="margin-top:30px">

Historial

</h3>

<div class="rec">

Pedido generado automáticamente desde la cotización.

</div>

`;
}
function nextSalesOrderLabel(order){
  const status = order.status || 'Pendiente';

  if(status === 'Pendiente') return 'Reservar stock';
  if(status === 'Stock reservado') return 'Emitir factura';
  if(status === 'Facturado') return 'Preparar despacho';
  if(status === 'Despachado') return 'Confirmar entrega';
  if(status === 'Entregado') return 'Cerrar pedido';

  return 'Continuar';
}
async function nextSalesOrderStep(id){
  return advanceSalesOrder(id);
}
function openTaxDocumentForm(orderId, type){
  const order = (state.sales_orders || []).find(o => o.id === orderId);
  if(!order) return;

  const number = prompt(`Ingresa el número de ${type.toLowerCase()}:`);

  if(!number){
    return;
  }

  saveTaxDocument(orderId, type, number.trim());
}

async function saveTaxDocument(orderId, type, number){
  const result = await api('/api/sales_orders/' + orderId, {
    method:'PUT',
    body:JSON.stringify({
      status:'Facturado',
      taxDocumentType:type,
      taxDocumentNumber:number,
      taxDocumentDate:new Date().toISOString()
    })
  });

  if(result?.error){
    alert(result.error);
    return;
  }

  await loadAll();
  showSalesOrder(orderId);

  alert(`${type} asociada correctamente.`);
}
function openDispatchForm(orderId){

  const order = state.sales_orders.find(o => o.id === orderId);

  if(!order) return;

  alert(
`ETIQUETA DE DESPACHO

Pedido:
${order.number}

Documento:
${order.taxDocumentType} Nº ${order.taxDocumentNumber}

Cliente:
${order.clientName}

Producto:
${order.product}

(En el siguiente paso esto será un PDF listo para imprimir.)`
  );

}
function openQuoteItemForm(quoteId){

  const products = state.products || [];

  if(!products.length){
    alert('No existen productos en el catálogo. Primero debes crear uno.');
    return;
  }

  const productList = products
    .map((product, index) =>
      `${index + 1}. ${product.sku || '-'} · ${product.name || 'Producto'}`
    )
    .join('\n');

  const selection = prompt(
    'Selecciona el producto.\n\n' +
    'Puedes escribir el número, SKU o nombre:\n\n' +
    productList
  );

  if(!selection) return;

  console.log("Seleccionado:", selection);
  console.log("Productos:", products);

  const search = selection.trim().toLowerCase();
  const numericIndex = Number(selection) - 1;

  let product = null;

  if(
    Number.isInteger(numericIndex) &&
    numericIndex >= 0 &&
    numericIndex < products.length
  ){
    product = products[numericIndex];
  }
console.log("Producto encontrado:", product);

if(!product){
  product = products.find(item =>
    String(item.sku || '').toLowerCase() === search ||
    String(item.name || '').toLowerCase() === search
  );
}

console.log("Producto encontrado:", product);

if(!product){
  alert(
    'Producto no encontrado.\n\n' +
    'Escribe el número de la lista, el SKU exacto o el nombre exacto.'
  );
  return;
}

  const quantity = Number(
    prompt('Cantidad:', '1')
  );

  if(!Number.isFinite(quantity) || quantity <= 0){
    alert('La cantidad debe ser mayor que cero.');
    return;
  }

  const unitPrice = Number(
    prompt('Precio unitario:', product.price || 0)
  );

  if(!Number.isFinite(unitPrice) || unitPrice < 0){
    alert('El precio ingresado no es válido.');
    return;
  }

  const discount = Number(
    prompt('Descuento porcentual:', '0')
  );

  if(
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100
  ){
    alert('El descuento debe estar entre 0 y 100.');
    return;
  }

  saveQuoteItem({
    quoteId,
    productId: product.id,
    sku: product.sku || '',
    product: product.name || 'Producto',
    quantity,
    unitPrice,
    discount
  });
}

async function saveQuoteItem(item){

  const subtotal =
    Number(item.quantity || 0) *
    Number(item.unitPrice || 0);

  const total =
    subtotal -
    (subtotal * Number(item.discount || 0) / 100);

  const result = await api('/api/quote_items',{
    method:'POST',
    body:JSON.stringify({
      ...item,
      total
    })
  });

  if(result?.error){
    alert(result.error);
    return;
  }

  await loadAll();
  showQuote(item.quoteId);
}
function editQuoteItem(itemId){

  const item = (state.quote_items || []).find(x => x.id === itemId);
  if(!item) return;

  const quantity = Number(
    prompt('Cantidad:', item.quantity || 1)
  );

  if(!Number.isFinite(quantity) || quantity <= 0){
    alert('La cantidad debe ser mayor que cero.');
    return;
  }

  const unitPrice = Number(
    prompt('Precio unitario:', item.unitPrice || 0)
  );

  if(!Number.isFinite(unitPrice) || unitPrice < 0){
    alert('El precio no es válido.');
    return;
  }

  const discount = Number(
    prompt('Descuento %:', item.discount || 0)
  );

  if(
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100
  ){
    alert('El descuento debe estar entre 0 y 100.');
    return;
  }

  updateQuoteItem(item, {
    quantity,
    unitPrice,
    discount
  });
}

async function updateQuoteItem(item, changes){

  const subtotal =
    Number(changes.quantity || 0) *
    Number(changes.unitPrice || 0);

  const total =
    subtotal -
    subtotal * Number(changes.discount || 0) / 100;

  const result = await api('/api/quote_items/' + item.id, {
    method:'PUT',
    body:JSON.stringify({
      ...changes,
      total
    })
  });

  if(result?.error){
    alert(result.error);
    return;
  }

  await loadAll();
  showQuote(item.quoteId);
}
async function deleteQuoteItem(itemId, quoteId){

  if(!confirm('¿Eliminar este producto de la cotización?')){
    return;
  }

  const result = await api('/api/quote_items/' + itemId,{
    method:'DELETE'
  });

  if(result?.error){
    alert(result.error);
    return;
  }

  await loadAll();
  showQuote(quoteId);
}
function generateQuotePdf(quoteId){

  const quote = (state.quotes || []).find(q => q.id === quoteId);
  if(!quote){
    alert('No se encontró la cotización.');
    return;
  }

  const client = (state.clients || []).find(c =>
    c.id === quote.clientId ||
    c.name === quote.clientName
  );

  const quoteItems = (state.quote_items || []).filter(
    item => item.quoteId === quote.id
  );

  if(!quoteItems.length){
    alert('La cotización no tiene productos.');
    return;
  }

  const netTotal = quoteItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);

    const subtotal = quantity * unitPrice;
    const lineTotal =
      subtotal - (subtotal * discount / 100);

    return sum + lineTotal;
  }, 0);

  const iva = netTotal * 0.19;
  const grandTotal = netTotal + iva;

  const rows = quoteItems.map(item => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);

    const subtotal = quantity * unitPrice;
    const lineTotal =
      subtotal - (subtotal * discount / 100);

    return `
      <tr>
        <td>${item.sku || '-'}</td>
        <td>${item.product || 'Producto'}</td>
        <td>${quantity}</td>
        <td>${money(unitPrice)}</td>
        <td>${discount}%</td>
        <td>${money(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank');

  if(!printWindow){
    alert('El navegador bloqueó la ventana de impresión.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${quote.number || 'Cotización'}</title>

      <style>
        body{
    font-family:"Segoe UI",Arial,sans-serif;
    background:#fff;
    color:#222;
    margin:35px;
    line-height:1.5;
    font-size:13px;
}

.header{
    border-bottom:5px solid #b00000;
    padding-bottom:18px;
    margin-bottom:28px;
}

.brand{
    font-size:34px;
    font-weight:900;
    color:#b00000;
    letter-spacing:1px;
}

.subtitle{
    font-size:15px;
    color:#333;
    margin-top:5px;
}

.grid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:15px;
    margin:25px 0;
}

.box{
    border:1px solid #dddddd;
    border-radius:6px;
    padding:12px;
    background:#fcfcfc;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-top:25px;
}

th{
    background:#b00000;
    color:#fff;
    padding:10px;
    font-size:12px;
    text-transform:uppercase;
}

td{
    padding:10px;
    border-bottom:1px solid #e5e5e5;
}

tr:nth-child(even){
    background:#fafafa;
}

.totals{
    width:320px;
    margin-left:auto;
    margin-top:30px;
}

.totals div{
    display:flex;
    justify-content:space-between;
    padding:8px 0;
}

.grand-total{
    margin-top:10px;
    border-top:3px solid #b00000;
    border-bottom:3px solid #b00000;
    padding:12px 0;
    font-size:22px;
    font-weight:800;
}

.conditions{
    margin-top:40px;
    border:1px solid #ddd;
    border-left:6px solid #b00000;
    background:#fafafa;
    padding:18px;
}

.footer{
    margin-top:45px;
    padding-top:15px;
    border-top:1px solid #ddd;
    text-align:center;
    color:#666;
    font-size:12px;
}

        @media print{
          body{
            margin:20px;
          }

          button{
            display:none;
          }
        }
      </style>
    </head>

    <body>
      <div class="header">

    <table style="width:100%;border-collapse:collapse;">
        <tr>

            <td style="width:70%;vertical-align:top;">

                <div class="brand">
                    GABUTTI CORSE
                </div>

                <div class="subtitle">
                    Equipamiento Profesional para Automovilismo
                </div>

                <div class="description">
                    Representante Oficial de Bell • OMP • Stilo • Evo Corse • Endless • Lifeline
                </div>

            </td>

            <td style="text-align:right;vertical-align:top;">

                <div style="font-size:12px;color:#666;">
                    COTIZACIÓN
                </div>

                <div style="font-size:28px;font-weight:800;">
                    ${quote.number}
                </div>

                <div style="margin-top:8px;font-size:13px;color:#555;">
                    ${new Date(quote.createdAt).toLocaleDateString('es-CL')}
                </div>

            </td>

        </tr>

    </table>

</div>

      <div class="grid">
        <div class="box">
          <b>Cotización</b><br>
          ${quote.number || quote.id}
        </div>

        <div class="box">
          <b>Fecha</b><br>
          ${new Date(quote.createdAt || Date.now()).toLocaleDateString('es-CL')}
        </div>

        <div class="box">
          <b>Cliente</b><br>
          ${quote.clientName || '-'}
        </div>

        <div class="box">
          <b>Responsable</b><br>
          ${quote.owner || '-'}
        </div>

        <div class="box">
          <b>RUT</b><br>
          ${client?.rut || '-'}
        </div>

        <div class="box">
          <b>Email</b><br>
          ${client?.email || '-'}
        </div>

        <div class="box">
          <b>Teléfono</b><br>
          ${client?.phone || client?.whatsapp || '-'}
        </div>

        <div class="box">
          <b>Dirección</b><br>
          ${client?.address || '-'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Cant.</th>
            <th>P. unitario</th>
            <th>Desc.</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div>
          <span>Neto</span>
          <strong>${money(netTotal)}</strong>
        </div>

        <div>
          <span>IVA 19%</span>
          <strong>${money(iva)}</strong>
        </div>

        <div class="grand-total">
          <span>Total</span>
          <strong>${money(grandTotal)}</strong>
        </div>
      </div>

      <div class="conditions">
        <h3>Condiciones comerciales</h3>
        <p>
          Oferta válida por 10 días. Productos sujetos a disponibilidad.
          Los productos de importación pueden requerir abono previo.
          Valores expresados en pesos chilenos.
        </p>
      </div>

      <div class="footer">
        GABUTTI CORSE · Equipamiento Motorsport<br>
        www.gabutticorse.cl
      </div>

      <script>
        window.onload = function(){
          window.print();
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
async function markQuoteAsSent(id){

  const result = await api('/api/quotes/' + id, {
    method:'PUT',
    body:JSON.stringify({
      status:'Enviada',
      sentAt:new Date().toISOString()
    })
  });

  if(result?.error){
    alert(result.error);
    return;
  }

  await loadAll();
  showQuote(id);

  alert('Cotización marcada como enviada.');
}