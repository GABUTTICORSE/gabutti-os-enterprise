class LibreDteError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "LibreDteError";
    this.code = options.code || "LIBREDTE_ERROR";
    this.status = options.status || 500;
    this.provider = "LibreDTE";
    this.details = options.details || null;
    this.cause = options.cause || null;
  }
}

class LibreDteConfigurationError extends LibreDteError {
  constructor(message = "LibreDTE no está correctamente configurado.", options = {}) {
    super(message, {
      ...options,
      code: "LIBREDTE_NOT_CONFIGURED",
      status: 503,
    });

    this.name = "LibreDteConfigurationError";
  }
}

class LibreDteRequestError extends LibreDteError {
  constructor(message = "No fue posible comunicarse con LibreDTE.", options = {}) {
    super(message, {
      ...options,
      code: "LIBREDTE_REQUEST_ERROR",
      status: options.status || 503,
    });

    this.name = "LibreDteRequestError";
  }
}

class LibreDteResponseError extends LibreDteError {
  constructor(message = "LibreDTE devolvió una respuesta no válida.", options = {}) {
    super(message, {
      ...options,
      code: "LIBREDTE_RESPONSE_ERROR",
      status: options.status || 502,
    });

    this.name = "LibreDteResponseError";
  }
}

class LibreDteTaxpayerNotFoundError extends LibreDteError {
  constructor(message = "LibreDTE no encontró información para este RUT.", options = {}) {
    super(message, {
      ...options,
      code: "LIBREDTE_TAXPAYER_NOT_FOUND",
      status: 404,
    });

    this.name = "LibreDteTaxpayerNotFoundError";
  }
}

module.exports = {
  LibreDteError,
  LibreDteConfigurationError,
  LibreDteRequestError,
  LibreDteResponseError,
  LibreDteTaxpayerNotFoundError,
};


