const { request } = require("./libredte.client");
const { mapTaxpayer } = require("./libredte.mapper");

async function getTaxpayerByRut(rut) {
  if (!rut) {
    throw new Error("Debe indicar un RUT.");
  }

  const rawRut = String(rut)
  .trim()
  .replace(/\./g, "")
  .replace(/-/g, "");

const cleanRut = rawRut.length >= 2
  ? `${rawRut.slice(0, -1)}-${rawRut.slice(-1)}`
  : rawRut;
  const response = await request(
    `/api/dte/contribuyentes/info/${encodeURIComponent(cleanRut)}`
  );

  return mapTaxpayer(response);
}

module.exports = {
  getTaxpayerByRut,
};