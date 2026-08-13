const PREFIX = {
  clients: "CLI",
  quotes: "COT",
  sales_orders: "PV",
  purchase_orders: "OC",
  imports: "IMP",
  products: "PRO",
  stock: "STK",
  finance: "FIN"
};

function nextNumber(db, collection) {
  if (!db.counters) {
    db.counters = {};
  }

  const prefix = PREFIX[collection] || collection.substring(0, 3).toUpperCase();

  if (typeof db.counters[prefix] !== "number") {
    db.counters[prefix] = 0;
  }

  db.counters[prefix]++;

  return `${prefix}-${String(db.counters[prefix]).padStart(6, "0")}`;
}

module.exports = {
  nextNumber
};