/* =========================================================
   GS ONE · IMPORTACIONES
   Integración módulo José
   ========================================================= */

let importProductsPage = 1;

function renderImports(importsData = []) {
  const list = document.getElementById('importsList');
  const summary = document.getElementById('importsSummary');

  if (!list) return;

  if (summary) {
    summary.innerHTML = `
      <div class="meta">
        ${importsData.length} importación${importsData.length === 1 ? '' : 'es'}
      </div>
    `;
  }

  list.innerHTML =
    importsData
      .map(importItem =>
        rec(
          `${importItem.supplier || 'Proveedor'} — ${importItem.description || 'Importación'}`,
          `${importItem.status || '-'} · ETA ${importItem.eta || '-'}`,
          tag(
            importItem.critical === 'Sí' ? 'Crítica' : 'Normal',
            importItem.critical === 'Sí' ? 'red' : 'green'
          )
        )
      )
      .join('') ||
    '<p class="meta">Sin importaciones.</p>';
}

function showImportTab(tab) {
  const panels = {
    orders: 'importsOrdersPanel',
    catalog: 'importsCatalogPanel',
    costing: 'importsCostingPanel'
  };

  document.querySelectorAll('.imports-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  document.querySelectorAll('.imports-tab').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.importTab === tab
    );
  });

  const panel = document.getElementById(panels[tab]);
  if (panel) panel.classList.remove('hidden');
}

function openImportOrderForm() {
  openForm('imports');
}
