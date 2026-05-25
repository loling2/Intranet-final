export interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  serial: string;
  active: boolean;
  assignedDate: string;
}

export interface VacationBalance {
  total: number;
  used: number;
  pending: number;
}

export interface VacationRequest {
  id: string;
  from: string;
  to: string;
  days: number;
  status: 'aprobada' | 'pendiente' | 'rechazada';
  reason: string;
}

export const mockDocuments: Record<string, Document[]> = {
  alfa: [
    { id: '1', name: 'Contrato Laboral 2024', type: 'PDF', date: '2024-01-15', size: '2.4 MB' },
    { id: '2', name: 'Nomina Enero 2025', type: 'PDF', date: '2025-01-31', size: '340 KB' },
    { id: '3', name: 'Nomina Febrero 2025', type: 'PDF', date: '2025-02-28', size: '345 KB' },
    { id: '4', name: 'Certificado Retenciones 2024', type: 'PDF', date: '2025-03-01', size: '180 KB' },
    { id: '5', name: 'Poliza Seguro Medico', type: 'PDF', date: '2024-06-01', size: '1.1 MB' },
  ],
  beta: [
    { id: '1', name: 'Contrato Indefinido', type: 'PDF', date: '2023-09-01', size: '2.8 MB' },
    { id: '2', name: 'Nomina Marzo 2025', type: 'PDF', date: '2025-03-31', size: '355 KB' },
    { id: '3', name: 'Acuerdo Confidencialidad', type: 'PDF', date: '2023-09-01', size: '420 KB' },
    { id: '4', name: 'Manual del Empleado', type: 'PDF', date: '2024-01-10', size: '5.2 MB' },
  ],
  gamma: [
    { id: '1', name: 'Contrato Temporal Q2', type: 'PDF', date: '2025-04-01', size: '1.9 MB' },
    { id: '2', name: 'Nomina Abril 2025', type: 'PDF', date: '2025-04-30', size: '330 KB' },
    { id: '3', name: 'Evaluacion Desempeno 2024', type: 'XLSX', date: '2025-01-20', size: '290 KB' },
    { id: '4', name: 'Plan Formacion 2025', type: 'PDF', date: '2025-02-15', size: '780 KB' },
    { id: '5', name: 'Certificado IRPF 2024', type: 'PDF', date: '2025-03-10', size: '150 KB' },
    { id: '6', name: 'Nomina Mayo 2025', type: 'PDF', date: '2025-05-15', size: '338 KB' },
  ],
  delta: [
    { id: '1', name: 'Contrato Practicas', type: 'PDF', date: '2025-01-15', size: '1.5 MB' },
    { id: '2', name: 'Nomina Enero 2025', type: 'PDF', date: '2025-01-31', size: '280 KB' },
    { id: '3', name: 'Convenio Colectivo', type: 'PDF', date: '2024-11-20', size: '3.4 MB' },
  ],
};

export const mockDevices: Record<string, Device[]> = {
  alfa: [
    { id: '1', name: 'Laptop Dell Latitude 5540', type: 'Portatil', serial: 'DL5540-A7K2', active: true, assignedDate: '2024-01-15' },
    { id: '2', name: 'Monitor LG 27" 4K', type: 'Monitor', serial: 'LG27UK-9M3X', active: true, assignedDate: '2024-01-15' },
    { id: '3', name: 'iPhone 15 Pro', type: 'Movil', serial: 'IP15P-B2N4', active: true, assignedDate: '2024-03-01' },
    { id: '4', name: 'Teclado Logitech MX', type: 'Periferico', serial: 'LMX-K8P1', active: false, assignedDate: '2023-06-10' },
  ],
  beta: [
    { id: '1', name: 'MacBook Pro 14"', type: 'Portatil', serial: 'MBP14-C5R7', active: true, assignedDate: '2023-09-01' },
    { id: '2', name: 'Monitor Samsung 32"', type: 'Monitor', serial: 'SM32-D2T9', active: true, assignedDate: '2023-09-01' },
    { id: '3', name: 'Samsung Galaxy S24', type: 'Movil', serial: 'SGS24-E4W6', active: true, assignedDate: '2024-02-15' },
    { id: '4', name: 'Docking Station HP', type: 'Periferico', serial: 'HPDS-F1Q3', active: true, assignedDate: '2023-09-01' },
    { id: '5', name: 'iPad Air M2', type: 'Tablet', serial: 'IPAM2-G7V2', active: false, assignedDate: '2024-05-20' },
  ],
  gamma: [
    { id: '1', name: 'HP EliteBook 840', type: 'Portatil', serial: 'HP840-H3J5', active: true, assignedDate: '2025-04-01' },
    { id: '2', name: 'Mouse inalambrico', type: 'Periferico', serial: 'MW-K2L8', active: true, assignedDate: '2025-04-01' },
    { id: '3', name: 'Telefono escritorio', type: 'VoIP', serial: 'VOIP-M4N6', active: false, assignedDate: '2024-08-15' },
  ],
  delta: [
    { id: '1', name: 'Lenovo ThinkPad T14', type: 'Portatil', serial: 'LTP14-P9R1', active: true, assignedDate: '2025-01-15' },
    { id: '2', name: 'Monitor Philips 24"', type: 'Monitor', serial: 'PH24-S2T4', active: true, assignedDate: '2025-01-15' },
    { id: '3', name: 'Auriculares Jabra', type: 'Periferico', serial: 'JB-U5W7', active: true, assignedDate: '2025-02-01' },
    { id: '4', name: 'Tablet Surface Go', type: 'Tablet', serial: 'SG-V3X8', active: false, assignedDate: '2024-11-01' },
  ],
};

