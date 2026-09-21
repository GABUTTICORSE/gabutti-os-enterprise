const http=require('http'),fs=require('fs'),path=require('path');
const {
  clearSessionCookie,
  createSession,
  createSessionCookie,
  getSession,
  hashPassword,
  migrateUsers,
  revokeSession,
  sanitizeUser,
  verifyPassword
} = require('./auth');
const {
  runAutomations,
  runCreationAutomations
} = require('./automation');
const { createRecord } = require("./crud");
const { getTodayMotorsportNews } = require('./motorsport/news.service');
const { sendTextMessage } = require('./integrations/whatsapp/whatsapp.client');
const {
  extractInboundMessages,
  verifyMetaSignature,
  verifyWebhookChallenge
} = require('./integrations/whatsapp/whatsapp.webhook');
const { readDB, writeDB } = require('./database');
const { nextNumber } = require('./numbers');

const {
  lookupTaxpayer
} = require("./tax/tax.lookup");
const {
  getTaxpayerByRut
} = require("./integrations/libredte/libredte.service");
const catalogs = require('./catalogs');
const PORT=process.env.PORT||3100;
const ROOT=path.join(__dirname,'..','..');
const DB=path.join(ROOT,'database','db.json');
const CONFIG_DIR=path.join(ROOT,'config');
const SRE_CONFIG=path.join(CONFIG_DIR,'sre.local.json');
const WEB=path.join(ROOT,'apps','web','public');
const publicRoutes = new Set(['login']);
const cols=['tax_directory','tax_sync_log','users','roles','clients','client_contacts','client_addresses','client_notes','client_alerts','client_ai_evaluations','client_audit','client_scores','inbox','inbox_analysis','commercial_processes','quotes','quote_items','sales_orders','history','products','stock','imports','tasks','finance','activity','transport_companies','transport_branches','catalogs'];
function uid(p='id'){return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}

function normalizeRut(value=''){
  return String(value).replace(/[^0-9kK]/g,'').toUpperCase();
}
function formatRut(value=''){
  const clean=normalizeRut(value);
  if(clean.length<2) return value;
  const body=clean.slice(0,-1), dv=clean.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+dv;
}
function validRut(value=''){
  const clean=normalizeRut(value);
  if(clean.length<2) return false;
  const body=clean.slice(0,-1), dv=clean.slice(-1);
  if(!/^\d+$/.test(body)) return false;
  let sum=0,mul=2;
  for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*mul;mul=mul===7?2:mul+1;}
  const rest=11-(sum%11);
  const expected=rest===11?'0':rest===10?'K':String(rest);
  return expected===dv;
}
function findClientByRut(db,rut){
  const target=normalizeRut(rut);
  return (db.clients||[]).find(x=>normalizeRut(x.rut)===target);
}


function readSreConfig(){
  let file={};
  try{file=JSON.parse(fs.readFileSync(SRE_CONFIG,'utf8'));}catch{}
  return {
    token:process.env.SRE_API_TOKEN||file.token||'',
    url:process.env.SRE_API_URL||file.url||'https://sre.cl/api/company_info'
  };
}
function upsertTaxDirectory(db, record, actor = 'Sistema', source = 'SRE'){
  db.tax_directory=db.tax_directory||[];
  db.tax_sync_log=db.tax_sync_log||[];
  const now=new Date().toISOString();
  const index=db.tax_directory.findIndex(x=>normalizeRut(x.rut)===normalizeRut(record.rut));
  const previous=index>=0?db.tax_directory[index]:{};
  const merged={...previous,...record,id:previous.id||uid('tax'),rut:formatRut(record.rut),source,firstImportedAt:previous.firstImportedAt||now,lastSyncedAt:now,lastSyncStatus:'Sincronizado',reviewStatus:previous.reviewStatus||'Pendiente de revisión',manualOverride:previous.manualOverride||false};
  if(index>=0)db.tax_directory[index]=merged;else db.tax_directory.push(merged);
  db.tax_sync_log.unshift({id:uid('tsl'),rut:merged.rut,status:'Sincronizado',source,actor,createdAt:now});
  return merged;
}

function providerRut(value=''){
  const clean=normalizeRut(value);
  if(clean.length<2) return clean;
  return clean.slice(0,-1)+'-'+clean.slice(-1);
}

function normalizeRegionFromSre(value=''){
  const raw=String(value??'').trim();
  const key=raw.replace(/^0+/,'');
  const byCode={
    '1':'Tarapacá','2':'Antofagasta','3':'Atacama','4':'Coquimbo','5':'Valparaíso',
    '6':'O’Higgins','7':'Maule','8':'Biobío','9':'La Araucanía','10':'Los Lagos',
    '11':'Aysén','12':'Magallanes','13':'Metropolitana','14':'Los Ríos',
    '15':'Arica y Parinacota','16':'Ñuble'
  };
  return byCode[key]||raw;
}
function firstValue(obj,keys){
  for(const key of keys){
    const value=obj?.[key];
    if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
  }
  return '';
}
function unwrapCompanyProviderData(payload,rut){
  if(!payload||typeof payload!=='object')return payload;
  let data=payload;
  // Algunas respuestas vienen envueltas en data/company/empresa/contribuyente.
  for(const key of ['data','company','contribuyente','empresa','info']){
    if(data?.[key]&&typeof data[key]==='object')data=data[key];
  }
  // Respuesta masiva o individual indexada por RUT.
  const candidates=[providerRut(rut),normalizeRut(rut),formatRut(rut),String(rut)];
  if(data?.ruts&&typeof data.ruts==='object')data=data.ruts;
  for(const key of candidates){
    if(data?.[key]&&typeof data[key]==='object')return data[key];
  }
  if(Array.isArray(data)){
    return data.find(x=>normalizeRut(x?.rut||x?.RUT||'')===normalizeRut(rut))||data[0]||null;
  }
  return data;
}
function parseCompanyProviderData(payload,rut){
  if(!payload || typeof payload!=='object') return null;
  const data=unwrapCompanyProviderData(payload,rut);
  if(!data||typeof data!=='object')return null;
  if(data.result===false){
    const err=new Error(data.error||data.message||'El proveedor no encontró información para el RUT.');
    err.providerPayload=payload;
    throw err;
  }
  const rawRegion=firstValue(data,['region_name','nombre_region','region_nombre','region','codigo_region']);
  const region=normalizeRegionFromSre(rawRegion);
  const rawComuna=firstValue(data,['comuna_name','nombre_comuna','comuna_nombre','localidad','comuna']);
  const city=firstValue(data,['ciudad','city','provincia_name','nombre_provincia','provincia']);
  // SRE puede devolver la comuna como código; en ese caso usamos ciudad como texto visible.
  const comuna=/^\d+$/.test(String(rawComuna).trim())?(city||String(rawComuna)):rawComuna;
  const street=firstValue(data,['calle','street']);
  const number=firstValue(data,['numero','numero_direccion','street_number']);
  const address=firstValue(data,['direccion_completa','direccion','address','domicilio'])||[street,number].filter(Boolean).join(' ');
  let activity=firstValue(data,['glosa_giro','giro','business_activity','actividad','actividad_economica','descripcion_actividad']);
  const businessName=firstValue(data,['razon_social','razonSocial','business_name','nombre_razon_social','nombre','name']);
  const email=firstValue(data,['email','correo','correo_contacto','contact_email','mail']);
  const dteEmail=firstValue(data,['dte_email','email_dte','correo_dte','mail_dte']);
  const phone=firstValue(data,['telefono','phone','fono','celular','telefono_contacto','telephone']);
  const website=firstValue(data,['url','website','web']);
  const actecos=Array.isArray(data.actecos)?data.actecos:(Array.isArray(data.actividades)?data.actividades:[]);
  if(!activity&&actecos.length){
    activity=actecos.map(x=>typeof x==='object'?(x.glosa||x.descripcion||x.codigo||''):x).filter(Boolean).join(', ');
  }
  if(!businessName && !activity && !address && !comuna && !region && !email && !phone) return null;
  return {
    rut:formatRut(data.rut||data.RUT||rut),
    name:businessName,
    businessName,
    businessActivity:activity,
    address,
    comuna,
    city:city||comuna,
    region,
    email,
    dteEmail,
    phone,
    website,
    actecos,
    source:'SRE',
    updatedAt:firstValue(data,['actualizado','updated_at','fecha_actualizacion']),
    remainingQueries:data.consultas_restantes,
    providerRaw:payload
  };
}

