# GS ONE v0.5.2 - Autocompletado tributario real

- Reemplaza el directorio local vacío por una consulta real al proveedor SRE.
- Usa `token_publico` por defecto (límite informado por el proveedor).
- Permite configurar `SRE_API_TOKEN` y `SRE_API_URL` por variables de entorno.
- Autocompleta razón social, nombre, giro, dirección, comuna, región y email DTE cuando estén disponibles.
- Conserva una copia local de cada resultado para acelerar consultas posteriores.
- Mantiene la prevención de duplicados y la validación matemática del RUT.
- Informa claramente cuando el servicio externo no está disponible o no encuentra datos.