export const mockVacations: Record<string, { balance: VacationBalance; requests: VacationRequest[] }> = {
  alfa: {
    balance: { total: 22, used: 8, pending: 3 },
    requests: [
      { id: '1', from: '2025-04-14', to: '2025-04-18', days: 5, status: 'aprobada', reason: 'Viaje familiar' },
      { id: '2', from: '2025-07-07', to: '2025-07-11', days: 5, status: 'pendiente', reason: 'Vacaciones de verano' },
      { id: '3', from: '2025-08-25', to: '2025-08-27', days: 3, status: 'pendiente', reason: 'Asuntos personales' },
      { id: '4', from: '2025-01-06', to: '2025-01-08', days: 3, status: 'aprobada', reason: 'Reyes Magos' },
    ],
  },
  beta: {
    balance: { total: 24, used: 12, pending: 4 },
    requests: [
      { id: '1', from: '2025-03-10', to: '2025-03-14', days: 5, status: 'aprobada', reason: 'Semana Santa' },
      { id: '2', from: '2025-06-16', to: '2025-06-27', days: 10, status: 'aprobada', reason: 'Vacaciones verano' },
      { id: '3', from: '2025-09-01', to: '2025-09-05', days: 4, status: 'pendiente', reason: 'Puente de septiembre' },
      { id: '4', from: '2025-12-22', to: '2025-12-24', days: 3, status: 'pendiente', reason: 'Navidad' },
      { id: '5', from: '2025-02-03', to: '2025-02-04', days: 2, status: 'rechazada', reason: 'Cita medica' },
    ],
  },
  gamma: {
    balance: { total: 20, used: 3, pending: 2 },
    requests: [
      { id: '1', from: '2025-05-19', to: '2025-05-21', days: 3, status: 'aprobada', reason: 'Boda familiar' },
      { id: '2', from: '2025-08-04', to: '2025-08-05', days: 2, status: 'pendiente', reason: 'Tramites personales' },
    ],
  },
  delta: {
    balance: { total: 18, used: 5, pending: 2 },
    requests: [
      { id: '1', from: '2025-03-17', to: '2025-03-19', days: 3, status: 'aprobada', reason: 'San Jose' },
      { id: '2', from: '2025-04-21', to: '2025-04-23', days: 2, status: 'aprobada', reason: 'Puente de abril' },
      { id: '3', from: '2025-07-28', to: '2025-07-29', days: 2, status: 'pendiente', reason: 'Puente de julio' },
    ],
  },
};

export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  date: string;
  expiryDate: string;
  code: string;
  category: string;
}

export interface Exam {
  id: string;
  title: string;
  course: string;
  date: string;
  duration: string;
  status: 'pendiente' | 'en_curso' | 'completado' | 'suspendido';
  score: number | null;
  attempts: number;
}

