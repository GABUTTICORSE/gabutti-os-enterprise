# GS ONE v0.4.2

Fecha: 25 de julio de 2026

## Desarrollo incorporado

- Nueva capacidad visible **Identidad y acceso**.
- Personas institucionales con organización, condición, rol y estado.
- Contraseñas migradas automáticamente desde texto visible a hash `scrypt` con salt individual.
- Sesiones mediante token seguro con vencimiento de 12 horas.
- Validación de sesión al volver a abrir GS ONE.
- Cierre de sesión real en servidor y navegador.
- Registro de accesos autorizados e intentos fallidos.
- API `/api/db` ya no expone hashes ni contraseñas.
- Endpoints protegidos: dashboard, base de datos y módulos operacionales requieren sesión.

## Compatibilidad

La base existente se migra automáticamente al iniciar. Las credenciales locales no se documentan ni se guardan en el repositorio.

## Pruebas

- Clasificador de Inbox.
- Hash y verificación de contraseña.
- Migración de usuarios.
- Eliminación de información sensible en respuestas.
- Login, sesión y rechazo de solicitudes sin token.
