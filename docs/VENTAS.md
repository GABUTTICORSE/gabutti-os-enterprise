# Ventas en GS ONE

El rol **Ventas** permite trabajar el flujo comercial sin el rol Executive: Inbox, clientes y prospectos, procesos, cotizaciones, el folio de la factura emitida en LibreDTE, tareas y seguimientos.

La factura electrónica se emite en LibreDTE. GS ONE no emite el DTE: solo consulta el RUT del cliente y guarda el folio que Ventas escribe después de emitir.

## Qué puede hacer

- Registrar una consulta en Inbox y convertirla en cliente o prospecto, proceso comercial y tarea. Un prospecto puede quedar sin RUT.
- Crear y actualizar cotizaciones, incluido el PDF.
- Aceptar una cotización. Eso abre el pedido de venta.
- Registrar la factura o boleta ya emitida en LibreDTE (tipo, folio y fecha) en el pedido y en la cotización.
- Crear y cerrar tareas, y ver los seguimientos de 3, 5 y 10 días de sus cotizaciones.

El responsable de una entrada nueva es la persona que está trabajando. Si no hay nombre, queda como Ventas.

## Qué no ve

- Finanzas, cobros, pagos ni datos bancarios.
- Costos, márgenes y el catálogo de costos de importación.
- Stock, importaciones y configuración.
- Usuarios, contraseñas y los tokens de otras personas.
- El botón de limpiar datos de prueba.

Registrar una factura no crea un movimiento en Finanzas. El folio queda en el pedido para que el administrador lo vea.

Los precios que sí ve son los de venta, los de la cotización y el teléfono o WhatsApp del cliente.

## Cómo crear a la persona de Ventas

En el computador donde corre GS ONE, dentro de la carpeta del proyecto:

```bash
npm run usuarios
```

1. Elige **Crear usuario**.
2. Escribe el nombre y el correo.
3. Elige **3. Ventas**.
4. La herramienta muestra una contraseña temporal una sola vez. Entrégala por un medio privado.

No dejes esa contraseña en el código ni en este repositorio.

La persona entra en GS ONE con ese correo y esa contraseña. Si activan el segundo paso (Authenticator), cada ingreso humano pide el código. El asistente no usa esa pantalla: usa un token.

## Cómo crear el token del asistente

Solo un usuario Executive, ya entrado con su contraseña:

1. Abre **Identidad y acceso**.
2. En **Tokens de API**, elige **Crear token** en la persona de Ventas. No lo crees sobre un Executive: ese token vería toda la empresa.
3. Ponle un nombre reconocible, por ejemplo `asistente de ventas`.
4. Copia el token en ese momento. GS ONE no lo vuelve a mostrar. Guárdalo en el asistente, no en Git.
5. Para cortarlo, usa **Revocar** en la misma pantalla.

El asistente envía el token en cada llamada:

```http
Authorization: Bearer EL_TOKEN
```

También se acepta el encabezado `x-gsone-token`. El token no pide el código de Authenticator. Si se revoca o la persona pasa a Inactivo, deja de funcionar.

## Llamadas del asistente

Todas exigen una sesión o un token de alguien Executive o Ventas.

| Para qué | Llamada |
| --- | --- |
| Anotar una consulta | `POST /api/sales/inbox` con `sender`, `message` y, si existen, `whatsapp`, `email`, `source` |
| Pasarla a cliente, proceso y tarea | `POST /api/sales/inbox/ID/process` |
| Crear cotización | `POST /api/sales/quotes` |
| Actualizar cotización (enviada, aceptada, rechazada) | `PUT /api/sales/quotes/ID` |
| Crear tarea | `POST /api/sales/tasks` |
| Completar tarea | `PUT /api/sales/tasks/ID` con `status` en `Hecha` |
| Ver seguimientos pendientes | `GET /api/sales/follow-ups` |
| Guardar el folio emitido en LibreDTE | `POST /api/sales/invoices` |

El cuerpo de la factura es:

```json
{
  "quoteId": "id-de-la-cotizacion",
  "taxDocumentType": "Factura",
  "taxDocumentNumber": "12345"
}
```

`taxDocumentType` es `Factura` o `Boleta`. También se puede mandar `orderId` en vez de `quoteId`. La cotización tiene que estar aceptada, porque ahí nace el pedido.

Cada acción queda en la actividad con el nombre de la persona dueña del token o de la sesión. El token en sí no se guarda en la actividad: en la base solo queda un hash y los últimos cuatro caracteres.

## Pantalla

Ventas entra directo al Inbox. Ve clientes, procesos, cotizaciones, pedidos y tareas. No ve Dirección, Finanzas, Stock, Importaciones, Catálogos, Identidad ni Actividad.
