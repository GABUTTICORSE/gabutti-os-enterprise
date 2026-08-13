function renderLists(){
  if(typeof renderDashboard === 'function') renderDashboard();
  if(typeof renderClientsList === 'function') renderClientsList();
  if(typeof renderCommercialProcesses === 'function') renderCommercialProcesses();
  if(typeof renderQuotes === 'function') renderQuotes();
  if(typeof renderSalesOrders === 'function') renderSalesOrders();
  if(typeof renderProducts === 'function') renderProducts();
  if(typeof renderStock === 'function') renderStock();
  if(typeof renderImports === 'function') renderImports();
  if(typeof renderTasks === 'function') renderTasks();
  if(typeof renderFinance === 'function') renderFinance();
  if(typeof renderActivity === 'function') renderActivity();
}