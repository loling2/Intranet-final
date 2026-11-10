export type TablaPlan = 'crm_pai_residencia' | 'crm_pai_spap' | 'crm_plan_vida' | 'crm_pai_pir' | 'crm_plan_intervencion_social';

export interface CampoTexto { tipo: 'texto' | 'area' | 'fecha'; clave: string; etiqueta: string }
export interface CampoSelect { tipo: 'select'; clave: string; etiqueta: string; opciones: { valor: string; etiqueta: string }[] }
export interface CampoFilas { tipo: 'filas'; clave: string; etiqueta: string; columnas: { clave: string; etiqueta: string }[] }
export type Campo = CampoTexto | CampoSelect | CampoFilas;

export interface SeccionPlan { titulo: string; campos: Campo[] }

export interface PlanModelo {
  id: TablaPlan;
  nombre: string;
  descripcion: string;
  secciones: SeccionPlan[];
}

const t = (clave: string, etiqueta: string): CampoTexto => ({ tipo: 'texto', clave, etiqueta });
const a = (clave: string, etiqueta: string): CampoTexto => ({ tipo: 'area', clave, etiqueta });
const f = (clave: string, etiqueta: string): CampoTexto => ({ tipo: 'fecha', clave, etiqueta });

const NIVEL_AUTONOMIA = [
  { valor: 'independiente', etiqueta: 'Independiente' },
  { valor: 'supervision', etiqueta: 'Supervisión' },
  { valor: 'dependiente', etiqueta: 'Dependiente' },
];
const nivel = (clave: string, etiqueta: string): CampoSelect => ({ tipo: 'select', clave, etiqueta, opciones: NIVEL_AUTONOMIA });

const NIVEL_PIR = [
  { valor: 'independiente', etiqueta: 'Independiente' },
  { valor: 'supervision', etiqueta: 'Supervisión' },
  { valor: 'apoyo', etiqueta: 'Apoyo' },
];
const nivelPir = (clave: string, etiqueta: string): CampoSelect => ({ tipo: 'select', clave, etiqueta, opciones: NIVEL_PIR });

const abvd = (clave: string, etiqueta: string): CampoTexto[] => [
  t(`${clave}_nivel`, `${etiqueta}: nivel de desempeño`),
  t(`${clave}_apoyo`, `${etiqueta}: apoyo o ayuda técnica`),
  t(`${clave}_preferencia`, `${etiqueta}: preferencia`),
];

const COLUMNAS_OBJETIVOS_PAI = [
  { clave: 'area', etiqueta: 'Área' },
  { clave: 'objetivos', etiqueta: 'Objetivos' },
  { clave: 'metodologia', etiqueta: 'Metodología' },
  { clave: 'actividades', etiqueta: 'Actividades' },
  { clave: 'temporalizacion', etiqueta: 'Temporalización' },
  { clave: 'evaluacion', etiqueta: 'Evaluación' },
];
const COLUMNAS_EQUIPO = [
  { clave: 'nombre', etiqueta: 'Nombre y apellidos' },
  { clave: 'dni', etiqueta: 'DNI' },
  { clave: 'categoria', etiqueta: 'Categoría profesional' },
];
const COLUMNAS_SEGUIMIENTO = [
  { clave: 'area', etiqueta: 'Área' },
  { clave: 'objetivo_inicial', etiqueta: 'Objetivo inicial' },
  { clave: 'seguimiento', etiqueta: 'Seguimiento' },
  { clave: 'nuevos_objetivos', etiqueta: 'Nuevos objetivos' },
];

