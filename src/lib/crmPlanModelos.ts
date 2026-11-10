export type TablaPlan = 'crm_pai_residencia' | 'crm_pai_spap' | 'crm_plan_vida';

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

export const PLANES_MODELO: PlanModelo[] = [PAI_RESIDENCIA, PAI_SPAP, PLAN_VIDA];

export function getPlanModelo(id: TablaPlan): PlanModelo {
  const modelo = PLANES_MODELO.find(m => m.id === id);
  if (!modelo) throw new Error(`Modelo de plan desconocido: ${id}`);
  return modelo;
}
