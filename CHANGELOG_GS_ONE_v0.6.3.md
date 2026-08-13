# GS ONE v0.6.3 — Autocompletado tributario por RUT

- Consulta automática al completar un RUT chileno válido, sin depender del botón Buscar.
- Mantiene el botón Buscar como reintento manual.
- Completa razón social, nombre, giro, dirección tributaria, región, comuna y correo DTE cuando están disponibles.
- Separa correctamente dirección tributaria de dirección de despacho.
- Agrega dirección, región y comuna tributaria a la ficha principal del cliente.
- Usa caché local para consultas ya realizadas y evita repetir solicitudes innecesarias.
- Conserva prevención de RUT duplicado y salida manual cuando el proveedor no está disponible.
- La consulta externa requiere configurar SRE_API_TOKEN para operación estable.
