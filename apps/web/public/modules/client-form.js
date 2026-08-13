let clientDiagnostic={rut:null,save:null};
function safeDiagnostic(value){
  if(value===undefined)return null;
  try{return JSON.parse(JSON.stringify(value,(key,val)=>/token|authorization|password/i.test(key)?'[OCULTO]':val));}catch{return String(value);}
}
function currentClientFormSnapshot(){
  if(!window.clientForm)return {};
  const f=clientForm.elements;
  return {rut:f.rut?.value||'',nombre:f.name?.value||'',razonSocial:f.businessName?.value||'',giro:f.businessActivity?.value||'',direccionTributaria:f.taxAddress?.value||'',regionTributaria:f.taxRegion?.value||'',comunaTributaria:f.taxComuna?.value||'',email:f.email?.value||'',telefono:f.whatsapp?.value||'',facturacion:typeof billingSnapshot==='function'?billingSnapshot():{},envio:{tipo:f.dispatchType?.value||'',direccion:f.dispatchAddress?.value||'',region:f.dispatchRegion?.value||'',comuna:f.dispatchCity?.value||'',destinatario:f.dispatchRecipient?.value||'',telefono:f.dispatchPhone?.value||'',email:f.dispatchEmail?.value||''}};
}
function refreshClientDiagnostic(){
  const rut=document.getElementById('diagRut'),form=document.getElementById('diagForm'),save=document.getElementById('diagSave');
  if(rut)rut.textContent=JSON.stringify(safeDiagnostic(clientDiagnostic.rut),null,2)||'Aún no se ha consultado un RUT.';
  if(form)form.textContent=JSON.stringify(currentClientFormSnapshot(),null,2);
  if(save)save.textContent=JSON.stringify(safeDiagnostic(clientDiagnostic.save),null,2)||'Aún no se ha intentado guardar.';
}
async function copyClientDiagnostic(){
  refreshClientDiagnostic();
  const text=['RESPUESTA RUT / SRE',document.getElementById('diagRut')?.textContent||'','DATOS DEL FORMULARIO',document.getElementById('diagForm')?.textContent||'','RESPUESTA AL GUARDAR',document.getElementById('diagSave')?.textContent||''].join('\n\n');
  try{await navigator.clipboard.writeText(text);alert('Diagnóstico copiado.');}catch{alert(text);}
}
function showClientOperation(kind,html){const el=document.getElementById('clientOperationStatus');if(!el)return;el.className='operation-status '+(kind||'');el.innerHTML=html;}
function openClientForm(){
  clientDiagnostic={rut:null,save:null};
  clientForm.reset();
  if(typeof loadCatalogOptions==='function') loadCatalogOptions();
  document.getElementById('rutStatus').className='rut-status hidden';
  document.getElementById('billingSameAsTax').checked=true;
  toggleBillingFields();
  clearDispatchAddress(false);
  toggleDispatchFields();
  clientModal.showModal();
  refreshClientDiagnostic();
}
function closeClientForm(){clientModal.close();}
function normalizeRutClient(value=''){return String(value).replace(/[^0-9kK]/g,'').toUpperCase();}
function formatRutClient(value=''){
  const clean=normalizeRutClient(value); if(clean.length<2)return value;
  return clean.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+clean.slice(-1);
}
function setRutStatus(kind,text){const el=document.getElementById('rutStatus');el.className='rut-status '+kind;el.textContent=text;}
let rutLookupTimer=null;
let lastRutLookup='';
function selectCatalogValue(select,value){
  if(!select||!value)return false;
  const target=String(value).trim().toLowerCase();
  const option=[...select.options].find(o=>String(o.value).trim().toLowerCase()===target||String(o.textContent).trim().toLowerCase()===target);
  if(option){select.value=option.value;select.dispatchEvent(new Event('change'));return true;}
  return false;
}
function scheduleRutLookup(){
  clearTimeout(rutLookupTimer);
  const input=document.getElementById('clientRut');
  const clean=normalizeRutClient(input.value);
  if(clean.length<8||clean===lastRutLookup)return;
  rutLookupTimer=setTimeout(()=>lookupRut(),550);
}
async function lookupRut(){
  const input=document.getElementById('clientRut');
  const rut=input.value.trim();
  if(!rut){setRutStatus('error','Ingresa un RUT.');return;}
  const clean=normalizeRutClient(rut);
  if(clean===lastRutLookup)return;
  lastRutLookup=clean;
  setRutStatus('warning','Consultando automáticamente los datos tributarios…');
  let result;
  try{result=await api('/api/rut-lookup/'+encodeURIComponent(rut));clientDiagnostic.rut=result;refreshClientDiagnostic();}
  catch(error){lastRutLookup='';setRutStatus('error','No fue posible consultar el RUT. Puedes completar los datos manualmente.');return;}
  if(result.valid===false){lastRutLookup='';setRutStatus('error',result.error||'RUT inválido.');return;}
  input.value=result.rut||formatRutClient(rut);
  if(result.existing){setRutStatus('warning',`El cliente ${result.client.number||''} ya existe: ${result.client.name||''}.`);showClientProfile(result.client.id);return;}
  if(result.found&&result.data){
    const f=clientForm.elements, d=result.data;
    const companyName=d.name||d.businessName||'';
    f.name.value=companyName;
    f.businessName.value=d.businessName||companyName;
    f.businessActivity.value=d.businessActivity||'';
    if(f.email) f.email.value=d.email||d.dteEmail||f.email.value||'';
    if(f.whatsapp) f.whatsapp.value=d.phone||f.whatsapp.value||'';
    if(f.taxAddress) f.taxAddress.value=d.address||'';
    if(f.taxRegion) f.taxRegion.value=d.region||'';
    if(f.taxComuna) f.taxComuna.value=d.comuna||d.city||'';
    if(document.getElementById('billingSameAsTax').checked){
      if(f.billingEmail) f.billingEmail.value=d.dteEmail||d.email||'';
      if(f.billingActivity) f.billingActivity.value=d.businessActivity||'';
      if(f.billingBusinessName) f.billingBusinessName.value=d.businessName||d.name||'';
      if(f.billingRut) f.billingRut.value=result.rut||formatRutClient(rut);
      if(f.billingAddress) f.billingAddress.value=d.address||'';
      if(f.billingRegion && d.region) f.billingRegion.value=d.region;
      if(f.billingComuna && (d.city||d.comuna)) f.billingComuna.value=d.city||d.comuna;
    }
    refreshClientDiagnostic();
    const loaded=[companyName,d.businessActivity,d.address,d.region,d.comuna||d.city,d.email||d.dteEmail,d.phone].filter(Boolean).length; setRutStatus('success',`Datos tributarios cargados (${loaded}/7 campos disponibles). Revísalos antes de guardar.`);
  }else if(result.providerUnavailable){
    lastRutLookup='';
    setRutStatus('error',(result.error||'Servicio tributario no disponible.')+(result.detail?' Detalle: '+result.detail:'')+' Puedes completar manualmente y volver a intentar.');
  }else{lastRutLookup='';setRutStatus('warning','RUT válido, pero el proveedor no encontró información para este contribuyente. Puedes completar los datos manualmente.');}
}
let billingRutLookupTimer = null;
let lastBillingRutLookup = '';