export const mockCertificates: Record<string, Certificate[]> = {
  alfa: [
    { id: '1', title: 'Prevencion de Riesgos Laborales', issuer: 'Instituto de Seguridad', date: '2024-03-15', expiryDate: '2027-03-15', code: 'PRL-2024-0451', category: 'Seguridad' },
    { id: '2', title: 'Excel Avanzado para Empresas', issuer: 'Microsoft Academy', date: '2024-06-20', expiryDate: '2026-06-20', code: 'MSA-2024-7823', category: 'Informatica' },
    { id: '3', title: 'Gestion de Proyectos PMP', issuer: 'PMI Institute', date: '2023-11-10', expiryDate: '2026-11-10', code: 'PMP-2023-1190', category: 'Gestion' },
    { id: '4', title: 'Primeros Auxilios', issuer: 'Cruz Roja', date: '2024-09-01', expiryDate: '2026-09-01', code: 'CR-2024-5567', category: 'Seguridad' },
    { id: '5', title: 'Comunicacion Efectiva', issuer: 'Escuela de Negocios', date: '2025-01-18', expiryDate: '2028-01-18', code: 'EN-2025-0034', category: 'Habilidades' },
    { id: '6', title: 'Proteccion de Datos GDPR', issuer: 'Agencia Espanola de Proteccion de Datos', date: '2024-04-05', expiryDate: '2025-04-05', code: 'GDPR-2024-8821', category: 'Legal' },
  ],
  beta: [
    { id: '1', title: 'ISO 27001 Fundamentos', issuer: 'ISO Certification Board', date: '2024-02-10', expiryDate: '2027-02-10', code: 'ISO-2024-3340', category: 'Informatica' },
    { id: '2', title: 'Liderazgo y Coaching', issuer: 'Escuela de Negocios', date: '2024-07-22', expiryDate: '2027-07-22', code: 'EN-2024-6120', category: 'Habilidades' },
    { id: '3', title: 'Prevencion de Riesgos Laborales', issuer: 'Instituto de Seguridad', date: '2023-12-01', expiryDate: '2026-12-01', code: 'PRL-2023-9987', category: 'Seguridad' },
    { id: '4', title: 'Scrum Master Certificado', issuer: 'Scrum Alliance', date: '2024-10-15', expiryDate: '2026-10-15', code: 'SA-2024-4455', category: 'Gestion' },
  ],
  gamma: [
    { id: '1', title: 'Manipulacion de Alimentos', issuer: 'Sanidad Ambiental', date: '2025-02-01', expiryDate: '2028-02-01', code: 'SA-2025-1120', category: 'Seguridad' },
    { id: '2', title: 'Atencion al Cliente', issuer: 'Escuela de Negocios', date: '2025-03-10', expiryDate: '2028-03-10', code: 'EN-2025-7789', category: 'Habilidades' },
    { id: '3', title: 'Ofimatica Basica', issuer: 'Microsoft Academy', date: '2025-04-20', expiryDate: '2027-04-20', code: 'MSA-2025-5510', category: 'Informatica' },
  ],
  delta: [
    { id: '1', title: 'Prevencion de Riesgos Laborales', issuer: 'Instituto de Seguridad', date: '2025-01-20', expiryDate: '2028-01-20', code: 'PRL-2025-2201', category: 'Seguridad' },
    { id: '2', title: 'Introduccion a Python', issuer: 'Python Institute', date: '2025-02-28', expiryDate: '2027-02-28', code: 'PI-2025-8834', category: 'Informatica' },
    { id: '3', title: 'Trabajo en Equipo', issuer: 'Escuela de Negocios', date: '2025-03-15', expiryDate: '2028-03-15', code: 'EN-2025-3310', category: 'Habilidades' },
    { id: '4', title: 'Normativa Laboral Basica', issuer: 'Ministerio de Trabajo', date: '2025-04-10', expiryDate: '2026-04-10', code: 'MT-2025-6670', category: 'Legal' },
    { id: '5', title: 'Primeros Auxilios', issuer: 'Cruz Roja', date: '2025-05-01', expiryDate: '2027-05-01', code: 'CR-2025-9901', category: 'Seguridad' },
  ],
};

