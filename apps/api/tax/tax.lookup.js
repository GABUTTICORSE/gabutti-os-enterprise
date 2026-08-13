/**
 * Motor de búsqueda tributaria de GS ONE.
 *
 * Este módulo no conoce directamente la base de datos ni los proveedores.
 * Recibe las funciones necesarias desde server.js para evitar dependencias
 * circulares y permitir agregar nuevos proveedores en el futuro.
 */

function isCompleteTaxRecord(record) {
  if (!record) return false;

  const businessName =
    record.businessName ||
    record.razonSocial ||
    record.name;

  const businessActivity =
    record.businessActivity ||
    record.giro;

  const address =
    record.address ||
    record.taxAddress ||
    record.direccion;

  const email =
    record.email ||
    record.dteEmail;

  return Boolean(
    businessName &&
    businessActivity &&
    address &&
    email
  );
}

function normalizeProviderRecord(record, provider, rut) {
  if (!record) return null;

  return {
    ...record,

    rut:
      record.rut ||
      rut,

    name:
      record.name ||
      record.businessName ||
      record.razonSocial ||
      "",

    businessName:
      record.businessName ||
      record.razonSocial ||
      record.name ||
      "",

    businessActivity:
      record.businessActivity ||
      record.giro ||
      "",

    address:
      record.address ||
      record.direccion ||
      record.taxAddress ||
      "",

    comuna:
      record.comuna ||
      record.taxComuna ||
      "",

    city:
      record.city ||
      record.ciudad ||
      record.comuna ||
      "",

    region:
      record.region ||
      record.taxRegion ||
      "",

    email:
      record.email ||
      record.correo ||
      "",

    dteEmail:
      record.dteEmail ||
      record.emailDte ||
      "",

    phone:
      record.phone ||
      record.telefono ||
      record.whatsapp ||
      "",

    source: provider,
    provider,
    providerRaw: record.providerRaw || record,
  };
}

function serializeProviderError(provider, error) {
  return {
    provider,
    code: error?.code || "PROVIDER_ERROR",
    status: error?.status || 503,
    message:
      error?.message ||
      `No fue posible consultar ${provider}.`,
  };
}

async function lookupTaxpayer(options = {}) {
  const {
    rut,
    actor = "Sistema",

    validateRut,
    formatRut,

    findExistingClient,
    findLocalRecord,

    lookupLibreDte,
    lookupSre,

    saveTaxRecord,
  } = options;

  if (!rut) {
    return {
      status: 400,
      valid: false,
      error: "Debe indicar un RUT.",
    };
  }

  if (typeof validateRut !== "function") {
    throw new Error(
      "Motor tributario mal configurado: falta validateRut."
    );
  }

  if (!validateRut(rut)) {
    return {
      status: 400,
      valid: false,
      error: "RUT inválido.",
    };
  }

  const formattedRut =
    typeof formatRut === "function"
      ? formatRut(rut)
      : rut;

  /*
   * 1. Verificar si el RUT ya pertenece a un cliente.
   */

  if (typeof findExistingClient === "function") {
    const existingClient = await findExistingClient(rut);

    if (existingClient) {
      return {
        status: 200,
        valid: true,
        existing: true,
        client: existingClient,
        rut: formattedRut,
        source: "clients",
        providerErrors: [],
      };
    }
  }

  /*
   * 2. Consultar el directorio tributario local.
   */

  if (typeof findLocalRecord === "function") {
    const localRecord = await findLocalRecord(rut);

    if (localRecord && isCompleteTaxRecord(localRecord)) {
      return {
        status: 200,
        valid: true,
        existing: false,
        found: true,
        data: localRecord,
        rut: formattedRut,
        source: "local",
        providerErrors: [],
      };
    }
  }

  const providerErrors = [];

  /*
   * 3. Consultar LibreDTE.
   *
   * Por ahora esta función será opcional. Si LibreDTE no está
   * configurado o falla, el motor continuará automáticamente con SRE.
   */

  if (typeof lookupLibreDte === "function") {
    try {
      const libreDteRecord = await lookupLibreDte(rut);

      if (libreDteRecord) {
        const normalized = normalizeProviderRecord(
          libreDteRecord,
          "LibreDTE",
          formattedRut
        );

        const saved =
          typeof saveTaxRecord === "function"
            ? await saveTaxRecord(
                normalized,
                actor,
                "LibreDTE"
              )
            : normalized;

        return {
          status: 200,
          valid: true,
          existing: false,
          found: true,
          data: saved,
          rut: formattedRut,
          source: "LibreDTE",
          providerErrors,
        };
      }
    } catch (error) {
      providerErrors.push(
        serializeProviderError("LibreDTE", error)
      );
    }
  }

  /*
   * 4. Consultar SRE como proveedor de respaldo.
   */

  if (typeof lookupSre === "function") {
    try {
      const sreRecord = await lookupSre(rut);

      if (sreRecord) {
        const normalized = normalizeProviderRecord(
          sreRecord,
          "SRE",
          formattedRut
        );

        const saved =
          typeof saveTaxRecord === "function"
            ? await saveTaxRecord(
                normalized,
                actor,
                "SRE"
              )
            : normalized;

        return {
          status: 200,
          valid: true,
          existing: false,
          found: true,
          data: saved,
          rut: formattedRut,
          source: "SRE",
          providerErrors,
        };
      }
    } catch (error) {
      providerErrors.push(
        serializeProviderError("SRE", error)
      );
    }
  }

  /*
   * 5. Ningún proveedor encontró información.
   */

  const allProvidersFailed =
    providerErrors.length > 0 &&
    providerErrors.every(
      (error) =>
        error.code !== "LIBREDTE_TAXPAYER_NOT_FOUND"
    );

  return {
    status: allProvidersFailed ? 503 : 200,
    valid: true,
    existing: false,
    found: false,
    data: null,
    rut: formattedRut,
    source: null,
    providerUnavailable: allProvidersFailed,
    providerErrors,
    error: allProvidersFailed
      ? "No fue posible consultar los datos tributarios en este momento."
      : null,
  };
}

module.exports = {
  lookupTaxpayer,
  isCompleteTaxRecord,
  normalizeProviderRecord,
};
