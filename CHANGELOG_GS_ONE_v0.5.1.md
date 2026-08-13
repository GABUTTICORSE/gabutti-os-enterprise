# GS ONE v0.5.1 — Ficha Cliente

## Objetivo
Cerrar la estructura operativa de clientes antes de continuar con cotizaciones y pedidos.

## Implementado
- Base de pruebas limpia; se conserva la estructura de usuarios, roles, productos, stock e importaciones sin publicar datos privados.
- Correlativo visible y único `CLI-000001` con seis dígitos.
- Reinicio controlado de datos de desarrollo y del contador de clientes.
- Validación matemática del RUT chileno.
- Bloqueo de clientes duplicados por RUT.
- Endpoint de consulta de RUT con detección inmediata de clientes existentes.
- Ficha de alta organizada en secciones plegables y livianas.
- Datos de identificación, contacto, disciplina, nivel y observaciones.
- Facturación alternativa activada mediante interruptor.
- Ficha de despacho con tipo, transportista, región, ciudad, sucursal, destinatario e instrucciones especiales.
- Campos de despacho condicionales para evitar formularios visualmente pesados.
- Perfil de cliente actualizado para mostrar siempre el número `CLI-######`.

## Autocompletado tributario
La arquitectura incluye un catálogo tributario local (`tax_directory`) y el endpoint `/api/rut-lookup/:rut`. El sistema valida, busca duplicados y completa los datos disponibles. La conexión a una fuente tributaria externa queda desacoplada para incorporar un proveedor autorizado sin rehacer la ficha.

## Credenciales locales
Las credenciales permanecen únicamente en la base privada local y no se publican en GitHub.
