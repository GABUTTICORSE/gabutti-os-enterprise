/* GS ONE v0.6.1 · Ficha Cliente v1.0 */
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function clientById(id){return (state.clients||[]).find(x=>x.id===id);}
function clientMatches(x,c){return x&&(x.clientId===c.id||(x.clientName||'').toLowerCase()===(c.name||'').toLowerCase());}
function localClientMetrics(c){
 const orders=(state.sales_orders||[]).filter(x=>clientMatches(x,c)), quotes=(state.quotes||[]).filter(x=>clientMatches(x,c)), fin=(state.finance||[]).filter(x=>clientMatches(x,c));
 const now=Date.now(), after=n=>now-n*86400000, o30=orders.filter(x=>new Date(x.createdAt||0)>=after(30)).length, o90=orders.filter(x=>new Date(x.createdAt||0)>=after(90)).length;
 const total=orders.filter(x=>new Date(x.createdAt||0)>=after(365)).reduce((a,x)=>a+Number(x.total||0),0), paid=fin.filter(x=>['Cobrado','Pagado'].includes(x.status)).length;
 const pay=fin.length?Math.round(paid/fin.length*100):70, score=Math.min(100,Math.round(25+Math.min(o90*8,28)+Math.min(total/200000,25)+pay*.18));
 return {classification:score>=75?'A':score>=45?'B':'C',score,relationship:c.relationshipStatus||'Sin evaluar',purchases30:o30,purchases90:o90,total12m:total,paymentScore:pay,trend:o30>=2?'Subiendo':o90>=2?'Estable':'Por evaluar',opportunities:[]};
}
async function showClientProfile(id){
 const c=clientById(id); if(!c)return;
 let intel=await api('/api/client-intelligence/'+id); if(intel.error)intel=localClientMetrics(c);
 clientProfile.innerHTML=renderClientShell(c,intel);
}
function renderClientShell(c,i){
 const color=(i.relationship||'Sin evaluar').toLowerCase().replace('sin evaluar','gray');
 const executive=currentUser?.role==='Executive';
 return `<div class="client-v1">
  <div class="client-v1-header"><div><div class="client-code">${esc(c.number||'CLI-PENDIENTE')}</div><h2>${esc(c.name||c.businessName||'Cliente')}</h2><p>${esc(c.rut||'-')} · ${esc(c.clientType||'-')} · Ejecutivo: ${esc(c.owner||'-')}</p></div><div class="client-v1-actions"><button onclick="openForm('clients','${esc(c.id)}')">Editar</button>${executive?`<button class="secondary" onclick="refreshClientRut('${esc(c.id)}','${esc(c.rut)}')">Actualizar desde SRE</button>`:''}<button class="secondary" onclick="generateQuoteFromClient('${esc(c.id)}')">Cotizar</button></div></div>
  <div class="client-summary-grid">
   ${metric('Clasificación',i.classification,'ABC automático')}${metric('Puntaje',i.score+'/100',i.trend)}${metric('Relación',i.relationship,'Evaluación integral',color)}${metric('Compras 90 días',i.purchases90,'Últimos 3 meses')}${metric('Pagos',i.paymentScore+'%','Cumplimiento')}${metric('Compras 12 meses',money(i.total12m),'Volumen acumulado')}
  </div>
  <div class="client-tabs"><button class="active" onclick="clientTab(this,'general')">General</button><button onclick="clientTab(this,'commercial')">Comercial</button><button onclick="clientTab(this,'billing')">Facturación</button><button onclick="clientTab(this,'dispatch')">Despacho</button><button onclick="clientTab(this,'timeline')">Historial</button>${executive?'<button onclick="clientTab(this,\'executive\')">Evaluación Executive</button>':''}<button onclick="clientTab(this,'audit')">Auditoría</button></div>
  <div id="clientTabContent">${tabGeneral(c,i)}</div>
  <template id="ct-general">${tabGeneral(c,i)}</template><template id="ct-commercial">${tabCommercial(c,i)}</template><template id="ct-billing">${tabBilling(c)}</template><template id="ct-dispatch">${tabDispatch(c)}</template><template id="ct-timeline">${tabTimeline(c)}</template><template id="ct-executive">${tabExecutive(c,i)}</template><template id="ct-audit">${tabAudit(i)}</template>
 </div>`;
}
function metric(label,value,detail,color=''){return `<div class="client-metric ${esc(color)}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;}
function clientTab(btn,name){btn.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById('clientTabContent').innerHTML=document.getElementById('ct-'+name).innerHTML;}
function boxes(items){return `<div class="client-data-grid">${items.map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b||'-')}</strong></div>`).join('')}</div>`;}
function tabGeneral(c,i){return `<h3>Identificación y contacto</h3>${boxes([['Nombre',c.name],['Razón social',c.businessName],['RUT',c.rut],['Giro',c.businessActivity],['Dirección tributaria',c.taxAddress],['Región tributaria',c.taxRegion],['Comuna tributaria',c.taxComuna],['Email',c.email],['WhatsApp',c.whatsapp],['Disciplina',c.discipline],['Nivel',c.level],['Origen',c.source],['Estado',c.status]])}<div class="client-note-box"><b>Observaciones</b><p>${esc(c.observations||'Sin observaciones.')}</p></div>${c.operationalAlert?`<div class="client-alert">${esc(c.operationalAlert)}</div>`:''}`;}
function tabCommercial(c,i){return `<h3>Comportamiento y oportunidades</h3>${boxes([['Lista de precios',c.priceList],['Condición de pago',c.paymentCondition],['Cupo de crédito',money(c.creditLimit)],['Frecuencia 30 días',i.purchases30+' compras'],['Frecuencia 90 días',i.purchases90+' compras'],['Descuentos',i.discountsSuspended?'Suspendidos':'Disponibles para evaluación']])}<h3>Recomendaciones GS ONE</h3><div class="opportunities">${(i.opportunities||[]).map(x=>`<div>${esc(x)}</div>`).join('')||'<p class="meta">Aún no hay una recomendación automática.</p>'}</div>`;}
function tabBilling(c){const b=c.billing||{};return `<h3>Facturación</h3>${boxes([['Usa datos tributarios',b.sameAsTax||!b.different?'Sí':'No'],['Razón social',b.businessName||c.businessName],['RUT',b.rut||c.rut],['Giro',b.businessActivity||c.businessActivity],['Email DTE',b.email||c.email],['Contacto',b.contact],['Teléfono',b.phone||c.whatsapp],['Dirección',b.address||c.taxAddress],['Región',b.region||c.taxRegion],['Comuna',b.comuna||c.taxComuna]])}`;}
function tabDispatch(c){const d=c.dispatch||{};return `<h3>Despacho habitual</h3>${boxes([['Origen de datos',d.copiedFrom||'Datos propios'],['Tipo',d.type],['Transportista',d.transportCompany],['Sucursal',d.branch],['Región',d.region],['Ciudad',d.city],['Dirección',d.address],['Destinatario',d.recipient],['Teléfono',d.phone],['Email',d.email]])}<div class="client-note-box"><b>Instrucciones</b><p>${esc(d.notes||'Sin instrucciones especiales.')}</p></div>`;}
function tabTimeline(c){const all=[...(state.quotes||[]).filter(x=>clientMatches(x,c)).map(x=>({d:x.createdAt,t:'Cotización '+(x.number||''),m:x.status})),...(state.sales_orders||[]).filter(x=>clientMatches(x,c)).map(x=>({d:x.createdAt,t:'Pedido '+(x.number||''),m:x.status})),...(state.tasks||[]).filter(x=>clientMatches(x,c)).map(x=>({d:x.createdAt,t:x.title,m:x.status}))].sort((a,b)=>new Date(b.d)-new Date(a.d));return `<h3>Historial unificado</h3><div class="client-timeline-v1">${all.map(x=>`<div><time>${x.d?new Date(x.d).toLocaleString('es-CL'):'-'}</time><strong>${esc(x.t)}</strong><span>${esc(x.m||'')}</span></div>`).join('')||'<p class="meta">Sin movimientos asociados.</p>'}</div>`;}
function tabExecutive(c,i){return `<h3>Evaluación Executive</h3><div class="executive-warning">Solo Andrea y José pueden ver y registrar esta información.</div><form onsubmit="saveExecutiveNote(event,'${esc(c.id)}')" class="executive-note-form"><label>Nota cualitativa</label><textarea name="text" required placeholder="Describe hechos concretos: conflictos, cambios de acuerdo, exigencias, riesgos o fortalezas relevantes."></textarea><div><select name="importance"><option>Media</option><option>Alta</option><option>Crítica</option></select><select name="recommendedColor"><option>Amarillo</option><option>Naranjo</option><option>Rojo</option><option>Verde</option></select><button>Guardar evaluación</button></div></form><h3>Notas vigentes</h3><div class="executive-notes">${(i.notes||[]).map(n=>`<div><b>${esc(n.importance)} · ${esc(n.recommendedColor)}</b><p>${esc(n.text)}</p><small>${esc(n.author)} · ${new Date(n.createdAt).toLocaleString('es-CL')}</small></div>`).join('')||'<p class="meta">Sin notas ejecutivas.</p>'}</div>`;}
async function saveExecutiveNote(e,id){e.preventDefault();const f=e.target;const r=await api('/api/client-note/'+id,{method:'POST',body:JSON.stringify({text:f.text.value,importance:f.importance.value,recommendedColor:f.recommendedColor.value})});if(r.error)return alert(r.error);await loadAll();showClientProfile(id);}
function tabAudit(i){return `<h3>Auditoría</h3><div class="client-timeline-v1">${(i.audit||[]).map(a=>`<div><time>${new Date(a.createdAt).toLocaleString('es-CL')}</time><strong>${esc(a.action)}</strong><span>${esc(a.actor)} · ${esc(a.detail||'')}</span></div>`).join('')||'<p class="meta">Sin cambios registrados.</p>'}</div>`;}
function generateQuoteFromClient(id){const c=clientById(id);if(!c)return;activateView('quotes');openForm('quotes',null,{clientId:c.id,clientName:c.name,status:'Borrador',owner:c.owner||'Andrea'});}

async function refreshClientRut(clientId,rut){
 if(!confirm('Actualizar los datos tributarios desde SRE? Las correcciones comerciales del cliente no serán eliminadas.'))return;
 const result=await api('/api/rut-refresh/'+encodeURIComponent(rut),{method:'POST'});
 if(result.error)return alert(result.error+(result.detail?'\n'+result.detail:''));
 await loadAll();showClientProfile(clientId);alert('Datos tributarios actualizados y guardados en la Base Tributaria Gabutti.');
}