async function fetchProviderJson(url,options){
  const response=await fetch(url,options);
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{throw new Error('El proveedor devolvió una respuesta no válida.');}
  if(!response.ok){
    const message=data.error||data.message||('Proveedor tributario respondió '+response.status+'.');
    const err=new Error(message); err.status=response.status; err.providerPayload=data; throw err;
  }
  return data;
}

async function lookupCompanyFromProvider(rut){
  const config=readSreConfig();
  const token=config.token;
  const base=config.url;
  if(!token){const err=new Error('SRE no está configurado. Ejecuta INSTALAR_SRE.command.');err.code='SRE_NOT_CONFIGURED';throw err;}
  const formatted=providerRut(rut);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  let postError=null;
  try{
    // POST v2 primero: para usuarios registrados entrega información completa,
    // incluyendo dirección, email y teléfono cuando SRE dispone de ellos.
    try{
      const data=await fetchProviderJson(base,{
        method:'POST',
        headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'GS-ONE/0.6.6'},
        body:JSON.stringify({token,rut:formatted,version:'2.0'}),
        signal:controller.signal
      });
      const parsed=parseCompanyProviderData(data,rut);
      if(parsed)return parsed;
    }catch(error){postError=error;}

    try{
      const url=base+'?token='+encodeURIComponent(token)+'&rut='+encodeURIComponent(formatted)+'&actualizado=False';
      const data=await fetchProviderJson(url,{headers:{Accept:'application/json','User-Agent':'GS-ONE/0.6.6'},signal:controller.signal});
      return parseCompanyProviderData(data,rut);
    }catch(getError){
      const err=new Error(postError?.message||getError.message||'Servicio tributario no disponible.');
      err.status=postError?.status||getError.status;
      err.causeDetail={post:postError?.message||'',get:getError.message||''};
      throw err;
    }
  }finally{clearTimeout(timer);}
}

function js(res,s,d){res.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(d))}
const MAX_JSON_BODY_BYTES = 1024 * 1024;

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    let exceeded = false;

    req.on('data', chunk => {
      if (exceeded) return;

      size += Buffer.byteLength(chunk);

      if (size > MAX_JSON_BODY_BYTES) {
        exceeded = true;

        const error = new Error(
          'Payload demasiado grande'
        );
        error.status = 413;
        reject(error);
        return;
      }

      data += chunk;
    });

    req.on('end', () => {
      if (exceeded) return;

      try {
        resolve(
          data
            ? JSON.parse(data)
            : {}
        );
      } catch {
        resolve({});
      }
    });

    req.on('error', reject);
  });
}
const loginAttempts = new Map();
const loginIpAttempts = new Map();

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_IP_MAX_ATTEMPTS = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function getClientIp(req) {
  const isRailway =
    Boolean(
      process.env.RAILWAY_ENVIRONMENT
    );

  const realIp =
    String(
      req.headers['x-real-ip'] ||
      ''
    ).trim();

  if (isRailway && realIp) {
    return realIp;
  }

  return (
    req.socket?.remoteAddress ||
    'unknown'
  );
}
function getLoginAttemptKey(req, email) {
  return (
    getClientIp(req) +
    '|' +
    String(email || '')
      .trim()
      .toLowerCase()
  );
}
function getLoginLock(key) {
  const record = loginAttempts.get(key);

  if (!record) return null;

  const now = Date.now();

  if (
    record.lockedUntil &&
    record.lockedUntil > now
  ) {
    return record;
  }

  if (
    now - record.firstAttempt >
    LOGIN_WINDOW_MS
  ) {
    loginAttempts.delete(key);
    return null;
  }

  return null;
}
function registerFailedLogin(key) {
  const now = Date.now();
  let record = loginAttempts.get(key);

  if (
    !record ||
    now - record.firstAttempt >
      LOGIN_WINDOW_MS
  ) {
    record = {
      attempts: 0,
      firstAttempt: now,
      lockedUntil: 0
    };
  }

  record.attempts += 1;

  if (
    record.attempts >=
    LOGIN_MAX_ATTEMPTS
  ) {
    record.lockedUntil =
      now + LOGIN_LOCK_MS;
  }

  loginAttempts.set(
    key,
    record
  );

  return record;
}
function clearFailedLogins(key) {
  loginAttempts.delete(key);
}

function getIpLoginLock(ip) {
  const record = loginIpAttempts.get(ip);

  if (!record) return null;

  const now = Date.now();

  if (
    record.lockedUntil &&
    record.lockedUntil > now
  ) {
    return record;
  }

  if (
    now - record.firstAttempt >
    LOGIN_WINDOW_MS
  ) {
    loginIpAttempts.delete(ip);
    return null;
  }

  return null;
}

function registerFailedIpLogin(ip) {
  const now = Date.now();
  let record = loginIpAttempts.get(ip);

  if (
    !record ||
    now - record.firstAttempt >
      LOGIN_WINDOW_MS
  ) {
    record = {
      attempts: 0,
      firstAttempt: now,
      lockedUntil: 0
    };
  }

  record.attempts += 1;

  if (
    record.attempts >=
    LOGIN_IP_MAX_ATTEMPTS
  ) {
    record.lockedUntil =
      now + LOGIN_LOCK_MS;
  }

  loginIpAttempts.set(ip, record);

  return record;
}

