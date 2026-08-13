# Instalación GS ONE v0.6.5

1. Descomprime el ZIP.
2. En macOS, haz clic derecho en `INSTALAR_SRE.command` y selecciona **Abrir**.
3. El instalador ejecutará `npm install` y levantará GS ONE en `http://localhost:3100`.
4. En usos posteriores puedes abrir `INICIAR_GS_ONE.command`.

## Consulta tributaria

- Primero busca el RUT en la Base Tributaria Gabutti.
- Si no existe, consulta SRE y guarda el resultado localmente.
- Desde la segunda consulta usa la base local.
- Andrea y José disponen del botón **Actualizar desde SRE** en la ficha del cliente.

## Seguridad

El token está en `config/sre.local.json`, fuera del código fuente y excluido de Git. Para reemplazarlo ejecuta:

```bash
npm run configure:sre
```
