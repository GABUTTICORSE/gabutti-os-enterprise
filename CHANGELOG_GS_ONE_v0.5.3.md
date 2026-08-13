# GS ONE v0.5.3 — Corrección consulta RUT

- Corrige el formato enviado al proveedor: ahora usa RUT con guion antes del dígito verificador.
- Agrega consulta POST de respaldo si la consulta GET falla.
- Amplía el tiempo de espera a 12 segundos.
- Muestra el detalle real del error para distinguir falta de conexión, límite agotado o rechazo del proveedor.
- Conserva caché local y prevención de duplicados.
