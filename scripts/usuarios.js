// Herramienta segura para administrar usuarios de GS ONE.
// Uso (desde la carpeta de GS ONE):  npm run usuarios
const crypto = require("crypto");
const readline = require("readline");
const { readDB, writeDB } = require("../apps/api/database");
const { hashPassword } = require("../apps/api/auth");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Cola de respuestas: funciona igual al escribir o al pegar varias líneas juntas
const pendingLines = [];
const waiting = [];
rl.on("line", (line) => {
  const next = waiting.shift();
  if (next) next(line.trim());
  else pendingLines.push(line.trim());
});
rl.on("close", () => { while (waiting.length) waiting.shift()("0"); });

function ask(question) {
  process.stdout.write(question);
  if (pendingLines.length) return Promise.resolve(pendingLines.shift());
  return new Promise((resolve) => waiting.push(resolve));
}

const ROLES = {
  "1": { name: "Executive", description: "Acceso total (administración)" },
  "2": { name: "Equipo", description: "Uso diario, sin funciones de administración" }
};

// Contraseña temporal fácil de dictar: sin letras confusas (0/O, 1/l/I)
function temporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) out += chars[bytes[i] % chars.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

function ensureRole(db, roleName) {
  db.roles = db.roles || [];
  if (!db.roles.some((r) => r.name === roleName)) {
    db.roles.push({
      id: "r" + (db.roles.length + 1) + "_" + Date.now().toString(36),
      name: roleName,
      permissions: roleName === "Executive" ? ["dashboard", "operations", "settings"] : ["dashboard", "operations"]
    });
  }
}

function listUsers(db) {
  console.log("\nUsuarios de GS ONE:");
  (db.users || []).forEach((u, i) => {
    const twoFA = u.totpEnabled ? "2 pasos ✅" : "2 pasos ❌";
    console.log(`  ${i + 1}. ${u.name} · ${u.email} · ${u.role} · ${u.status || "Activo"} · ${twoFA}`);
  });
  console.log("");
}

async function pickUser(db) {
  listUsers(db);
  const n = Number(await ask("Número del usuario: "));
  const user = (db.users || [])[n - 1];
  if (!user) console.log("❌ Número no válido.\n");
  return user;
}

function showPassword(user, password) {
  console.log("\n✅ Listo. Entrega estos datos a la persona por un medio privado:");
  console.log(`   Correo:     ${user.email}`);
  console.log(`   Contraseña: ${password}`);
  console.log("   (Esta contraseña no se volverá a mostrar)\n");
}

async function createUser() {
  const db = readDB();
  const name = await ask("Nombre y apellido: ");
  const email = (await ask("Correo: ")).toLowerCase();

  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.log("❌ Falta el nombre o el correo no es válido.\n");
    return;
  }
  if ((db.users || []).some((u) => String(u.email).trim().toLowerCase() === email)) {
    console.log("❌ Ya existe un usuario con ese correo.\n");
    return;
  }

  console.log("Tipo de acceso:");
  Object.entries(ROLES).forEach(([k, r]) => console.log(`  ${k}. ${r.name} — ${r.description}`));
  const role = ROLES[await ask("Elige 1 o 2: ")];
  if (!role) {
    console.log("❌ Opción no válida.\n");
    return;
  }

  const password = temporaryPassword();
  const user = {
    id: "u_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(password),
    role: role.name,
    condition: role.description,
    organization: "Gabutti Corse",
    status: "Activo",
    createdAt: new Date().toISOString()
  };

  db.users = db.users || [];
  db.users.push(user);
  ensureRole(db, role.name);
  writeDB(db);
  showPassword(user, password);
}

async function resetPassword() {
  const db = readDB();
  const user = await pickUser(db);
  if (!user) return;
  const password = temporaryPassword();
  user.passwordHash = hashPassword(password);
  user.status = "Activo";
  writeDB(db);
  showPassword(user, password);
}

async function setStatus(status) {
  const db = readDB();
  const user = await pickUser(db);
  if (!user) return;
  if (status === "Inactivo" && user.role === "Executive" &&
      db.users.filter((u) => u.role === "Executive" && u.status !== "Inactivo").length <= 1) {
    console.log("❌ No puedes desactivar al último administrador (Executive).\n");
    return;
  }
  user.status = status;
  writeDB(db);
  console.log(`\n✅ ${user.name} ahora está ${status}.\n`);
}

async function resetTwoFactor() {
  const db = readDB();
  const user = await pickUser(db);
  if (!user) return;
  const ok = await ask(`¿Quitar la verificación en dos pasos de ${user.name}? (escribe si): `);
  if (ok.toLowerCase() !== "si") return;
  user.totpEnabled = false;
  delete user.totpSecretEncrypted;
  delete user.recoveryCodeHashes;
  writeDB(db);
  console.log(`\n✅ Listo. ${user.name} podrá entrar solo con su contraseña y volver a activar los dos pasos.\n`);
}

async function main() {
  for (;;) {
    console.log("=== Usuarios de GS ONE ===");
    console.log("  1. Crear usuario");
    console.log("  2. Ver usuarios");
    console.log("  3. Nueva contraseña temporal para un usuario");
    console.log("  4. Desactivar usuario");
    console.log("  5. Reactivar usuario");
    console.log("  6. Quitar verificación en dos pasos (si perdió el celular)");
    console.log("  0. Salir");
    const option = await ask("Elige una opción: ");

    try {
      if (option === "1") await createUser();
      else if (option === "2") listUsers(readDB());
      else if (option === "3") await resetPassword();
      else if (option === "4") await setStatus("Inactivo");
      else if (option === "5") await setStatus("Activo");
      else if (option === "6") await resetTwoFactor();
      else if (option === "0") break;
      else console.log("Opción no válida.\n");
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
  rl.close();
}

main();