function scheduleBillingRutLookup(){
  clearTimeout(billingRutLookupTimer);

  const input = clientForm.elements.billingRut;
  const sameAsTax = document.getElementById('billingSameAsTax').checked;

  if(!input || sameAsTax) return;

  const clean = normalizeRutClient(input.value);

  if(clean.length < 8 || clean === lastBillingRutLookup) return;

  billingRutLookupTimer = setTimeout(() => {
    lookupBillingRut();
  }, 550);
}

async function lookupBillingRut(){
  const f = clientForm.elements;
  const input = f.billingRut;
  const sameAsTax = document.getElementById('billingSameAsTax').checked;

  if(!input || sameAsTax) return;

  const rut = input.value.trim();

  if(!rut){
    setRutStatus('error', 'Ingresa el RUT de facturación.');
    return;
  }

  const clean = normalizeRutClient(rut);

  if(clean === lastBillingRutLookup) return;

  lastBillingRutLookup = clean;

  setRutStatus(
    'warning',
    'Consultando automáticamente los datos de facturación…'
  );

  let result;

  try{
    result = await api(
      '/api/rut-lookup/' + encodeURIComponent(rut)
    );

    clientDiagnostic.rut = result;
    refreshClientDiagnostic();
  }catch(error){
    lastBillingRutLookup = '';

    setRutStatus(
      'error',
      'No fue posible consultar el RUT de facturación. Puedes completar los datos manualmente.'
    );

    return;
  }

  if(result.valid === false){
    lastBillingRutLookup = '';

    setRutStatus(
      'error',
      result.error || 'El RUT de facturación no es válido.'
    );

    return;
  }

  input.value = result.rut || formatRutClient(rut);

  if(result.found && result.data){
    const d = result.data;

    f.billingRut.value =
      result.rut ||
      d.rut ||
      formatRutClient(rut);

    f.billingBusinessName.value =
      d.businessName ||
      d.name ||
      '';

    f.billingActivity.value =
      d.businessActivity ||
      '';

    f.billingEmail.value =
      d.dteEmail ||
      d.email ||
      '';

    f.billingPhone.value =
      d.phone ||
      '';

    f.billingAddress.value =
      d.address ||
      '';

    f.billingRegion.value =
      d.region ||
      '';

    f.billingComuna.value =
      d.comuna ||
      d.city ||
      '';

    refreshClientDiagnostic();

    const loaded = [
      d.businessName || d.name,
      d.businessActivity,
      d.dteEmail || d.email,
      d.phone,
      d.address,
      d.region,
      d.comuna || d.city
    ].filter(Boolean).length;

    setRutStatus(
      'success',
      `Datos de facturación cargados (${loaded}/7 campos disponibles). Revísalos antes de guardar.`
    );

    return;
  }

  if(result.providerUnavailable){
    lastBillingRutLookup = '';

    setRutStatus(
      'error',
      (result.error || 'Servicio tributario no disponible.') +
      (result.detail ? ' Detalle: ' + result.detail : '') +
      ' Puedes completar los datos de facturación manualmente.'
    );

    return;
  }

  lastBillingRutLookup = '';

  setRutStatus(
    'warning',
    'RUT válido, pero no se encontró información tributaria. Puedes completar los datos de facturación manualmente.'
  );
}

