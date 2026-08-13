async function advanceSalesOrder(orderId){
  const order = state.sales_orders.find(o => o.id === orderId);
  if(!order) return;

  const status = order.status || 'Pendiente';

  if(status === 'Pendiente') return reserveStock(order);
  if(status === 'Stock reservado') return createInvoice(order);
  if(status === 'Facturado') return prepareDispatch(order);
  if(status === 'Despachado') return confirmDelivery(order);
  if(status === 'Entregado') return closeOrder(order);
}

async function updateOrderStatus(order,newStatus){
  const result = await api('/api/sales_orders/' + order.id,{
    method:'PUT',
    body:JSON.stringify({ status:newStatus })
  });

  if(result.error){
    alert(result.error);
    return false;
  }

  await loadAll();
  showSalesOrder(order.id);
  renderSalesOrders();

  return true;
}

async function reserveStock(order){
  const ok = await updateOrderStatus(order,'Stock reservado');
  if(!ok) return;

  alert('✅ Stock reservado correctamente.');
}

async function createInvoice(order){
  const resultFinance = await api('/api/finance',{
    method:'POST',
    body:JSON.stringify({
      concept:'Cobro pedido '+(order.clientName||'Cliente')+' - '+(order.product||'Producto'),
      type:'Cobro',
      amount:order.total||0,
      status:'Pendiente',
      source:'Pedido de Venta',
      sourceId:order.id
    })
  });

  if(resultFinance.error){
    alert(resultFinance.error);
    return;
  }

  const ok = await updateOrderStatus(order,'Facturado');
  if(!ok) return;

  alert('🧾 Pedido facturado y cobro creado en Finanzas.');
}
async function prepareDispatch(order){
  const ok = await updateOrderStatus(order, 'Despachado');
  if(!ok) return;

  alert('📦 Pedido preparado para despacho.');
}
async function confirmDelivery(order){
  const ok = await updateOrderStatus(order,'Entregado');
  if(!ok) return;

  alert('🚚 Entrega confirmada.');
}

async function closeOrder(order){
  const ok = await updateOrderStatus(order,'Cerrado');
  if(!ok) return;

  alert('🏁 Pedido cerrado.');
}
function nextSalesOrderLabel(order){

    switch(order.status){

        case 'Pendiente':
            return 'Reservar stock';

        case 'Stock reservado':
            return 'Emitir factura';

        case 'Facturado':
            return 'Preparar despacho';

        case 'Despachado':
            return 'Confirmar entrega';

        case 'Entregado':
            return 'Cerrar pedido';

        default:
            return 'Continuar';
    }

}