const PAI_RESIDENCIA: PlanModelo = {
  id: 'crm_pai_residencia',
  nombre: 'PAI residencia',
  descripcion: 'Plan de atención individualizada para personas residentes en centro',
  secciones: [
    {
      titulo: 'Datos personales de la persona residente',
      campos: [
        f('fecha_elaboracion', 'Fecha de elaboración del PAI'),
        t('nombre_apellidos', 'Nombre y apellidos'),
        f('fecha_nacimiento', 'Fecha de nacimiento'),
        f('fecha_ingreso_centro', 'Fecha de ingreso en el centro'),
        t('dni', 'DNI'),
        t('nss', 'Nº de la Seguridad Social'),
        t('direccion_actual', 'Dirección actual'),
        t('telefono_usuario', 'Teléfono del usuario/a'),
        t('telefono_centro', 'Teléfono del centro'),
      ],
    },
    {
      titulo: 'Datos sociosanitarios',
      campos: [
        t('centro_salud', 'Centro de salud'),
        t('map', 'Médico de atención primaria (MAP)'),
        t('telefono_centro_salud', 'Teléfono centro de salud'),
        t('usm', 'Unidad de salud mental (USM)'),
        t('psiquiatra_usm', 'Psiquiatra de USM'),
        t('telefono_usm', 'Teléfono USM'),
        t('grado_dependencia', 'Grado de dependencia'),
        a('grado_discapacidad_diagnostico', 'Grado de discapacidad y diagnóstico'),
      ],
    },
    {
      titulo: 'Síntesis de antecedentes relevantes',
      campos: [a('area_sociosanitaria', 'Área sociosanitaria: datos relevantes')],
    },
    {
      titulo: 'Capacidades y apoyos',
      campos: [
        nivel('comer', 'Comer'),
        nivel('ducha', 'Ducha'),
        nivel('vestirse', 'Vestirse'),
        nivel('actividades_aseo', 'Actividades de aseo'),
        nivel('uso_wc', 'Uso WC'),
        nivel('movilidad', 'Movilidad'),
        nivel('salidas_exterior', 'Salidas al exterior'),
      ],
    },
    {
      titulo: 'Valoración social (trabajador/a social)',
      campos: [
        a('historia_social', 'Historia social de la persona usuaria'),
        a('entorno_familiar_social', 'Descripción entorno familiar y social'),
        a('situacion_legal', 'Situación legal'),
        a('otros_datos_sociales', 'Otros datos sociales'),
        a('necesidades_sociales', 'Necesidades sociales'),
        a('creencias_valores', 'Creencias y valores'),
      ],
    },
    {
      titulo: 'Valoración sanitaria (enfermero/a)',
      campos: [
        a('historia_clinica', 'Antecedentes somáticos personales'),
        a('historia_farmacologica', 'Historia farmacológica completa y actualizada'),
        t('habitos_toxicos', 'Hábitos tóxicos'),
        a('exploracion_observacion', 'Exploración física: aspecto, cuidado y colaboración'),
        t('exploracion_cabeza', 'Exploración física: cabeza'),
        t('exploracion_piel_mucosas', 'Exploración física: piel y mucosas'),
        t('cumplimiento_farmacologia', 'Cumplimiento: farmacología'),
        t('cumplimiento_ejercicios', 'Cumplimiento: ejercicios'),
        t('cumplimiento_dieta', 'Cumplimiento: dieta'),
        a('cumplimiento_observaciones', 'Cumplimiento: observaciones'),
        t('dieta_habitual', 'Nutrición: dieta habitual'),
        t('intolerancia_alimentos', 'Nutrición: intolerancia a alimentos'),
        t('talla', 'Talla'),
        t('peso', 'Peso'),
        t('imc', 'IMC'),
        t('alteracion_apetito', 'Alteración del apetito'),
        t('dificultad_masticar', 'Dificultad para masticar'),
        t('vomitos_nauseas', 'Vómitos y náuseas'),
        t('piel_mucosa', 'Piel y mucosa'),
        t('problemas_orinar', 'Problemas al orinar'),
        t('incontinencia_urinaria', 'Incontinencia urinaria'),
        t('habitos_intestinales', 'Hábitos intestinales: cada cuántos días'),
        t('laxantes', 'Laxantes'),
        t('se_levanta_descansado', 'Se levanta descansado'),
        t('medicacion_dormir', 'Medicación para dormir'),
        t('especificar_reposo', 'Actividad y reposo: especificar'),
        t('paresias_plejias', 'Paresias / plejías'),
        t('amputaciones', 'Amputaciones'),
        t('protesis', 'Prótesis'),
        t('inmovilidad', 'Inmovilidad'),
        t('perdidas_funcionales', 'Pérdidas funcionales'),
        t('dificultad_respiratoria', 'Dificultad respiratoria'),
        t('ulceras_lesiones', 'Piel: tipo de úlceras / lesiones'),
        t('riesgo_caidas', 'Riesgo de caídas'),
        t('riesgo_nerviosismo', 'Riesgo de nerviosismo'),
        t('riesgo_agresividad', 'Riesgo de agresividad física / verbal'),
        t('patron_sexual', 'Sexualidad: patrón sexual eficaz'),
        t('anticonceptivo', 'Sexualidad: anticonceptivo'),
        t('dificultad_hablar', 'Dificultad para comunicarse: hablar'),
        t('dificultad_ver', 'Dificultad para comunicarse: ver'),
        t('dificultad_oir', 'Dificultad para comunicarse: oír'),
        t('protesis_auditiva', 'Prótesis auditiva'),
        a('otros_sanitarios', 'Otros, si cabe destacar (sanitario)'),
      ],
    },
    {
      titulo: 'Valoración psiquiátrica (médico psiquiatra)',
      campos: [
        a('antecedentes_psiquiatricos', 'Antecedentes psiquiátricos'),
        t('epp_orientado', 'Orientado/a: tiempo, espacio'),
        a('epp_contenido_pensamiento', 'Contenido del pensamiento (ideas delirantes)'),
        t('epp_alteraciones_memoria', 'Alteraciones de la memoria'),
        t('animo_ansioso', 'Estado de ánimo: ansioso/a'),
        t('animo_tranquilo', 'Estado de ánimo: tranquilo/a'),
        t('animo_agresivo', 'Estado de ánimo: agresivo/a'),
        t('animo_se_niega', 'Estado de ánimo: se niega'),
        a('diagnostico', 'Diagnóstico'),
      ],
    },
    {
      titulo: 'Propuesta de trabajo individualizado',
      campos: [{ tipo: 'filas', clave: 'propuesta', etiqueta: 'Objetivos por área', columnas: COLUMNAS_OBJETIVOS_PAI }],
    },
    {
      titulo: 'Equipo de valoración',
      campos: [{ tipo: 'filas', clave: 'equipo', etiqueta: 'Equipo de valoración multidisciplinar', columnas: COLUMNAS_EQUIPO }],
    },
    {
      titulo: 'Seguimiento (mínimo semestral)',
      campos: [
        f('fecha_revision', 'Fecha de revisión'),
        { tipo: 'filas', clave: 'seguimiento', etiqueta: 'Seguimiento de objetivos', columnas: COLUMNAS_SEGUIMIENTO },
        a('modificaciones_propuestas', 'Modificaciones propuestas'),
      ],
    },
  ],
};

