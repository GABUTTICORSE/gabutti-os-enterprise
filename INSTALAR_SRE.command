#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "GS ONE v0.6.5 - Instalacion"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado. Instala Node.js LTS y vuelve a ejecutar este archivo."
  read -r -p "Presiona Enter para cerrar..."
  exit 1
fi
npm install
if [ ! -f config/sre.local.json ]; then
  npm run configure:sre
fi
echo "Iniciando GS ONE en http://localhost:3100"
node apps/api/server.js
