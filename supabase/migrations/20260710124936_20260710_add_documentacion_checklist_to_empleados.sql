/*
# Añadir checklist de documentación a empleados

Añade 5 columnas booleanas a la tabla `empleados` para registrar
si se ha recibido/verificado cada documento o dato del trabajador:

- `doc_dni`           — DNI / NIE entregado
- `doc_nass`          — Número de Afiliación a la Seguridad Social
- `doc_vitali`        — Tarjeta Sanitaria (Vitali / SIP)
- `doc_numero_cuenta` — Número de cuenta bancaria
- `doc_titulacion`    — Título habilitante / certificado de estudios

Todas las columnas usan DEFAULT false (no recibido por defecto).
No se eliminan ni modifican columnas existentes.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='doc_dni') THEN
    ALTER TABLE empleados ADD COLUMN doc_dni boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='doc_nass') THEN
    ALTER TABLE empleados ADD COLUMN doc_nass boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='doc_vitali') THEN
    ALTER TABLE empleados ADD COLUMN doc_vitali boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='doc_numero_cuenta') THEN
    ALTER TABLE empleados ADD COLUMN doc_numero_cuenta boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='doc_titulacion') THEN
    ALTER TABLE empleados ADD COLUMN doc_titulacion boolean NOT NULL DEFAULT false;
  END IF;
END $$;