const PAI_SPAP: PlanModelo = {
  id: 'crm_pai_spap',
  nombre: 'PAI SPAP domicilio',
  descripcion: 'Plan de atención individualizada del servicio de atención en domicilio',
  secciones: [
    {
      titulo: 'Datos personales de la persona usuaria',
      campos: [
        f('fecha_elaboracion', 'Fecha de elaboración del PAI'),
        t('nombre_apellidos', 'Nombre y apellidos'),
        f('fecha_nacimiento', 'Fecha de nacimiento'),
        f('fecha_ingreso_servicio', 'Fecha de ingreso en el servicio'),
        t('dni', 'DNI'),
        t('nss', 'Nº de la Seguridad Social'),
        t('direccion_actual', 'Dirección actual'),
        t('telefono_usuario', 'Teléfono del usuario/a'),
        t('otros_contactos', 'Otros contactos'),
      ],
    },
    {
      titulo: 'Datos sociosanitarios',
      campos: [
        t('centro_salud', 'Centro de salud'),
        t('map', 'Médico de atención primaria (MAP)'),
        t('telefono_centro_salud', 'Teléfono centro de salud'),
        t('medico_especialista_1', 'Médico especialista 1'),
        t('medico_especialista_2', 'Médico especialista 2'),
        t('grado_dependencia', 'Grado de dependencia'),
        a('grado_discapacidad_diagnostico', 'Grado de discapacidad y diagnóstico'),
      ],
    },
    {
      titulo: 'Síntesis de antecedentes relevantes',
      campos: [a('area_sociosanitaria', 'Área sociosanitaria: datos relevantes')],
    },
    {
      titulo: 'Actividades básicas',
      campos: [
        nivel('bano', 'Baño'),
        nivel('vestido', 'Vestido'),
        nivel('cuidado_personal', 'Cuidado personal'),
        nivel('uso_wc', 'Uso del WC'),
        nivel('comer', 'Comer'),
        nivel('transferencias', 'Transferencias'),
      ],
    },
    {
      titulo: 'Actividades instrumentales',
      campos: [
        nivel('compra', 'Compra'),
        nivel('cocinar', 'Cocinar'),
        nivel('limpieza', 'Limpieza'),
        nivel('finanzas', 'Finanzas'),
        nivel('telefono', 'Teléfono'),
        nivel('tareas_domesticas', 'Tareas domésticas'),
      ],
    },
    {
      titulo: 'Actividades avanzadas',
      campos: [
        nivel('ocio_tiempo_libre', 'Ocio y tiempo libre'),
        nivel('religiosas', 'Religiosas'),
        nivel('socializacion', 'Socialización'),
        nivel('deporte', 'Deporte'),
        nivel('trabajo', 'Trabajo'),
        nivel('viajes', 'Viajes'),
      ],
    },
    {
      titulo: 'Valoración social (trabajador/a social y TIS)',
      campos: [
        a('historia_social', 'Historia social de la persona usuaria'),
        a('entorno_familiar_social', 'Descripción entorno familiar y social'),
        a('vivienda', 'Vivienda'),
        a('situacion_legal', 'Situación legal'),
        a('otros_datos_sociales', 'Otros datos sociales'),
        a('necesidades_sociales', 'Necesidades sociales'),
        a('creencias_valores', 'Creencias y valores'),
      ],
    },
    {
      titulo: 'Valoración física y funcional (fisioterapeuta y terapeuta ocupacional)',
      campos: [
        a('historia_clinica', 'Antecedentes somáticos personales'),
        t('habitos_toxicos', 'Hábitos tóxicos'),
        a('exploracion_fisica', 'Exploración física y gestión de la salud'),
        a('valoracion_locomotor', 'Aparato locomotor: postura, rangos, fuerza, tono, balance'),
        a('valoracion_neurologica', 'Neurológica: reflejos, coordinación, equilibrio, sensibilidad'),
        a('valoracion_funcional', 'Funcional: marcha, transferencias, autonomía'),
        a('valoracion_respiratoria', 'Respiratoria'),
        a('valoracion_cardiovascular', 'Cardiovascular: tolerancia al esfuerzo'),
        a('valoracion_equilibrio', 'Equilibrio y movilidad funcional'),
        a('valoracion_cognitiva_motora', 'Cognitiva y motora combinada'),
        a('valoracion_entorno_fisico', 'Entorno físico: barreras y adaptaciones'),
        t('paresias_plejias', 'Paresias / plejías'),
        t('amputaciones', 'Amputaciones'),
        t('protesis', 'Prótesis'),
        t('inmovilidad', 'Inmovilidad'),
        t('riesgo_caidas', 'Riesgo de caídas'),
        t('riesgo_nerviosismo', 'Riesgo de nerviosismo'),
        t('riesgo_agresividad', 'Riesgo de agresividad física / verbal'),
        t('dificultad_hablar', 'Dificultad para comunicarse: hablar'),
        t('dificultad_ver', 'Dificultad para comunicarse: ver'),
        t('dificultad_oir', 'Dificultad para comunicarse: oír'),
        t('protesis_auditiva', 'Prótesis auditiva'),
        t('ayudas_tecnicas', 'Sistemas de productos y tecnología (bastones, muletas, andadores, sillas de ruedas, otros)'),
        a('otros_fisicos', 'Otros, si cabe destacar (física)'),
      ],
    },
    {
      titulo: 'Valoración psicológica',
      campos: [
        a('antecedentes_psicologicos', 'Antecedentes psicológicos (según informes médicos)'),
        a('valoracion_cognitiva', 'Valoración cognitiva y conducta'),
        a('valoracion_afectiva', 'Valoración afectiva'),
        a('otros_psicologicos', 'Otros, si cabe destacar (psicológica)'),
      ],
    },
    {
      titulo: 'Ocio, tiempo libre y participación social',
      campos: [
        t('nivel_participacion', 'Nivel de participación en actividades'),
        t('capacidad_relacionarse', 'Capacidad de relacionarse y participar'),
        t('facilidad_actividades', 'Facilidad para realizar actividades planificadas'),
        t('capacidad_objetivos_propios', 'Capacidad para establecer objetivos propios'),
        a('otros_ocio', 'Otros, si cabe destacar (ocio)'),
      ],
    },
    {
      titulo: 'Propuesta de trabajo individualizado',
      campos: [
        {
          tipo: 'filas',
          clave: 'propuesta',
          etiqueta: 'Áreas de trabajo (trabajo social, integración social, psicología, fisioterapia, terapia ocupacional)',
          columnas: [
            { clave: 'area', etiqueta: 'Área' },
            { clave: 'objetivo_general', etiqueta: 'Objetivo general' },
            { clave: 'objetivos_especificos', etiqueta: 'Objetivos específicos' },
            { clave: 'acciones', etiqueta: 'Acciones / intervenciones' },
            { clave: 'temporalizacion', etiqueta: 'Temporalización' },
            { clave: 'evaluacion', etiqueta: 'Evaluación' },
          ],
        },
      ],
    },
    {
      titulo: 'Equipo de valoración',
      campos: [{ tipo: 'filas', clave: 'equipo', etiqueta: 'Equipo de valoración multidisciplinar', columnas: COLUMNAS_EQUIPO }],
    },
    {
      titulo: 'Revisión del PAI (cada 6 meses como mínimo)',
      campos: [
        f('fecha_revision', 'Fecha de revisión'),
        { tipo: 'filas', clave: 'seguimiento', etiqueta: 'Seguimiento de objetivos', columnas: COLUMNAS_SEGUIMIENTO },
        a('modificaciones_propuestas', 'Modificaciones propuestas'),
      ],
    },
  ],
};