function pruneLoginAttempts() {
  const now = Date.now();

  for (const [key, record] of loginAttempts) {
    const expiresAt = Math.max(
      record.firstAttempt + LOGIN_WINDOW_MS,
      record.lockedUntil || 0
    );

    if (expiresAt <= now) {
      loginAttempts.delete(key);
    }
  }

  for (const [ip, record] of loginIpAttempts) {
    const expiresAt = Math.max(
      record.firstAttempt + LOGIN_WINDOW_MS,
      record.lockedUntil || 0
    );

    if (expiresAt <= now) {
      loginIpAttempts.delete(ip);
    }
  }
}

function rawBody(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];

    req.on('data',chunk=>{
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );
    });

    req.on('end',()=>{
      resolve(Buffer.concat(chunks));
    });

    req.on('error',reject);
  });
}
function log(db,a,e,d){db.activity.unshift({id:uid('act'),at:new Date().toISOString(),action:a,entity:e,detail:d})}
function addHistory(db, data){
  if(!db.history) db.history = [];

  db.history.unshift({
    id: uid('his'),
    number: 'HIS-' + String(db.history.length + 1).padStart(6,'0'),
    createdAt: new Date().toISOString(),
    ...data
  });
}
function hasHistory(db, processId, title, sourceId){
  return (db.history || []).some(h =>
    h.processId === processId &&
    h.title === title &&
    (!sourceId || h.sourceId === sourceId)
  );
}

function clientMetrics(db, client){
  const matches=x=>x && (x.clientId===client.id || normalizeRut(x.rut||x.clientRut)===normalizeRut(client.rut) || (x.clientName||'').toLowerCase()===(client.name||'').toLowerCase());
  const orders=(db.sales_orders||[]).filter(matches);
  const quotes=(db.quotes||[]).filter(matches);
  const finance=(db.finance||[]).filter(matches);
  const now=Date.now(), days=n=>now-n*86400000;
  const recentOrders=orders.filter(x=>new Date(x.createdAt||0).getTime()>=days(90));
  const purchases30=orders.filter(x=>new Date(x.createdAt||0).getTime()>=days(30)).length;
  const purchases90=recentOrders.length;
  const total12m=orders.filter(x=>new Date(x.createdAt||0).getTime()>=days(365)).reduce((a,x)=>a+Number(x.total||0),0);
  const paid=finance.filter(x=>['Cobrado','Pagado'].includes(x.status)).length;
  const pending=finance.filter(x=>!['Cobrado','Pagado'].includes(x.status)).length;
  const paymentScore=finance.length?Math.round(paid/finance.length*100):70;
  const conversion=quotes.length?Math.round(orders.length/quotes.length*100):0;
  let score=Math.min(100, Math.round(25 + Math.min(purchases90*8,28) + Math.min(total12m/200000,25) + paymentScore*.18 + Math.min(conversion*.12,12)));
  let classification=score>=75?'A':score>=45?'B':'C';
  const notes=(db.client_notes||[]).filter(x=>x.clientId===client.id && x.status!=='Cerrada');
  const critical=notes.filter(x=>['Alta','Crítica'].includes(x.importance));
  let relationship=critical.some(x=>x.recommendedColor==='Rojo')?'Rojo':critical.some(x=>x.recommendedColor==='Naranjo')?'Naranjo':notes.some(x=>['Amarillo','Naranjo','Rojo'].includes(x.recommendedColor))?'Amarillo':'Verde';
  if(!orders.length&&!quotes.length&&!notes.length) relationship='Sin evaluar';
  const discountsSuspended=['Amarillo','Naranjo','Rojo'].includes(relationship) || pending>paid;
  const opportunities=[];
  if(purchases30>=3 && paymentScore>=85 && !discountsSuspended) opportunities.push('Proponer 5% de descuento en la próxima compra por alta frecuencia mensual.');
  else if(purchases90>=3 && paymentScore>=80 && !discountsSuspended) opportunities.push('Proponer beneficio comercial por 3 o más compras en 90 días.');
  if(classification==='A'&&!discountsSuspended) opportunities.push('Evaluar acceso a promoción exclusiva para clientes categoría A.');
  if(discountsSuspended) opportunities.push('Beneficios automáticos suspendidos hasta revisión ejecutiva.');
  return {classification,score,relationship,purchases30,purchases90,total12m,paymentScore,conversion,discountsSuspended,opportunities,notesCount:notes.length,trend:purchases30>=2?'Subiendo':purchases90>=2?'Estable':'Por evaluar'};
}
function addClientAudit(db, clientId, actor, action, detail){
  db.client_audit=db.client_audit||[];
  db.client_audit.unshift({id:uid('cau'),clientId,actorId:actor.id,actor:actor.name,action,detail,createdAt:new Date().toISOString()});
}

