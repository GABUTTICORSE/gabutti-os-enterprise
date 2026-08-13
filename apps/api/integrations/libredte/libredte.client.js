const https = require("https");
const { loadLibreDteConfig } = require("./libredte.config");
const {
  LibreDteConfigurationError,
  LibreDteRequestError,
  LibreDteResponseError,
  LibreDteTaxpayerNotFoundError,
} = require("./libredte.errors");

function createAuthorization(apiKey) {
  return `Basic ${apiKey}`;
}

function request(requestPath, method = "GET", payload = null) {
  return new Promise((resolve, reject) => {
    const config = loadLibreDteConfig();

    if (!config.configured) {
      return reject(
        new LibreDteConfigurationError(
          config.error || "LibreDTE no está correctamente configurado."
        )
      );
    }

    const body = payload ? JSON.stringify(payload) : null;

    const options = {
      hostname: "libredte.cl",
      port: 443,
      path: requestPath,
      method,
      timeout: config.timeout,
      headers: {
        Accept: "application/json",
        Authorization: createAuthorization(config.apiKey),
        "User-Agent": "GS-ONE/0.7.1",
      },
    };

    if (body) {
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let raw = "";

      res.on("data", (chunk) => {
        raw += chunk;
      });

      res.on("end", () => {
        let data = {};

        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (error) {
          return reject(
            new LibreDteResponseError(
              "LibreDTE devolvió una respuesta que no es JSON válido.",
              {
                status: res.statusCode,
                details: raw,
                cause: error,
              }
            )
          );
        }
console.log("========== LIBREDTE ==========");
console.log("STATUS:", res.statusCode);
console.log("PATH:", requestPath);
console.log("BODY:", raw);
console.log("==============================");
        if (res.statusCode === 404) {
          return reject(
            new LibreDteTaxpayerNotFoundError(
              data.error ||
                data.message ||
                "LibreDTE no encontró información para este RUT.",
              {
                details: data,
              }
            )
          );
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new LibreDteRequestError(
              data.error ||
                data.message ||
                `LibreDTE respondió con estado ${res.statusCode}.`,
              {
                status: res.statusCode,
                details: data,
              }
            )
          );
        }

        return resolve(data);
      });
    });

    req.on("timeout", () => {
      req.destroy(
        new LibreDteRequestError(
          "LibreDTE superó el tiempo máximo de respuesta.",
          {
            code: "LIBREDTE_TIMEOUT",
            status: 504,
          }
        )
      );
    });

    req.on("error", (error) => {
      if (error instanceof LibreDteRequestError) {
        return reject(error);
      }

      return reject(
        new LibreDteRequestError(
          "No fue posible establecer conexión con LibreDTE.",
          {
            cause: error,
            details: error.message,
          }
        )
      );
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  request,
};