function taxSnapshot(){
  const f=clientForm.elements;
  return {rut:f.rut.value,businessName:f.businessName.value||f.name.value,businessActivity:f.businessActivity.value,email:f.email.value,phone:f.whatsapp.value,address:f.taxAddress.value,region:f.taxRegion.value,comuna:f.taxComuna.value};
}
function setSelectOrManual(select,manualId,value){
  if(!select||!value)return;
  if(!selectCatalogValue(select,value)){select.value='manual';const manual=document.getElementById(manualId);if(manual){manual.classList.remove('hidden');manual.value=value;}}
}
function copyTaxToBilling(){
  const f=clientForm.elements,t=taxSnapshot();
  f.billingRut.value=t.rut;f.billingBusinessName.value=t.businessName;f.billingActivity.value=t.businessActivity;f.billingEmail.value=t.email;f.billingPhone.value=t.phone;f.billingAddress.value=t.address;
  f.billingRegion.value=t.region||'';f.billingComuna.value=t.comuna||'';
}
function toggleBillingFields(){
  const same=document.getElementById('billingSameAsTax').checked;
  if(same)copyTaxToBilling();
  document.querySelectorAll('#billingFields input,#billingFields select').forEach(el=>{el.disabled=same;});
  document.getElementById('billingFields').classList.toggle('copied-data',same);
}
function billingSnapshot(){
  const f=clientForm.elements;
  if(document.getElementById('billingSameAsTax').checked)return taxSnapshot();
  return {rut:f.billingRut.value,businessName:f.billingBusinessName.value,businessActivity:f.billingActivity.value,email:f.billingEmail.value,phone:f.billingPhone.value,address:f.billingAddress.value,region:f.billingRegion.value,comuna:f.billingComuna.value};
}
function applyDispatchSnapshot(data,label){
  const f=clientForm.elements;
  f.dispatchAddress.value=data.address||'';f.dispatchRecipient.value=data.businessName||f.name.value||'';f.dispatchPhone.value=data.phone||'';f.dispatchEmail.value=data.email||'';f.dispatchCopiedFrom.value=label||'';
  f.dispatchRegion.value=data.region||'';
  f.dispatchCity.value=data.comuna||'';
}
function copyTaxToDispatch(){applyDispatchSnapshot(taxSnapshot(),'Datos tributarios');}
function copyBillingToDispatch(){if(document.getElementById('billingSameAsTax').checked)copyTaxToBilling();applyDispatchSnapshot(billingSnapshot(),'Datos de facturación');}
function clearDispatchAddress(reset=true){
  const f=clientForm.elements;if(reset){f.dispatchAddress.value='';f.dispatchRecipient.value='';f.dispatchPhone.value='';f.dispatchEmail.value='';f.dispatchRegion.value='';f.dispatchCity.value='';}
  f.dispatchCopiedFrom.value='Datos propios';
}
function toggleDispatchFields(){
  const type=document.getElementById('dispatchType').value;
  document.querySelectorAll('.agency-only').forEach(el=>el.classList.toggle('hidden',type!=='Agencia de transporte'));
  const noLocation=['Retiro en tienda'].includes(type);
  document.querySelectorAll('.dispatch-location,.dispatch-address').forEach(el=>el.classList.toggle('hidden',noLocation));
}
document.getElementById('billingSameAsTax').addEventListener('change',toggleBillingFields);
document.getElementById('dispatchType').addEventListener('change',toggleDispatchFields);
document.getElementById('transportCompany').addEventListener('change', () => {if (typeof updateTransportBranches === 'function') updateTransportBranches();});
document.getElementById('clientRut').addEventListener('input',scheduleRutLookup);
document.getElementById('clientRut').addEventListener('blur',()=>{if(document.getElementById('clientRut').value) lookupRut();});
clientForm.addEventListener('input', (event) => {
  if (event.target?.name === 'billingRut') {
    scheduleBillingRutLookup();
  }
});