function dashboard(db){

  const processes = db.commercial_processes || [];
  const tasksData = db.tasks || [];
  const stockData = db.stock || [];
  const importsData = db.imports || [];
  const financeData = db.finance || [];

  const open = processes.filter(
    x => !['Perdido','Entregado','Cerrado'].includes(x.status)
  ).length;

  const tasks = tasksData.filter(
    x => x.status !== 'Hecha'
  ).length;

  const stock = stockData.filter(
    x => Number(x.available || 0) <= Number(x.minimum || 0)
  ).length;

  const imps = importsData.filter(
    x => x.status !== 'Entregada'
  ).length;

  const cxc = financeData
    .filter(x => x.type === 'Cobro' && x.status !== 'Cobrado')
    .reduce((s,x) => s + Number(x.amount || 0), 0);

  const cxp = financeData
    .filter(x => x.type === 'Pago' && x.status !== 'Pagado')
    .reduce((s,x) => s + Number(x.amount || 0), 0);

  const priorities = [];

  function commercialSemaphore(nextDate){

    if(!nextDate){
      return {
        level:'yellow',
        priority:'Media',
        label:'Sin fecha'
      };
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    const followup = new Date(nextDate + 'T00:00:00');
    followup.setHours(0,0,0,0);

    const diffDays =
      Math.round((followup - today) / 86400000);

    if(diffDays < 0){
      return {
        level:'red',
        priority:'Alta',
        label:
          'Vencido hace ' +
          Math.abs(diffDays) +
          (Math.abs(diffDays) === 1 ? ' día' : ' días')
      };
    }

    if(diffDays === 0){
      return {
        level:'yellow',
        priority:'Media',
        label:'Hoy'
      };
    }

    if(diffDays === 1){
      return {
        level:'yellow',
        priority:'Media',
        label:'Mañana'
      };
    }

    return {
      level:'green',
      priority:'Baja',
      label:'En ' + diffDays + ' días'
    };
  }

  /*
   * PROCESOS COMERCIALES
   * Una sola alerta por proceso.
   */
  processes
    .filter(x =>
      !['Perdido','Entregado','Cerrado'].includes(x.status)
    )
    .forEach(x => {

      const semaphore =
        commercialSemaphore(x.nextDate);

      priorities.push({
        priority: semaphore.priority,
        semaphoreLevel: semaphore.level,
        semaphoreLabel: semaphore.label,

        module:'Comercial',

        title:
          (x.clientName || 'Cliente') +
          ' - ' +
          (x.product || 'Proceso comercial'),

        detail:
          (x.nextAction || 'Sin próxima acción') +
          ' · ' +
          (x.nextDate || 'Sin fecha'),

        targetView:'commercial_processes',
        targetType:'commercial_process',
        targetId:x.id,

        processId:x.id,
        clientId:x.clientId || ''
      });
    });

  /*
   * STOCK CRITICO
   */
  stockData
    .filter(
      x =>
        Number(x.available || 0) <=
        Number(x.minimum || 0)
    )
    .forEach(x => {

      priorities.push({
        priority:'Alta',
        semaphoreLevel:'red',
        semaphoreLabel:'Stock crítico',

        module:'Stock',

        title:
          'Stock crítico: ' +
          (x.product || x.sku || 'Producto'),

        detail:
          'Disponible ' +
          (x.available || 0) +
          ' / mínimo ' +
          (x.minimum || 0),

        targetView:'stock',
        targetType:'stock',
        targetId:x.id
      });
    });

  /*
   * IMPORTACIONES
   */
  importsData
    .filter(
      x =>
        x.critical === 'Sí' ||
        ['Pago Tuvia','En aduana','Detenida']
          .includes(x.status)
    )
    .forEach(x => {

      priorities.push({
        priority:'Alta',
        semaphoreLevel:'red',
        semaphoreLabel:'Requiere acción',

        module:'Importaciones',

        title:
          (x.supplier || 'Proveedor') +
          ' - ' +
          (x.description || 'Importación'),

        detail:
          (x.status || '-') +
          ' · ETA ' +
          (x.eta || '-'),

        targetView:'imports',
        targetType:'import',
        targetId:x.id
      });
    });

  /*
   * TAREAS
   *
   * No repetimos las tareas automáticas de seguimiento
   * cuando ya existe el proceso comercial como fuente
   * principal del semáforo.
   */
  tasksData
    .filter(x => x.status !== 'Hecha')
    .filter(x => {
      const title =
        String(x.title || '').toLowerCase();

      return !title.startsWith(
        'seguimiento proceso:'
      );
    })
    .slice(0,10)
    .forEach(x => {

      const due = x.dueDate
        ? commercialSemaphore(x.dueDate)
        : {
            level:'yellow',
            priority:'Media',
            label:'Pendiente'
          };

      priorities.push({
        priority:due.priority,
        semaphoreLevel:due.level,
        semaphoreLabel:due.label,

        module:'Tareas',
        title:x.title || 'Tarea pendiente',

        detail:
          (x.owner || '-') +
          ' · ' +
          (x.dueDate || 'Sin fecha'),

        targetView:'tasks',
        targetType:'task',
        targetId:x.id
      });
    });

  return {
    health:
      Math.max(
        0,
        100 -
        open * 2 -
        tasks * 2 -
        stock * 10 -
        imps * 5
      ),

    kpis:{
      openProcesses:open,
      pendingTasks:tasks,
      criticalStock:stock,
      activeImports:imps,
      receivable:cxc,
      payable:cxp
    },

    priorities:priorities.slice(0,50)
  };
}

function demo(authUser){
  const now=new Date().toISOString();
  const preservedUser={...authUser};
  return {
    users:[preservedUser],
    roles:[{id:'r1',name:'Executive',permissions:['all']}],
    clients:[{id:'c1',name:'Juan Pérez',rut:'12.345.678-9',whatsapp:'+56911111111',email:'juan@email.com',discipline:'Rally',level:'Amateur',city:'Viña del Mar'}],
    inbox:[{id:'inb1',source:'WhatsApp Business',sender:'Contacto nuevo',message:'Consulta por producto',status:'Nuevo',owner:'Andrea',createdAt:now}],
    commercial_processes:[{id:'pc1',clientName:'Juan Pérez',product:'Casco Bell HP10',status:'Esperando Pago',value:780000,owner:'Andrea',nextDate:'',createdAt:now,source:'Demo'}],
    quotes:[],
    sales_orders:[],
    quote_items:[],
    history:[],
    products:[{id:'p1',sku:'BELL-HP10-M',name:'Casco Bell HP10',brand:'Bell',model:'HP10',category:'Casco',homologation:'FIA 8859-2024',material:'Fibra carbono',price:780000}],
    stock:[{id:'s1',product:'Guantes OMP talla M',sku:'OMP-GLOVE-M',available:1,minimum:3,location:'Bodega'}],
    imports:[{id:'i1',supplier:'OMP',description:'Buzos y guantes',status:'Pago Tuvia',critical:'Sí',eta:''}],
    tasks:[{id:'t1',title:'Seguimiento Juan Pérez - Casco Bell HP10',type:'Proceso Comercial',owner:'Andrea',dueDate:'',status:'Pendiente',createdAt:now}],
    finance:[{id:'f1',concept:'Cobro casco Juan Pérez',type:'Cobro',amount:780000,status:'Pendiente'},{id:'f2',concept:'Pago Tuvia embarque OMP',type:'Pago',amount:380000,status:'Pendiente'}],
    activity:[]
  };
}

function readWhatsAppConfig(){
  let file={};

  try{
    file=JSON.parse(
      fs.readFileSync(
        path.join(CONFIG_DIR,'whatsapp.local.json'),
        'utf8'
      )
    );
  }catch{}

  return {
    verifyToken:
      process.env.WHATSAPP_VERIFY_TOKEN ||
      file.verifyToken ||
      '',

    appSecret:
      process.env.WHATSAPP_APP_SECRET ||
      file.appSecret ||
      ''
  };
}

function createWhatsAppInboxItem(db,inbound){

  db.inbox=db.inbox||[];
  db.activity=db.activity||[];

  const duplicate=(db.inbox||[]).find(item =>
    inbound.providerMessageId &&
    item.providerMessageId===inbound.providerMessageId
  );

  if(duplicate){
    return {
      item:duplicate,
      duplicate:true
    };
  }

  const item={
    id:uid('inb'),
    number:nextNumber(db,'inbox'),
    createdAt:new Date().toISOString(),

    source:inbound.source||'WhatsApp Business',
    sender:inbound.sender||'Contacto WhatsApp',
    whatsapp:inbound.whatsapp||'',
    email:'',
    message:inbound.message||'',

    status:'Nuevo',
    owner:'Andrea',

    provider:inbound.provider||'Meta Cloud API',
    providerMessageId:inbound.providerMessageId||'',
    providerTimestamp:inbound.providerTimestamp||'',
    messageType:inbound.messageType||'text',
    phoneNumberId:inbound.phoneNumberId||'',
    displayPhoneNumber:inbound.displayPhoneNumber||'',
    rawContextId:inbound.rawContextId||''
  };

  db.inbox.unshift(item);

  const automationResult=
    runCreationAutomations(
      db,
      {
        event:'record.created',
        collection:'inbox',
        item
      },
      {
        uid,
        log
      }
    );

  log(
    db,
    'whatsapp_inbound',
    'inbox',
    'Mensaje WhatsApp recibido ' +
      (item.providerMessageId||item.id)
  );

  return {
    item,
    duplicate:false,
    automationResult
  };
}

async function whatsappWebhook(req,res){

  const config=readWhatsAppConfig();

  if(req.method==='GET'){

    const url=
      new URL(
        req.url,
        'http://localhost'
      );

    const query=
      Object.fromEntries(
        url.searchParams.entries()
      );

    const verification=
      verifyWebhookChallenge(
        query,
        config.verifyToken
      );

    console.log(
      '[WA WEBHOOK] verification',
      {
        ok:verification.ok
      }
    );

    if(!verification.ok){
      res.writeHead(403,{
        'Content-Type':'text/plain; charset=utf-8'
      });

      return res.end('Forbidden');
    }

    res.writeHead(200,{
      'Content-Type':'text/plain; charset=utf-8'
    });

    return res.end(
      String(verification.challenge||'')
    );
  }

  if(req.method==='POST'){

    try{

      const raw=
        await rawBody(req);

      const signature=
        String(
          req.headers['x-hub-signature-256']||
          ''
        );

      const signatureOk=
        verifyMetaSignature(
          raw,
          signature,
          config.appSecret
        );

      console.log(
        '[WA WEBHOOK] signature',
        {
          ok:signatureOk,
          bytes:raw.length
        }
      );

      if(!signatureOk){
        return js(
          res,
          401,
          {
            error:'Firma de Meta inválida.'
          }
        );
      }

      let payload={};

      try{
        payload=
          JSON.parse(
            raw.toString('utf8')||'{}'
          );
      }catch{
        return js(
          res,
          400,
          {
            error:'Payload JSON inválido.'
          }
        );
      }

      const inboundMessages=
        extractInboundMessages(payload);

      if(!inboundMessages.length){
        return js(
          res,
          200,
          {
            ok:true,
            received:0
          }
        );
      }

      const db=readDB();

      const results=
        inboundMessages.map(inbound =>
          createWhatsAppInboxItem(
            db,
            inbound
          )
        );

      writeDB(db);

      const received=
        results.filter(
          result=>!result.duplicate
        ).length;

      const duplicates=
        results.filter(
          result=>result.duplicate
        ).length;

      console.log(
        '[WA WEBHOOK] stored',
        {
          received,
          duplicates,
          inboxIds:
            results.map(
              result=>result.item.id
            )
        }
      );

      return js(
        res,
        200,
        {
          ok:true,
          received,
          duplicates,
          inboxIds:
            results.map(
              result=>result.item.id
            )
        }
      );

    }catch(error){

      console.error(
        '[WA WEBHOOK] error',
        error
      );

      return js(
        res,
        500,
        {
          error:
            'Error procesando WhatsApp.'
        }
      );
    }
  }

  return js(
    res,
    405,
    {
      error:'Method not allowed'
    }
  );
}

function isAllowedApiOrigin(req) {
  const origin = String(
    req.headers.origin || ''
  ).trim();

  /*
   * Permitimos ausencia de Origin para:
   * - curl
   * - tests
   * - herramientas internas
   *
   * Las peticiones del navegador sí serán
   * validadas contra el host actual.
   */
  if (!origin) {
    return true;
  }

  const forwardedProto =
    String(
      req.headers['x-forwarded-proto'] ||
      ''
    )
      .split(',')[0]
      .trim();

  const protocol =
    forwardedProto ||
    (req.socket?.encrypted
      ? 'https'
      : 'http');

  const forwardedHost =
    String(
      req.headers['x-forwarded-host'] ||
      ''
    )
      .split(',')[0]
      .trim();

  const host =
    forwardedHost ||
    String(req.headers.host || '')
      .trim();

  if (!host) {
    return false;
  }

  const expectedOrigin =
    `${protocol}://${host}`;

  return origin === expectedOrigin;
}

async function api(req,res){
   const stateChangingMethods =
    new Set([
      'POST',
      'PUT',
      'PATCH',
      'DELETE'
    ]);

  if (
    stateChangingMethods.has(req.method) &&
    !isAllowedApiOrigin(req)
  ) {
    return js(res,403,{
      error:'Origen de solicitud no permitido'
    });
  } 
  let db=readDB(),parts=req.url.split('?')[0].split('/').filter(Boolean),c=parts[1],id=parts[2];
  const automationsChanged = runAutomations(db, { uid });

if(automationsChanged){
  writeDB(db);
}
  if(migrateUsers(db)) writeDB(db);
if(c==='login'&&req.method==='POST'){
  const b=await body(req);

  const email=String(b.email||'')
    .trim()
    .toLowerCase();

  const loginKey =
    getLoginAttemptKey(
     req,
      email
    );

  const loginIp =
    getClientIp(req);

  pruneLoginAttempts();

  const activeLock =
    getLoginLock(loginKey);

  const activeIpLock =
    getIpLoginLock(loginIp);

  if (activeLock || activeIpLock) {
    const lockedUntil = Math.max(
      activeLock?.lockedUntil || 0,
      activeIpLock?.lockedUntil || 0
    );

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (lockedUntil - Date.now()) / 1000
      )
    );

    res.setHeader(
      'Retry-After',
      String(retryAfterSeconds)
    );

    return js(res,429,{
      error:
        'Demasiados intentos de acceso. Intenta nuevamente más tarde.'
    });
  }
  const u=(db.users||[]).find(
    x=>String(x.email||'').trim().toLowerCase()===email &&
       x.status!=='Inactivo'
  );

  const dummyPasswordHash =
    '854529441deefdd2a914520c89c2965a:1a31a547b470c7adb6bff6734892e3e3998e89d752978795796801378428b6c48531f4035ddaed46e7f664cf6245210e61cbdfbdd2183e48f940e6cb69421753';

  const passwordValid =
    verifyPassword(
      b.password,
      u
        ? u.passwordHash
        : dummyPasswordHash
    );

  if(!u || !passwordValid){
    registerFailedLogin(loginKey);
    registerFailedIpLogin(loginIp);
    log(
      db,
      'login_failed',
      'users',
      'Intento fallido '+(email||'sin email')
    );

    writeDB(db);

    return js(res,401,{
      error:'Credenciales inválidas'
    });
  }
  clearFailedLogins(loginKey);

  const session=createSession(u);

  res.setHeader(
    'Set-Cookie',
    createSessionCookie(
      session.token,
      session.expiresAt
    )
  );

  log(db,'login','users','Ingreso '+u.email);
  writeDB(db);

  return js(res,200,{
  ok:true,
  user:sanitizeUser(u),
  expiresAt:session.expiresAt
});
}

