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
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function writeDB(data) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

module.exports = {
  readDB,
  writeDB
};
