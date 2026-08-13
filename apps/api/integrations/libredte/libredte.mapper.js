const catalogs = require('../../catalogs');

function mapTaxpayer(data) {
  if (!data) {
    return null;
  }

  const commune = catalogs.service.getCommune(data.comuna);

  return {
    rut: data.rut || "",
    razonSocial: data.razon_social || "",
    nombreFantasia: data.nombre_fantasia || "",
    giro: data.giro || "",
    direccion: data.direccion || "",

    comuna: commune?.name || data.comuna_glosa || data.comuna || "",
    provincia: commune?.province || "",
    region: commune?.region || "",
    codigoComuna: commune?.code || data.comuna || "",

    ciudad: data.ciudad || "",
    telefono: data.telefono || "",
    email: data.email || "",
    origen: "LibreDTE",
    fechaConsulta: new Date().toISOString(),
  };
}

module.exports = {
  mapTaxpayer,
};