export const mockExams: Record<string, Exam[]> = {
  alfa: [
    { id: '1', title: 'Evaluacion PRL Nivel Basico', course: 'Prevencion de Riesgos Laborales', date: '2025-06-10', duration: '60 min', status: 'pendiente', score: null, attempts: 0 },
    { id: '2', title: 'Test Excel - Modulo 3', course: 'Excel Avanzado para Empresas', date: '2025-05-28', duration: '45 min', status: 'pendiente', score: null, attempts: 0 },
    { id: '3', title: 'Examen Final PMP', course: 'Gestion de Proyectos PMP', date: '2025-04-15', duration: '90 min', status: 'completado', score: 92, attempts: 1 },
    { id: '4', title: 'Evaluacion Primeros Auxilios', course: 'Primeros Auxilios', date: '2025-03-20', duration: '30 min', status: 'completado', score: 88, attempts: 1 },
    { id: '5', title: 'Test Comunicacion Efectiva', course: 'Comunicacion Efectiva', date: '2025-02-10', duration: '40 min', status: 'suspendido', score: 45, attempts: 2 },
    { id: '6', title: 'Examen GDPR', course: 'Proteccion de Datos GDPR', date: '2025-01-25', duration: '50 min', status: 'completado', score: 78, attempts: 1 },
  ],
  beta: [
    { id: '1', title: 'Examen ISO 27001', course: 'ISO 27001 Fundamentos', date: '2025-06-05', duration: '75 min', status: 'pendiente', score: null, attempts: 0 },
    { id: '2', title: 'Evaluacion Liderazgo', course: 'Liderazgo y Coaching', date: '2025-05-30', duration: '60 min', status: 'en_curso', score: null, attempts: 0 },
    { id: '3', title: 'Test PRL Basico', course: 'Prevencion de Riesgos Laborales', date: '2025-04-10', duration: '45 min', status: 'completado', score: 95, attempts: 1 },
    { id: '4', title: 'Examen Scrum Master', course: 'Scrum Master Certificado', date: '2025-03-18', duration: '90 min', status: 'completado', score: 81, attempts: 2 },
    { id: '5', title: 'Recuperacion Scrum Master', course: 'Scrum Master Certificado', date: '2025-02-20', duration: '90 min', status: 'suspendido', score: 52, attempts: 1 },
  ],
  gamma: [
    { id: '1', title: 'Examen Manipulacion Alimentos', course: 'Manipulacion de Alimentos', date: '2025-06-12', duration: '40 min', status: 'pendiente', score: null, attempts: 0 },
    { id: '2', title: 'Test Atencion al Cliente', course: 'Atencion al Cliente', date: '2025-05-25', duration: '30 min', status: 'completado', score: 90, attempts: 1 },
    { id: '3', title: 'Evaluacion Ofimatica', course: 'Ofimatica Basica', date: '2025-04-28', duration: '50 min', status: 'completado', score: 72, attempts: 1 },
  ],
  delta: [
    { id: '1', title: 'Evaluacion PRL', course: 'Prevencion de Riesgos Laborales', date: '2025-06-08', duration: '60 min', status: 'pendiente', score: null, attempts: 0 },
    { id: '2', title: 'Test Python Basico', course: 'Introduccion a Python', date: '2025-05-20', duration: '45 min', status: 'completado', score: 85, attempts: 1 },
    { id: '3', title: 'Evaluacion Trabajo en Equipo', course: 'Trabajo en Equipo', date: '2025-04-15', duration: '30 min', status: 'completado', score: 94, attempts: 1 },
    { id: '4', title: 'Examen Normativa Laboral', course: 'Normativa Laboral Basica', date: '2025-03-22', duration: '60 min', status: 'suspendido', score: 48, attempts: 1 },
    { id: '5', title: 'Test Primeros Auxilios', course: 'Primeros Auxilios', date: '2025-06-15', duration: '30 min', status: 'pendiente', score: null, attempts: 0 },
  ],
};

export type UserRole = 'admin' | 'rrhh' | 'employee';

export interface ValidUser {
  email: string;
  password: string;
  societyId: string | null;
  role: UserRole;
  name: string;
}

export const validUsers: ValidUser[] = [
  { email: 'admin@empresa.com', password: 'admin1234', societyId: null, role: 'admin', name: 'Administrador' },
  { email: 'rrhh@empresa.com', password: 'rrhh1234', societyId: null, role: 'rrhh', name: 'Responsable RRHH' },
  { email: 'alfa@empresa.com', password: '1234', societyId: 'alfa', role: 'employee', name: 'Empleado Alfa' },
  { email: 'beta@empresa.com', password: '1234', societyId: 'beta', role: 'employee', name: 'Empleado Beta' },
  { email: 'gamma@empresa.com', password: '1234', societyId: 'gamma', role: 'employee', name: 'Empleado Gamma' },
  { email: 'delta@empresa.com', password: '1234', societyId: 'delta', role: 'employee', name: 'Empleado Delta' },
];
