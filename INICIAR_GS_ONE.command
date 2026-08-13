#!/bin/bash

set -u
cd "$(dirname "$0")"

GS_ONE_PORT=3101
GS_ONE_URL="http://localhost:${GS_ONE_PORT}/?version=0.8.2"

if command -v lsof >/dev/null 2>&1; then
  existing_pid="$(lsof -nP -iTCP:"${GS_ONE_PORT}" -sTCP:LISTEN -t 2>/dev/null | head -n 1)"

  if [ -n "${existing_pid}" ]; then
    existing_command="$(ps -p "${existing_pid}" -o command= 2>/dev/null || true)"

    if [[ "${existing_command}" == *"apps/api/server.js"* ]]; then
      echo "GS ONE v0.8.2 ya está activo. Abriendo Dashboard V3..."
      open "${GS_ONE_URL}"
      exit 0
    fi

    echo "No fue posible iniciar GS ONE: el puerto ${GS_ONE_PORT} está ocupado."
    echo "Cierra la aplicación que está usando ese puerto e inténtalo nuevamente."
    read -r -p "Presiona Enter para cerrar..."
    exit 1
  fi
fi

echo "Iniciando GS ONE v0.8.2 · Dashboard V3..."
PORT="${GS_ONE_PORT}" node apps/api/server.js &
server_pid=$!

cleanup() {
  if kill -0 "${server_pid}" 2>/dev/null; then
    kill "${server_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

for attempt in {1..40}; do
  if curl -fsS "http://localhost:${GS_ONE_PORT}/" >/dev/null 2>&1; then
    echo "GS ONE v0.8.2 está listo en ${GS_ONE_URL}"
    open "${GS_ONE_URL}"
    wait "${server_pid}"
    exit $?
  fi

  if ! kill -0 "${server_pid}" 2>/dev/null; then
    echo "GS ONE no pudo iniciarse. Revisa el mensaje mostrado arriba."
    read -r -p "Presiona Enter para cerrar..."
    exit 1
  fi

  sleep 0.25
done

echo "GS ONE demoró demasiado en responder."
read -r -p "Presiona Enter para cerrar..."
exit 1