const PLAN_VIDA: PlanModelo = {
  id: 'crm_plan_vida',
  nombre: 'Plan de atención y vida',
  descripcion: 'Plan de atención y vida (modelo AICP)',
  secciones: [
    {
      titulo: 'Datos personales',
      campos: [
        t('nombre_apellidos', 'Nombre y apellidos'),
        f('fecha_alta_recurso', 'Fecha de alta en el recurso'),
        t('nombre_residencia', 'Nombre de la residencia'),
        t('dni', 'DNI'),
        f('fecha_nacimiento', 'Fecha de nacimiento'),
        t('lugar_nacimiento', 'Lugar de nacimiento'),
        t('domicilio_particular', 'Domicilio particular'),
        t('telefono_contacto', 'Teléfono de contacto'),
        a('profesionales_referencia', 'Profesionales de referencia'),
      ],
    },
    {
      titulo: 'ABVD (actividades básicas de la vida diaria)',
      campos: [
        ...abvd('aseo_higiene', 'Aseo-higiene'),
        ...abvd('vestido', 'Vestido'),
        ...abvd('alimentacion', 'Alimentación'),
        ...abvd('sueno', 'Sueño'),
      ],
    },
    {
      titulo: 'AIVD (actividades instrumentales de la vida diaria)',
      campos: [
        ...abvd('tareas_hogar', 'Tareas del hogar'),
        ...abvd('manejo_dinero', 'Manejo del dinero'),
        ...abvd('desplazamiento_transportes', 'Desplazamiento independiente-transportes'),
        ...abvd('medicacion', 'Medicación'),
      ],
    },
    {
      titulo: 'Habilidades',
      campos: [
        a('cognitivas', 'Cognitivas: memoria, atención, razonamiento, cálculo, orientación, lenguaje'),
        a('sociales', 'Sociales: relaciones interpersonales, empatía, asertividad'),
        a('emocionales', 'Emocionales: autopercepción, autoestima, gestión de emociones'),
        a('sensoriales', 'Sensoriales: olores, sabores, vista, escucha, temperatura, tacto'),
        a('laborales_formativas', 'Laborales y formativas'),
        a('otros_datos_interes', 'Otros datos de interés'),
      ],
    },
    {
      titulo: 'Vida personal',
      campos: [
        a('relaciones_familiares', 'Relaciones familiares'),
        a('vinculos_recurso', 'Vínculos en el recurso'),
        a('ocio_tiempo_libre', 'Ocio y tiempo libre'),
        a('autonomia', 'Autonomía'),
        a('otros_recursos', 'Otros recursos'),
      ],
    },
    {
      titulo: 'Objetivos',
      campos: [
        {
          tipo: 'filas',
          clave: 'objetivos',
          etiqueta: 'Objetivos',
          columnas: [
            { clave: 'objetivo', etiqueta: 'Objetivo' },
            { clave: 'area', etiqueta: 'Área' },
            { clave: 'desarrollo_actividad_intervencion', etiqueta: 'Desarrollo, actividad e intervención' },
          ],
        },
      ],
    },
    {
      titulo: 'Revisión y firma',
      campos: [
        f('fecha_revision', 'Fecha de revisión'),
        t('firma_equipo', 'Firma equipo de apoyo y consenso'),
      ],
    },
  ],
};

