function money(n){return '$'+Number(n||0).toLocaleString('es-CL')}
function tag(t,c=''){return `<span class="tag ${c}">${t||'-'}</span>`}
function rec(t,m='',tags=''){return `<div class="rec"><h3>${t}</h3><div>${tags}</div><div class="meta">${m}</div></div>`}
async function api(path,opt={}){let r=await fetch(path,{headers:{'Content-Type':'application/json'},...opt});return await r.json()}
function activateView(viewId){document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');document.getElementById(viewId)?.classList.add('active')}
