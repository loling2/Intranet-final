-- Reconocimiento médico: 'acepta' | 'renuncia' | null
-- Entrega documentación PRL: 'recibida' | 'observaciones' | null
-- Reconocimiento médico realizado (gestionado desde PRL)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='reconocimiento_medico') THEN
    ALTER TABLE empleados ADD COLUMN reconocimiento_medico text CHECK (reconocimiento_medico IN ('acepta','renuncia')) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='reconocimiento_medico_realizado') THEN
    ALTER TABLE empleados ADD COLUMN reconocimiento_medico_realizado boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='reconocimiento_medico_fecha') THEN
    ALTER TABLE empleados ADD COLUMN reconocimiento_medico_fecha date DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='entrega_doc_prl') THEN
    ALTER TABLE empleados ADD COLUMN entrega_doc_prl text CHECK (entrega_doc_prl IN ('recibida','observaciones')) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='entrega_doc_prl_observaciones') THEN
    ALTER TABLE empleados ADD COLUMN entrega_doc_prl_observaciones text DEFAULT NULL;
  END IF;
END $$;
