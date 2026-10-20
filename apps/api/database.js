const fs = require("fs");
const path = require("path");
const { hashPassword } = require("./auth");

const ROOT = path.join(__dirname, "..", "..");
const DEFAULT_DATABASE_DIR = path.join(ROOT, "database");

const DATABASE_DIR =
  String(process.env.GS_ONE_DATA_DIR || "").trim() ||
  DEFAULT_DATABASE_DIR;
const DB = path.join(DATABASE_DIR, "db.json");
const DB_EXAMPLE = path.join(DEFAULT_DATABASE_DIR, "db.example.json");

// Respaldos automáticos: uno por día, se guardan los últimos BACKUP_KEEP_DAYS.
// La carpeta "backups" está excluida de Git en .gitignore.
const BACKUP_DIR = path.join(DATABASE_DIR, "backups");
const BACKUP_KEEP_DAYS = Number(process.env.GS_ONE_BACKUP_KEEP_DAYS) || 14;

function todayStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Escribe el archivo de forma "atómica": primero en un archivo temporal y
// luego lo reemplaza de una sola vez. Si el programa se cae a mitad de camino,
// el db.json anterior queda intacto en vez de quedar dañado.
function writeFileAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmp, "w");

  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tmp, file);
}

// Crea el respaldo del día si todavía no existe y borra los más antiguos.
function backupDailyIfNeeded() {
  try {
    if (!fs.existsSync(DB)) return;

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const target = path.join(BACKUP_DIR, `db-${todayStamp()}.json`);

    if (!fs.existsSync(target)) {
      // Nunca respaldar un archivo dañado (así no reemplaza a uno bueno)
      JSON.parse(fs.readFileSync(DB, "utf8"));
      fs.copyFileSync(DB, target);
      console.log(`[GS ONE] Respaldo diario creado: backups/${path.basename(target)}`);
    }

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(name))
      .sort();

    for (const old of backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP_DAYS))) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (error) {
    // Un problema con el respaldo nunca debe impedir trabajar
    console.error("[GS ONE] No se pudo crear el respaldo diario:", error.message);
  }
}

function ensureDB() {
  if (fs.existsSync(DB)) {
    return;
  }

  const data = JSON.parse(fs.readFileSync(DB_EXAMPLE, "utf8"));
  const email = String(process.env.GS_ONE_ADMIN_EMAIL || "").trim();
  const password = String(process.env.GS_ONE_ADMIN_PASSWORD || "");

  if (email || password) {
    if (!email || !password) {
      throw new Error(
        "Para crear el administrador inicial debes definir " +
        "GS_ONE_ADMIN_EMAIL y GS_ONE_ADMIN_PASSWORD."
      );
    }

    data.users = [
      {
        id: "u1",
        name: process.env.GS_ONE_ADMIN_NAME || "Administrador GS ONE",
        email,
        passwordHash: hashPassword(password),
        role: "Executive",
        condition: "Administración inicial",
        organization: "Gabutti Corse",
        status: "Activo"
      }
    ];

    data.roles = [
      {
        id: "r1",
        name: "Executive",
        permissions: ["dashboard", "operations", "settings"]
      }
    ];
  }

  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  writeFileAtomic(DB, JSON.stringify(data, null, 2));
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    const message =
      "La base de datos database/db.json está dañada y no se puede leer. " +
      "No se modificó nada. Puedes restaurar el último respaldo desde " +
      "database/backups/.";
    console.error(`[GS ONE] ${message}`);
    throw new Error(message);
  }
}

function writeDB(data) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  backupDailyIfNeeded();
  writeFileAtomic(DB, JSON.stringify(data, null, 2));
}

// Respaldo al iniciar el programa, por si hoy no se guarda nada
backupDailyIfNeeded();

module.exports = {
  readDB,
  writeDB
};