const PAI_PIR: PlanModelo = {
  id: 'crm_pai_pir',
  nombre: 'PAI/PIR',
  descripcion: 'Programa de Atención Individual / Plan Individualizado de Rehabilitación (PG 00, Anexo II)',
  secciones: [
    {
      titulo: 'Datos personales',
      campos: [
        t('tipo_plan', 'Tipo de plan (PAI/PIR inicial o revisión n.º)'),
        f('fecha_elaboracion', 'Fecha de elaboración'),
        t('nombre_apellidos', 'Nombre y apellidos'),
        f('fecha_nacimiento', 'Fecha de nacimiento'),
        t('dni_nie', 'DNI/NIE'),
        f('fecha_incorporacion', 'Fecha de incorporación al centro'),
        t('direccion_actual', 'Dirección actual'),
        t('telefonos_contacto', 'Teléfonos de contacto'),
        t('persona_referencia', 'Persona de referencia (nombre, parentesco y teléfono)'),
        t('representante_legal', 'Representante legal / medidas de apoyo (Ley 8/2021)'),
        t('guardador_hecho', 'Guardador/a de hecho (en su caso)'),
        t('profesional_referencia_crps', 'Profesional de referencia (tutor/a) en el CRPS'),
      ],
    },
    {
      titulo: 'Datos sociosanitarios',
      campos: [
        t('centro_salud', 'Centro de salud y médico/a de atención primaria'),
        t('telefono_centro_salud', 'Teléfono del centro de salud'),
        t('usm', 'Unidad de Salud Mental (USM)'),
        t('psiquiatra_usm', 'Psiquiatra de referencia de la USM'),
        t('telefono_usm', 'Teléfono de la USM'),
        a('diagnostico', 'Diagnóstico (según informe médico)'),
        t('grado_discapacidad', 'Grado de discapacidad'),
        t('grado_dependencia', 'Grado de dependencia'),
        a('tratamiento_farmacologico', 'Tratamiento farmacológico vigente (según informe)'),
        t('alergias', 'Alergias'),
        {
          tipo: 'select',
          clave: 'supervision_medicacion',
          etiqueta: 'Supervisión de la medicación autorizada',
          opciones: [
            { valor: 'si', etiqueta: 'Sí (autorización firmada)' },
            { valor: 'no', etiqueta: 'No' },
          ],
        },
      ],
    },
    {
      titulo: 'Síntesis de antecedentes y metas personales',
      campos: [
        a('sintesis_antecedentes', 'Síntesis de antecedentes relevantes'),
        a('metas_personales', 'Metas personales de la persona usuaria (en sus propias palabras)'),
      ],
    },
    {
      titulo: 'Autonomía: autocuidados',
      campos: [
        nivelPir('higiene_personal', 'Higiene personal'),
        nivelPir('vestido_imagen', 'Vestido e imagen personal'),
        nivelPir('habitos_alimentacion', 'Hábitos de alimentación'),
        nivelPir('sueno_descanso', 'Sueño y descanso'),
        nivelPir('cuidado_salud', 'Cuidado de la propia salud'),
      ],
    },
    {
      titulo: 'Autonomía: actividades instrumentales',
      campos: [
        nivelPir('compras', 'Compras'),
        nivelPir('preparacion_comidas', 'Preparación de comidas'),
        nivelPir('tareas_domesticas', 'Tareas domésticas'),
        nivelPir('manejo_dinero', 'Manejo del dinero'),
        nivelPir('uso_transporte', 'Uso del transporte'),
        nivelPir('uso_telefono_tecnologia', 'Uso del teléfono y la tecnología'),
        nivelPir('gestion_medicacion', 'Gestión de la medicación'),
        nivelPir('gestion_citas_tramites', 'Gestión de citas médicas y trámites'),
      ],
    },
    {
      titulo: 'Autonomía: actividades avanzadas',
      campos: [
        nivelPir('ocio_tiempo_libre', 'Ocio y tiempo libre'),
        nivelPir('relaciones_sociales', 'Relaciones sociales'),
        nivelPir('participacion_comunitaria', 'Participación comunitaria'),
        nivelPir('formacion_prelaboral', 'Formación / actividad prelaboral'),
        nivelPir('actividad_fisica', 'Actividad física y deporte'),
      ],
    },
    {
      titulo: 'Valoración psicológica (psicólogo/a general sanitario/a)',
      campos: [
        a('antecedentes_psiquiatricos_psicologicos', 'Antecedentes psiquiátricos y psicológicos'),
        a('psicopatologia_actual', 'Psicopatología actual'),
        a('conciencia_enfermedad_adherencia', 'Conciencia de enfermedad y adherencia'),
        a('consumo_toxicos', 'Consumo de tóxicos'),
        a('funciones_cognitivas', 'Funciones cognitivas'),
        a('estado_afectivo_riesgo_autolitico', 'Estado afectivo y riesgo autolítico'),
        a('motivacion_objetivos', 'Motivación y capacidad para fijar objetivos'),
      ],
    },
    {
      titulo: 'Valoración social y de integración comunitaria (TS y TIS)',
      campos: [
        a('historia_social_familiar', 'Historia social y familiar'),
        a('red_apoyo', 'Red de apoyo y persona de referencia'),
        a('convivencia_vivienda', 'Convivencia y vivienda'),
        a('situacion_legal', 'Situación legal y medidas de apoyo'),
        a('situacion_economica', 'Situación económica y gestiones'),
        a('formacion_antecedentes_laborales', 'Formación y antecedentes laborales'),
        a('recursos_comunitarios_ocio', 'Uso de recursos comunitarios, ocio, creencias y valores'),
        a('habilidades_sociales', 'Habilidades sociales y de comunicación'),
        a('necesidades_familia', 'Necesidades de la familia o persona de referencia'),
      ],
    },
    {
      titulo: 'Valoración ocupacional y funcional (terapeuta ocupacional)',
      campos: [
        a('desempeno_ocupacional', 'Desempeño ocupacional (ABVD, AIVD y avanzadas)'),
        a('rutinas_habitos_roles', 'Rutinas, hábitos y roles'),
        a('intereses_motivacion_ocupacional', 'Intereses y motivación ocupacional'),
        a('gestion_salud_medicacion', 'Gestión de la salud y de la medicación'),
        a('cognicion_desempeno_diario', 'Cognición en el desempeño diario'),
        a('entorno_domestico_comunitario', 'Entorno doméstico y comunitario (apoyos y recursos)'),
        {
          tipo: 'filas',
          clave: 'instrumentos',
          etiqueta: 'Instrumentos aplicados',
          columnas: [
            { clave: 'instrumento', etiqueta: 'Instrumento' },
            { clave: 'fecha', etiqueta: 'Fecha' },
            { clave: 'resultado', etiqueta: 'Resultado / puntuación' },
          ],
        },
      ],
    },
    {
      titulo: 'Plan de prevención de recaídas',
      campos: [
        a('senales_alerta', 'Señales de alerta'),
        a('factores_desencadenantes', 'Factores desencadenantes'),
        a('estrategias_afrontamiento', 'Estrategias de afrontamiento acordadas'),
        a('personas_apoyo_contactos', 'Personas de apoyo y contactos (familia, USM, otros)'),
        a('actuacion_crisis', 'Actuación acordada en caso de crisis'),
      ],
    },
    {
      titulo: 'Propuesta de trabajo individualizado e indicadores de logro',
      campos: [
        {
          tipo: 'filas',
          clave: 'objetivos',
          etiqueta: 'Objetivos por área (psicológica, social, integración comunitaria, ocupacional)',
          columnas: [
            { clave: 'area', etiqueta: 'Área' },
            { clave: 'objetivo_general', etiqueta: 'Objetivo general' },
            { clave: 'objetivos_especificos', etiqueta: 'Objetivos específicos (concretos y medibles)' },
            { clave: 'programas_centro', etiqueta: 'Programa(s) del centro (n.º)' },
            { clave: 'acciones', etiqueta: 'Acciones / intervenciones' },
            { clave: 'profesional_responsable', etiqueta: 'Profesional responsable' },
            { clave: 'temporalizacion', etiqueta: 'Temporalización' },
            { clave: 'indicador_logro', etiqueta: 'Indicador de logro' },
          ],
        },
      ],
    },
    {
      titulo: 'Equipo interdisciplinar y conformidad',
      campos: [
        {
          tipo: 'filas',
          clave: 'equipo_interdisciplinar',
          etiqueta: 'Equipo interdisciplinar',
          columnas: [
            { clave: 'nombre', etiqueta: 'Nombre y apellidos' },
            { clave: 'categoria', etiqueta: 'Categoría profesional' },
            { clave: 'firma', etiqueta: 'Firma' },
          ],
        },
        t('firma_persona_usuaria', 'Firma de la persona usuaria'),
        t('firma_representante', 'Firma del/de la representante legal o persona de apoyo (en su caso)'),
        f('fecha_conformidad', 'Fecha de conformidad'),
      ],
    },
    {
      titulo: 'Revisión del PAI/PIR (mínimo cada seis meses)',
      campos: [
        f('fecha_revision', 'Fecha de revisión'),
        {
          tipo: 'filas',
          clave: 'seguimiento',
          etiqueta: 'Seguimiento de objetivos',
          columnas: [
            { clave: 'area', etiqueta: 'Área' },
            { clave: 'objetivo', etiqueta: 'Objetivo' },
            { clave: 'seguimiento', etiqueta: 'Seguimiento' },
            { clave: 'grado_logro', etiqueta: 'Grado de logro (logrado, en proceso, no logrado)' },
            { clave: 'nuevos_objetivos', etiqueta: 'Nuevos objetivos' },
          ],
        },
        a('modificaciones_propuestas', 'Modificaciones propuestas'),
        a('actualizacion_prevencion_recaidas', 'Plan de prevención de recaídas: actualización'),
        {
          tipo: 'filas',
          clave: 'equipo_revision',
          etiqueta: 'Equipo interdisciplinar (revisión)',
          columnas: [
            { clave: 'nombre', etiqueta: 'Nombre y apellidos' },
            { clave: 'categoria', etiqueta: 'Categoría profesional' },
            { clave: 'firma', etiqueta: 'Firma' },
          ],
        },
        t('firma_revision_persona_usuaria', 'Firma de la persona usuaria (conformidad con la revisión)'),
        t('firma_revision_representante', 'Firma del/de la representante legal o persona de apoyo (revisión)'),
      ],
    },
  ],
};

