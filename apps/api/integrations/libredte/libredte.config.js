const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(
  __dirname,
  "../../../../config/libredte.local.json"
);

function loadLibreDteConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      enabled: false,
      configured: false,
      error: "No existe config/libredte.local.json",
    };
  }

  try {
    const rawConfig = fs.readFileSync(CONFIG_PATH, "utf8");
    const config = JSON.parse(rawConfig);

    const apiKey = String(config.apiKey || "").trim();
    const companyRut = String(config.companyRut || "").trim();

    return {
      enabled: config.enabled !== false,
      configured: Boolean(apiKey && companyRut),
      environment: config.environment || "production",
      companyRut,
      apiKey,
      timeout: Number(config.timeout) || 10000,
      cacheMinutes: Number(config.cacheMinutes) || 1440,
      error: null,
    };
  } catch (error) {
    return {
      enabled: false,
      configured: false,
      error: `Error leyendo configuración LibreDTE: ${error.message}`,
    };
  }
}

module.exports = {
  loadLibreDteConfig,
};