if(c==='logout'&&req.method==='POST'){
  revokeSession(req);

  res.setHeader(
    'Set-Cookie',
    clearSessionCookie()
  );

  return js(res,200,{ok:true});
}
  const session=getSession(req);
  if(!session)return js(res,401,{error:'Sesión inválida o vencida'});
  const authUser=(db.users||[]).find(
    x =>
      x.id === session.userId &&
      x.status !== 'Inactivo'
  );

  if(!authUser){
    revokeSession(req);

    res.setHeader(
      'Set-Cookie',
      clearSessionCookie()
    );

    return js(res,401,{
      error:'Usuario no disponible'
    });
  }
  if(c==='me'&&req.method==='GET')return js(res,200,{user:sanitizeUser(authUser),session:{createdAt:session.createdAt,expiresAt:session.expiresAt}});
  if(c==='identity'&&req.method==='GET')return js(res,200,{organization:authUser.organization||'Gabutti Corse',people:(db.users||[]).map(sanitizeUser),roles:db.roles||[],accessLog:(db.activity||[]).filter(x=>['login','login_failed','logout'].includes(x.action)).slice(0,25)});
  if(c==='dashboard'&&req.method==='GET')return js(res,200,dashboard(db));
  if(c==='motorsport' && id==='news' && req.method==='GET'){
    try{
      const items = await getTodayMotorsportNews(12);

      return js(res,200,{
        ok:true,
        updatedAt:new Date().toISOString(),
        items
      });

    }catch(error){
      console.error('Motorsport LIVE error:', error);

      return js(res,503,{
        ok:false,
        error:'No fue posible actualizar Motorsport LIVE.',
        items:[]
      });
    }
  }

