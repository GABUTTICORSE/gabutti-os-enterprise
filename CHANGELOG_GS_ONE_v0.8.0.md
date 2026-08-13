# GS ONE v0.8.0 — Dashboard V3

## Alcance

Actualización exclusivamente visual. No modifica autenticación, base de datos,
API, credenciales ni reglas de negocio.

## Cambios

- Foto ejecutiva integrada en el Dashboard.
- Escala visual general aumentada aproximadamente un 20 %.
- Header ejecutivo y logo con mayor presencia.
- Sidebar reorganizada por Dirección, Comercial, Operaciones y Sistema.
- KPIs y paneles redimensionados.
- Barra Motorsport renovada.
- Login rectificado: logo proporcionado y textos, campos y botón más legibles.
- Ajustes responsive para escritorio, tablet y móvil.
- Inicio V3 aislado en `http://localhost:3101` para evitar reutilizar el
  servidor anterior del puerto 3100.
- Apertura automática del navegador y distintivo visible de versión en login.
- Revisión v0.8.1: tipografía general aumentada un 20 %, excluyendo únicamente
  el bloque de bienvenida del Dashboard; login completo ampliado.

## Corrección de instalación

La interfaz que entrega el servidor se encuentra en `apps/web/public`.
Esta versión aplica los cambios directamente en esa ubicación activa.
