/*
# Seguros: enlace al PDF de la poliza en Wasabi

1. Cambios en tabla `seguros`
   - Nueva columna `documento_key` (text, nullable): ruta del PDF de la poliza dentro del bucket de Wasabi (carpeta `polizas/<numero_poliza>/`).

2. Seguridad
   - No se añaden tablas ni politicas. Las politicas existentes de `seguros` (admin / administracion) ya cubren la nueva columna.

3. Notas
   - Idempotente: se usa IF NOT EXISTS.
   - Los seguros existentes quedan con documento_key = NULL hasta que se suba su PDF.
*/

ALTER TABLE seguros ADD COLUMN IF NOT EXISTS documento_key text;
