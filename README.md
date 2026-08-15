# GS ONE v0.8.2

Sistema operativo de Gabutti Corse. Esta versión establece el Login y el Dashboard V3 como base visual estable.

## Ejecutar

```bash
npm start
```

La aplicación queda disponible en `http://localhost:3100`. En macOS también puede iniciarse con `INICIAR_GS_ONE.command`, que usa el puerto configurado para v0.8.2.

## Datos privados locales

Los siguientes archivos son locales y no se publican en GitHub:

- `database/db.json`
- `config/sre.local.json`
- `config/libredte.local.json`
- `config/whatsapp.local.json`
- cualquier otro `*.local.json`

Para restaurar una instalación existente, copia tu respaldo privado a esas ubicaciones antes de iniciar GS ONE.

## Primera instalación sin base previa

Define un administrador inicial solo en tu Terminal y luego inicia el sistema:

```bash
export GS_ONE_ADMIN_EMAIL="tu-correo"
export GS_ONE_ADMIN_PASSWORD="una-contraseña-segura"
export GS_ONE_ADMIN_NAME="Tu nombre"
npm start
```

GS ONE creará `database/db.json` localmente. Este archivo queda excluido del control de versiones.

## LibreDTE

Copia `config/libredte.example.json` como `config/libredte.local.json` y completa los valores únicamente en el archivo local. No publiques claves API.

## SRE

La integración acepta el token mediante `SRE_API_TOKEN` o mediante `config/sre.local.json`. Ambos mecanismos deben mantenerse fuera de Git.

## WhatsApp Inbound

Copia `config/whatsapp.example.json` como `config/whatsapp.local.json` y completa `verifyToken` y `appSecret` con los datos de la aplicación de Meta. El archivo local queda excluido de Git.

También puedes usar las variables de entorno `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` y opcionalmente `WHATSAPP_PORT`.

Inicia el gateway de entrada con:

```bash
npm run start:whatsapp
```

Por defecto escucha en `http://localhost:3101`. La verificación y recepción de Meta se exponen en `/webhooks/whatsapp`, y el estado básico en `/health`.

Los mensajes entrantes se guardan en Inbox y pasan por el motor de clasificación y automatización existente de GS ONE. Esta primera etapa no envía respuestas automáticas ni crea cotizaciones directamente desde el webhook.

## Validación

```bash
npm test
```