if(c==='rut-lookup' && req.method==='GET'){
  const rut = decodeURIComponent(id || '');

  try{
 const result = await lookupTaxpayer({
  db,
  rut,
  actor: authUser.name,

  validateRut: validRut,
  normalizeRut,
  formatRut,
  findClientByRut,

  lookupLibreDte: getTaxpayerByRut,
  lookupSre: lookupCompanyFromProvider,

  saveTaxRecord: (record, actorName, source) => {
    const saved = upsertTaxDirectory(
      db,
      record,
      actorName,
      source
    );

    writeDB(db);

    return saved;
  }
});

    return js(res, result.status || 200, result);

  }catch(error){

    console.error('Tax Lookup Error:', error);

    return js(res,500,{
      valid:false,
      error:'Error interno consultando datos tributarios.',
      detail:error.message
    });

  }
}
  if(c==='rut-refresh'&&req.method==='POST'){
    if(authUser.role!=='Executive')return js(res,403,{error:'Acceso exclusivo Executive'});
    const rut=decodeURIComponent(id||'');
    if(!validRut(rut))return js(res,400,{error:'RUT inválido'});
    try{
      const remote=await lookupCompanyFromProvider(rut);
      if(!remote)return js(res,404,{error:'SRE no encontró información para este RUT.'});
      const saved=upsertTaxDirectory(db,remote,authUser.name);
      const client=findClientByRut(db,rut);
      if(client){
        client.businessName=saved.businessName||client.businessName;
        client.businessActivity=saved.businessActivity||client.businessActivity;
        client.taxAddress=saved.address||client.taxAddress;
        client.taxRegion=saved.region||client.taxRegion;
        client.taxComuna=saved.city||saved.comuna||client.taxComuna;
        client.email=saved.email||saved.dteEmail||client.email;
        client.whatsapp=saved.phone||client.whatsapp;
        client.taxLastSyncedAt=saved.lastSyncedAt;
        client.taxSource='Base Tributaria Gabutti';
        addClientAudit(db,client.id,authUser,'Datos tributarios actualizados','Sincronización manual desde SRE');
      }
      writeDB(db);return js(res,200,{ok:true,data:saved,clientUpdated:!!client});
    }catch(error){
      db.tax_sync_log=db.tax_sync_log||[];db.tax_sync_log.unshift({id:uid('tsl'),rut:formatRut(rut),status:'Error',source:'SRE',actor:authUser.name,detail:error.message,createdAt:new Date().toISOString()});writeDB(db);
      return js(res,503,{error:'No fue posible actualizar desde SRE.',detail:error.message});
    }
  }
  if(c==='development-reset'&&req.method==='POST'){
    if(
      String(process.env.RAILWAY_ENVIRONMENT||'')
        .toLowerCase()==='production'
    ){
      return js(res,404,{error:'not found'});
    }

    if(authUser.role!=='Executive'){
      return js(res,403,{
        error:'Acceso exclusivo Executive'
      });
    }

    ['clients','client_contacts','client_addresses','client_notes','client_alerts','client_ai_evaluations','client_audit','client_scores','inbox','inbox_analysis','commercial_processes','quotes','quote_items','sales_orders','history','tasks','finance','activity'].forEach(k=>db[k]=[]);
    db.counters={...(db.counters||{}),CLI:0};
    writeDB(db);
    return js(res,200,{ok:true,nextClientNumber:'CLI-000001'});
  }

  if(c==='client-intelligence'&&req.method==='GET'){
    const client=(db.clients||[]).find(x=>x.id===id);
    if(!client)return js(res,404,{error:'Cliente no encontrado'});
    const metrics=clientMetrics(db,client);
    return js(res,200,{clientId:id,...metrics,notes:(db.client_notes||[]).filter(x=>x.clientId===id),alerts:(db.client_alerts||[]).filter(x=>x.clientId===id),audit:(db.client_audit||[]).filter(x=>x.clientId===id).slice(0,50)});
  }
  if(c==='client-note'&&req.method==='POST'){
    if(authUser.role!=='Executive')return js(res,403,{error:'Acceso exclusivo Executive'});
    const client=(db.clients||[]).find(x=>x.id===id);
    if(!client)return js(res,404,{error:'Cliente no encontrado'});
    const b=await body(req);
    const note={id:uid('cnt'),clientId:id,text:String(b.text||'').trim(),importance:b.importance||'Media',recommendedColor:b.recommendedColor||'Amarillo',status:'Activa',authorId:authUser.id,author:authUser.name,createdAt:new Date().toISOString(),reviewAt:b.reviewAt||''};
    if(!note.text)return js(res,400,{error:'La nota no puede estar vacía'});
    db.client_notes=db.client_notes||[];db.client_notes.unshift(note);
    addClientAudit(db,id,authUser,'Nota ejecutiva creada',note.importance+' · '+note.recommendedColor);
    writeDB(db);return js(res,201,note);
  }
  if(c==='db'&&req.method==='GET'){const safeDb={...db,users:(db.users||[]).map(sanitizeUser)};return js(res,200,safeDb);}
  if(c==='demo'&&req.method==='POST'){return js(res,403,{ok:false,error:'Demo deshabilitado'})}
  if(c==='whatsapp-send' && req.method==='POST'){
  const inbox = (db.inbox || []).find(item => item.id === id);

  if(!inbox){
    return js(res,404,{error:'Entrada de Inbox no encontrada.'});
  }

  const requestBody = await body(req);
  const message = String(requestBody.message || '').trim();

  if(!message){
    return js(res,400,{error:'El mensaje no puede estar vacío.'});
  }

  if(!inbox.whatsapp){
    return js(res,400,{error:'La entrada no tiene número de WhatsApp.'});
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    inbox.phoneNumberId ||
    '';

  try{
    const result = await sendTextMessage({
      accessToken,
      phoneNumberId,
      to: inbox.whatsapp,
      text: message
    });

    db.activity = db.activity || [];
    db.activity.unshift({
      id: uid('act'),
      at: new Date().toISOString(),
      action: 'whatsapp_outbound',
      entity: 'inbox',
      detail:
        `Mensaje enviado por ${authUser.name} a ${inbox.whatsapp} ` +
        `desde ${inbox.id} · ${result.messageId || 'sin messageId'}`
    });

    inbox.lastWhatsappReplyAt = new Date().toISOString();
    inbox.lastWhatsappReplyBy = authUser.name;
    inbox.lastWhatsappReplyMessage = message;
    inbox.lastWhatsappMessageId = result.messageId || '';

    writeDB(db);

    return js(res,200,{
      ok:true,
      messageId:result.messageId || '',
      recipient:result.recipient
    });

  }catch(error){
    console.error('WhatsApp outbound error:', error);

    return js(res,error.status || 500,{
      error:error.message || 'No fue posible enviar el WhatsApp.',
      detail:error.response || null
    });
  }
}
  if(!cols.includes(c))return js(res,404,{error:'not found'});
  if(req.method==='GET')return js(res,200,id?(db[c].find(x=>x.id===id)||{}):db[c]);
  if(req.method==='PUT'){
    const requestBody = await body(req);
    const index = db[c].findIndex(item => item.id === id);

    if(index === -1){
      return js(res,404,{error:'not found'});
    }

    db[c][index] = {
      ...db[c][index],
      ...requestBody
    };

    const updatedItem = db[c][index];
    if(c==='clients') addClientAudit(db,id,authUser,'Ficha actualizada',Object.keys(requestBody).join(', '));


    if(
      c === 'quotes' &&
      requestBody.status === 'Enviada'
    ){
      const process = (db.commercial_processes || []).find(item =>
        item.id === updatedItem.processId
      );

      const sentAt =
        updatedItem.sentAt ||
        new Date().toISOString();

      updatedItem.sentAt = sentAt;

      const followupDate = new Date(sentAt);
      followupDate.setDate(followupDate.getDate() + 3);

      const nextDate =
        followupDate.toISOString().slice(0,10);

      const isExtension =
        updatedItem.quoteType === 'Ampliación';

      if(process && !isExtension){
        process.status = 'Cotización enviada';
        process.nextAction = 'Hacer seguimiento';
        process.nextDate = nextDate;
        process.updatedAt = new Date().toISOString();
      }

      if(process && isExtension){
        process.updatedAt = new Date().toISOString();
      }

      if(
        !hasHistory(
          db,
          updatedItem.processId,
          'Cotización enviada',
          updatedItem.id
        )
      ){
        addHistory(db,{
          processId: updatedItem.processId || '',
          clientId: updatedItem.clientId || '',
          clientName: updatedItem.clientName || '',
          type: 'Cotización',
          title: 'Cotización enviada',
          description:
            `${updatedItem.number || updatedItem.id} enviada al cliente`,
          sourceId: updatedItem.id
        });
      }

      log(
        db,
        'update',
        c,
        `Cotización enviada al cliente ${updatedItem.id}`
      );

      writeDB(db);

      return js(res,200,{
        quote: updatedItem,
        process
      });
    }

    if(c === 'quotes' && requestBody.status === 'Aceptada'){
      db.sales_orders = db.sales_orders || [];

      let order = db.sales_orders.find(item =>
        item.quoteId === updatedItem.id
      );

      if(!order){
        order = {
          id: uid('sal'),
          number:
            'PV-' +
            String(db.sales_orders.length + 1).padStart(6,'0'),
          createdAt: new Date().toISOString(),
          quoteId: updatedItem.id,
          processId: updatedItem.processId || '',
          clientId: updatedItem.clientId || '',
          clientName: updatedItem.clientName || '',
          product: updatedItem.product || '',
          quantity: updatedItem.quantity || 1,
          unitPrice: updatedItem.unitPrice || 0,
          total:
            Number(updatedItem.quantity || 1) *
            Number(updatedItem.unitPrice || 0),
          status: 'Pendiente',
          owner: updatedItem.owner || 'Andrea'
        };

        db.sales_orders.unshift(order);

        if(
          !hasHistory(
            db,
            updatedItem.processId,
            'Pedido de venta creado',
            order.id
          )
        ){
          addHistory(db,{
            processId: updatedItem.processId || '',
            type: 'Pedido de Venta',
            title: 'Pedido de venta creado',
            description:
              `${order.number || order.id} creado desde ` +
              `${updatedItem.number || updatedItem.id}`,
            sourceId: order.id
          });
        }
      }

      const process = (db.commercial_processes || []).find(item =>
        item.id === updatedItem.processId
      );

      const isExtension =
        updatedItem.quoteType === 'Ampliación';

      if(process && !isExtension){
        const now = new Date().toISOString();

        process.status = 'Ganado';
        process.nextAction = '';
        process.nextDate = '';
        process.closedAt = process.closedAt || now;
        process.updatedAt = now;
      }

      if(process && isExtension){
        process.updatedAt = new Date().toISOString();
      }

      if(
        !hasHistory(
          db,
          updatedItem.processId,
          'Cotización aceptada',
          updatedItem.id
        )
      ){
        addHistory(db,{
          processId: updatedItem.processId || '',
          type: 'Cotización',
          title: 'Cotización aceptada',
          description:
            `${updatedItem.number || updatedItem.id} fue aceptada`,
          sourceId: updatedItem.id
        });
      }

      log(
        db,
        'update',
        c,
        `Cotización aceptada ${updatedItem.id}`
      );

      writeDB(db);

      return js(res,200,{
        quote: updatedItem,
        order
      });
    }


    if(
      c === 'quotes' &&
      requestBody.status === 'Rechazada'
    ){
      const process = (db.commercial_processes || []).find(item =>
        item.id === updatedItem.processId
      );

      const isExtension =
        updatedItem.quoteType === 'Ampliación';

      if(process && !isExtension){
        process.status = 'Perdido';
        process.closedAt = new Date().toISOString();
        process.closeReason =
          String(requestBody.rejectionReason || '').trim() ||
          'Cotización rechazada';
      }

      if(process && isExtension){
        process.updatedAt = new Date().toISOString();
      }

      if(
        !hasHistory(
          db,
          updatedItem.processId,
          'Cotización rechazada',
          updatedItem.id
        )
      ){
        addHistory(db,{
          processId: updatedItem.processId || '',
          clientId: updatedItem.clientId || '',
          clientName: updatedItem.clientName || '',
          type: 'Cotización',
          title: 'Cotización rechazada',
          description:
            `${updatedItem.number || updatedItem.id} fue rechazada` +
            (String(requestBody.rejectionReason || '').trim()
              ? ` · Motivo: ${String(requestBody.rejectionReason).trim()}`
              : ''),
          sourceId: updatedItem.id
        });
      }

      log(
        db,
        'update',
        c,
        `Cotización rechazada ${updatedItem.id}`
      );

      writeDB(db);

      return js(res,200,{
        quote: updatedItem,
        process
      });
    }

    if(
      c === 'sales_orders' &&
      requestBody.status === 'Stock reservado'
    ){
      const order = updatedItem;

      if(order.stockReserved){
        return js(res,400,{
          error:'Este pedido ya tiene stock reservado.'
        });
      }

      const stock = (db.stock || []).find(item =>
        (item.product || '')
          .toLowerCase()
          .includes((order.product || '').toLowerCase())
      );

      if(!stock){
        return js(res,400,{
          error:'No existe stock para este producto.'
        });
      }

      const requestedQuantity = Number(order.quantity || 1);
      const availableQuantity = Number(stock.available || 0);

      if(availableQuantity < requestedQuantity){
        return js(res,400,{
          error:'Stock insuficiente.'
        });
      }

      stock.available = availableQuantity - requestedQuantity;
      order.stockReserved = true;
      order.stockReservedAt = new Date().toISOString();
      order.status = 'Stock reservado';

      if(
        !hasHistory(
          db,
          order.processId,
          'Stock reservado',
          order.id
        )
      ){
        addHistory(db,{
          processId: order.processId || '',
          type: 'Stock',
          title: 'Stock reservado',
          description:
            `Se reservó stock para ${order.number || order.id}`,
          sourceId: order.id
        });
      }
    }

    log(db,'update',c,`Actualizado ${id}`);
    writeDB(db);

    return js(res,200,updatedItem);
  }

  if(req.method==='DELETE'){
    const index = db[c].findIndex(item => item.id === id);

    if(index === -1){
      return js(res,404,{error:'not found'});
    }

    const deleted = db[c][index];

    db[c].splice(index,1);

    log(db,'delete',c,`Eliminado ${id}`);
    writeDB(db);

    return js(res,200,{
      ok:true,
      deleted
    });
  }

  if(req.method==='POST'){
    const requestBody = await body(req);

    if(c==='clients'){
      if(!validRut(requestBody.rut||'')) return js(res,400,{error:'El RUT ingresado no es válido.'});
      const duplicate=findClientByRut(db,requestBody.rut);
      if(duplicate) return js(res,409,{error:'Este RUT ya existe.',existingClient:duplicate});
      requestBody.rut=formatRut(requestBody.rut);
      requestBody.status=requestBody.status||'Activo';
      requestBody.owner=requestBody.owner||authUser.name;
      requestBody.relationshipStatus=requestBody.relationshipStatus||'Sin evaluar';
      requestBody.commercialClassification='C';
      const tax=(db.tax_directory||[]).find(x=>normalizeRut(x.rut)===normalizeRut(requestBody.rut));
      if(tax){
        // Respaldo del servidor: completa cualquier campo básico omitido por el navegador.
        requestBody.name=requestBody.name||tax.name||tax.businessName||'';
        requestBody.businessName=requestBody.businessName||tax.businessName||tax.name||'';
        requestBody.businessActivity=requestBody.businessActivity||tax.businessActivity||'';
        requestBody.taxAddress=requestBody.taxAddress||tax.address||'';
        requestBody.taxRegion=requestBody.taxRegion||tax.region||'';
        requestBody.taxComuna=requestBody.taxComuna||tax.comuna||tax.city||'';
        requestBody.email=requestBody.email||tax.email||tax.dteEmail||'';
        requestBody.whatsapp=requestBody.whatsapp||tax.phone||'';
        requestBody.taxSource='Base Tributaria Gabutti';
        requestBody.taxLastSyncedAt=tax.lastSyncedAt||tax.updatedAt||'';
      }
      if(!String(requestBody.name||'').trim())return js(res,400,{error:'No fue posible determinar el nombre del cliente. Revisa la razón social o escribe un nombre comercial.'});
    }

    const item = createRecord({
      db,
      collection: c,
      body: requestBody,
      uid,
      nextNumber,
      addHistory: data => addHistory(db, data),
      hasHistory: (processId, title, sourceId) =>
        hasHistory(db, processId, title, sourceId),
      log
    });

    if(c==='clients') addClientAudit(db,item.id,authUser,'Cliente creado',item.number+' · '+item.name);

    runCreationAutomations(
      db,
      {
        event: 'record.created',
        collection: c,
        item
      },
      {
        uid,
        log
      }
    );

    writeDB(db);
    return js(res,201,item);
  }
  return js(res,405,{error:'method'});}