const PLAN_INTERVENCION_SOCIAL: PlanModelo = {
  id: 'crm_plan_intervencion_social',
  nombre: 'Plan de intervención social',
  descripcion: 'Plan de intervención social (IASS / SERCA)',
  secciones: [
    {
      titulo: 'Datos de la persona usuaria',
      campos: [
        t('nombre_apellidos', 'Nombre y apellidos'),
        t('dni_nie', 'DNI/NIE'),
        f('fecha_alta_servicio', 'Fecha de alta en el servicio'),
        f('fecha_nacimiento', 'Fecha de nacimiento'),
        t('estado_civil', 'Estado civil'),
        t('domicilio', 'Domicilio'),
        t('cp_municipio', 'CP / Municipio'),
        a('personas_contacto', 'Personas, teléfonos y correos de contacto'),
      ],
    },
    {
      titulo: 'Datos sociodemográficos',
      campos: [
        t('regimen_asistencia_sanitaria', 'Régimen de asistencia sanitaria'),
        t('nivel_grado_dependencia', 'Nivel y grado de dependencia'),
        t('grado_discapacidad', 'Grado de discapacidad'),
        t('incapacidad_legal', 'Incapacidad legal'),
        t('num_afiliacion_ss', 'Nº de afiliación a la Seguridad Social'),
        t('centro_salud', 'Centro de salud al que está adscrito'),
        t('medico_atencion_primaria', 'Médico/a de atención primaria'),
      ],
    },
    {
      titulo: 'Profesionales que intervienen en el plan',
      campos: [
        {
          tipo: 'filas',
          clave: 'profesionales',
          etiqueta: 'Profesionales',
          columnas: COLUMNAS_EQUIPO,
        },
      ],
    },
    {
      titulo: 'Antecedentes familiares',
      campos: [a('antecedente_familiar', 'Antecedente familiar')],
    },
    {
      titulo: 'Valoración inicial: salud',
      campos: [
        a('diagnosticos', 'Diagnósticos'),
        a('salud_percibida', 'Salud percibida'),
        a('nivel_funcional_abvd', 'Nivel funcional en las ABVD (deficitarios, limitaciones y capacidades)'),
        a('nivel_cognitivo', 'Nivel cognitivo (deficitarios, limitaciones y capacidades)'),
        a('nivel_emocional', 'Nivel emocional (deficitarios, limitaciones y capacidades)'),
      ],
    },
    {
      titulo: 'Valoración inicial: capacidad en la toma de decisiones',
      campos: [
        a('decisiones_cotidianas_sencillas', 'Situaciones cotidianas sencillas'),
        a('decisiones_complejas', 'Situaciones de mayor complejidad'),
      ],
    },
    {
      titulo: 'Valoración inicial: relaciones y apoyo social',
      campos: [
        a('apoyo_informal', 'Apoyo informal (familia, amigos/as y vecinos/as)'),
        a('apoyo_formal', 'Apoyo formal (servicios profesionales, intervenciones en el domicilio, voluntariado)'),
        a('percepcion_apoyo', 'Percepción del apoyo que recibe'),
        a('participacion_social', 'Participación social (centros sociales, asociaciones)'),
        a('dificultades_relaciones', 'Dificultades en las relaciones sociales'),
        a('fortalezas_relaciones', 'Fortalezas en las relaciones sociales'),
      ],
    },
    {
      titulo: 'Valoración inicial: ocio y entorno',
      campos: [
        a('intereses_ocio', 'Intereses relacionados con aficiones y ocio'),
        a('ocio_organizado', 'Participación en actividades de ocio organizadas'),
        a('actividades_propias', 'Actividades gratificantes que suele realizar por su cuenta'),
        a('domicilio_habitual', 'Entorno: domicilio habitual (accesibilidad y adecuación)'),
        a('barrio', 'Entorno: barrio'),
        a('otros_lugares', 'Entorno: otros lugares'),
      ],
    },
    {
      titulo: 'Objetivos de intervención',
      campos: [a('objetivos_intervencion', 'Objetivos de intervención')],
    },
    {
      titulo: 'Propuesta de atención: servicios',
      campos: [
        a('servicio_accion_social', 'Servicio de acción social'),
        a('servicios_cuidado_personal', 'Servicios de apoyo al cuidado personal (peluquería, podología, apoyo a las ABVD)'),
        a('servicio_permanencia_vivienda', 'Servicio para la permanencia y mantenimiento de la vivienda'),
        a('servicios_salud_prevencion', 'Servicios para el fomento de la salud y prevención de enfermedades (prevención, logopedia)'),
        a('servicios_alimentacion_lavanderia', 'Servicio de alimentación, lavandería, mantenimiento, transporte'),
        a('otros_servicios', 'Otros servicios'),
      ],
    },
    {
      titulo: 'Propuesta de atención: apoyos que precisa',
      campos: [
        a('productos_apoyo', 'Productos de apoyo'),
        a('medidas_intervencion_ambiental', 'Medidas de intervención ambiental (supresión de barreras, adaptaciones, seguridad, confort)'),
        a('otros_apoyos', 'Otros apoyos (simplificación de tareas, apoyo en la comunicación, apoyo de otras personas)'),
      ],
    },
    {
      titulo: 'Pautas para la atención personalizada e intervención con familias',
      campos: [
        a('habitos_gratificantes', 'Hábitos cotidianos gratificantes a mantener/reforzar'),
        a('preferencias_servicio', 'Preferencias relacionadas con el servicio'),
        a('otras_pautas', 'Otras pautas'),
        a('orientaciones_buen_cuidado', 'Orientaciones para el buen cuidado de la persona'),
        a('servicio_respiro_familiar', 'Servicio de respiro familiar'),
        a('orientaciones_cuidado', 'Orientaciones para el cuidado'),
      ],
    },
    {
      titulo: 'Planificación de las actuaciones',
      campos: [a('planificacion_actuaciones', 'Planificación de las actuaciones')],
    },
    {
      titulo: 'Seguimientos y ajustes del plan',
      campos: [
        t('profesional_referencia', 'Profesional de referencia'),
        {
          tipo: 'filas',
          clave: 'revisiones',
          etiqueta: 'Revisiones y seguimientos',
          columnas: [
            { clave: 'fecha', etiqueta: 'Fecha' },
            { clave: 'valoracion_cumplimiento', etiqueta: 'Breve valoración del cumplimiento del plan' },
            { clave: 'modificaciones_acordadas', etiqueta: 'Modificaciones acordadas' },
          ],
        },
      ],
    },
    {
      titulo: 'Declaración de toma de decisiones compartidas',
      campos: [
        a('declaracion_persona_usuaria', 'Persona usuaria (o persona representante)'),
        a('declaracion_equipo', 'Miembros del equipo profesional'),
        f('fecha_declaracion', 'Fecha'),
      ],
    },
  ],
};

export const PLANES_MODELO: PlanModelo[] = [PAI_RESIDENCIA, PAI_SPAP, PLAN_VIDA, PAI_PIR, PLAN_INTERVENCION_SOCIAL];

export function getPlanModelo(id: TablaPlan): PlanModelo {
  const modelo = PLANES_MODELO.find(m => m.id === id);
  if (!modelo) throw new Error(`Modelo de plan desconocido: ${id}`);
  return modelo;
}
