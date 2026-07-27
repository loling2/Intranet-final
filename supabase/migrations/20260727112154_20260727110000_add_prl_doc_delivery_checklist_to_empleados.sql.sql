/*
# Checklist de Entrega de Documentacion PRL en Empleados

Anade 4 columnas booleanas a la tabla `empleados` para registrar
si se ha entregado al trabajador cada uno de los documentos PRL:

- `prl_ficha_puesto`        — Ficha del puesto de trabajo entregada
- `prl_evaluacion_riesgos`  — Evaluacion de riesgos entregada
- `prl_medidas_emergencia`  — Medidas de emergencia entregadas
- `prl_plan_prevencion`     — Plan de Prevencion entregado

Todas las columnas son boolean NOT NULL DEFAULT false (no entregado por defecto).
No se eliminan ni modifican columnas existentes.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='prl_ficha_puesto') THEN
    ALTER TABLE empleados ADD COLUMN prl_ficha_puesto boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='prl_evaluacion_riesgos') THEN
    ALTER TABLE empleados ADD COLUMN prl_evaluacion_riesgos boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='prl_medidas_emergencia') THEN
    ALTER TABLE empleados ADD COLUMN prl_medidas_emergencia boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='prl_plan_prevencion') THEN
    ALTER TABLE empleados ADD COLUMN prl_plan_prevencion boolean NOT NULL DEFAULT false;
  END IF;
END $$;