function serve(req,res){
  let u=decodeURIComponent(req.url.split('?')[0]);
  if(u==='/')u='/index.html';

  if(
    u.toLowerCase().includes('.bak') ||
    u.includes('/.')
  ){
    return js(res,404,{error:'not found'});
  }

  let f=path.join(WEB,u);
  if(!f.startsWith(WEB))return js(res,403,{error:'forbidden'});
  fs.readFile(f,(e,d)=>{
    if(e)return js(res,404,{error:'not found'});
    let ct=f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html';
    res.writeHead(200,{
      'Content-Type':ct+'; charset=utf-8',
      'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':'no-cache',
      'Expires':'0'
    });
    res.end(d);
  });
}
http.createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');

  const pathname=req.url.split('?')[0];

  if(pathname==='/webhooks/whatsapp'){
    return whatsappWebhook(req,res);
  }

  if(req.url.startsWith('/api/')){
    return api(req,res).catch(error=>{
      if(res.headersSent){
        return res.end();
      }

      if(error && error.status===413){
        return js(res,413,{
          error:'Payload demasiado grande'
        });
      }

      console.error(
        'API request error:',
        error
      );

      return js(res,500,{
        error:'Error interno del servidor'
      });
    });
  }

  return serve(req,res);

}).listen(
  PORT,
  ()=>console.log(
    'GS ONE v0.8.2 · Dashboard V3 running at http://localhost:'+PORT
  )
);