clientForm.addEventListener(
  'blur',
  (event) => {
    if (event.target?.name === 'billingRut') {
      lookupBillingRut();
    }
  },
  true
);
clientForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const f=clientForm.elements;
  const submitButton=clientForm.querySelector('button[type="submit"]');
  const originalText=submitButton?.textContent||'Guardar cliente';
  try{
    if(!String(f.rut.value||'').trim()){setRutStatus('error','El RUT es obligatorio.');f.rut.focus();return;}
    if(!String(f.name.value||'').trim()){
      // Último respaldo visual: usar razón social como nombre comercial.
      f.name.value=String(f.businessName.value||'').trim();
    }
    if(!String(f.name.value||'').trim()){
      setRutStatus('error','Falta el nombre comercial o razón social. Revisa los datos cargados por RUT.');
      f.name.focus();return;
    }
    if(submitButton){submitButton.disabled=true;submitButton.textContent='Guardando…';}
    const bill=billingSnapshot();
    const data={
      rut:f.rut.value,name:f.name.value,businessName:f.businessName.value,businessActivity:f.businessActivity.value,taxAddress:f.taxAddress.value,taxRegion:f.taxRegion.value,taxComuna:f.taxComuna.value,clientType:f.clientType.value,status:f.status.value,owner:f.owner.value,source:f.source.value,email:f.email.value,whatsapp:f.whatsapp.value,discipline:f.discipline.value,level:f.level.value,priceList:f.priceList.value,paymentCondition:f.paymentCondition.value,creditLimit:Number(f.creditLimit.value||0),operationalAlert:f.operationalAlert.value,observations:f.observations.value,
      billing:{sameAsTax:document.getElementById('billingSameAsTax').checked,different:!document.getElementById('billingSameAsTax').checked,rut:bill.rut,businessName:bill.businessName,businessActivity:bill.businessActivity,email:bill.email,contact:f.billingContact.value,phone:bill.phone,address:bill.address,region:bill.region,comuna:bill.comuna},
      dispatch:{type:f.dispatchType.value,transportCompanyId:f.transportCompany.value,transportCompany:(state.transport_companies||[]).find(x=>x.id===f.transportCompany.value)?.name||'',region:f.dispatchRegion.value,city:f.dispatchCity.value,branchId:f.transportBranch.value,branch:(state.transport_branches||[]).find(x=>x.id===f.transportBranch.value)?.name||'',address:f.dispatchAddress.value,recipient:f.dispatchRecipient.value,phone:f.dispatchPhone.value,email:f.dispatchEmail.value,copiedFrom:f.dispatchCopiedFrom.value||'Datos propios',notes:f.dispatchNotes.value}
    };
    refreshClientDiagnostic();
    const result=await api('/api/clients',{method:'POST',body:JSON.stringify(data)});
    clientDiagnostic.save=result;refreshClientDiagnostic();
    if(result.error){
      if(result.existingClient){setRutStatus('warning',`El cliente ${result.existingClient.number||''} ya existe.`);showClientProfile(result.existingClient.id);}else setRutStatus('error',result.error);
      return;
    }
    await loadAll();
    closeClientForm();
    if(typeof activateView==='function')activateView('clients');
    showClientOperation('success',`<div><strong>Cliente guardado correctamente</strong><div>${result.number||''} · ${result.name||result.businessName||''} · ${result.rut||''}</div></div><button onclick="showClientProfile('${result.id}')">Abrir ficha</button>`);
    showClientProfile(result.id);
  }catch(error){
    console.error('Error guardando cliente',error);clientDiagnostic.save={error:error.message||String(error),type:'exception'};refreshClientDiagnostic();
    setRutStatus('error','No se pudo guardar el cliente. Detalle: '+(error.message||'error inesperado'));
  }finally{
    if(submitButton){submitButton.disabled=false;submitButton.textContent=originalText;}
  }
});

async function resetTestData(){
  if(!confirm('Esto eliminará clientes, inbox, procesos, cotizaciones y tareas de prueba. Andrea y José se conservarán. ¿Continuar?'))return;
  const result=await api('/api/development-reset',{method:'POST'});
  if(result.ok){await loadAll();clientProfile.innerHTML='<p class="meta">Base limpia. El próximo cliente será CLI-000001.</p>';alert('Datos de prueba eliminados. Próximo cliente: CLI-000001');}
}

clientForm.addEventListener('input',()=>refreshClientDiagnostic());
