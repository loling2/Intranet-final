import { jsPDF } from 'jspdf';

export interface CertificateData {
  nombreEmpleado: string;
  dniEmpleado: string | null;
  nombreCurso: string;
  duracionCurso: string | null;
  fechaAprobacion: string;
  puntuacion: number;
  temas: string[];
  nombreEmpresa: string;
  logoDataUrl?: string | null;
  codigoVerificacion: string;
}

const teal = { r: 13, g: 148, b: 136 };
const slate = { r: 15, g: 23, b: 42 };
const muted = { r: 100, g: 116, b: 139 };

function drawPageFrame(doc: jsPDF, pageW: number, pageH: number): void {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setDrawColor(teal.r, teal.g, teal.b);
  doc.setLineWidth(2.5);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.7);
  doc.rect(12, 12, pageW - 24, pageH - 24);
}

function addLogo(doc: jsPDF, logoDataUrl: string | null | undefined, x: number, y: number): void {
  if (!logoDataUrl) return;
  const format = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  try { doc.addImage(logoDataUrl, format, x, y, 32, 22, undefined, 'FAST'); } catch { return; }
}

function addCode(doc: jsPDF, code: string, pageW: number, pageH: number): void {
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(`CSV: ${code}`, pageW - 20, pageH - 17, { align: 'right' });
}

export function generateCertificatePDF(data: CertificateData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cx = pageW / 2;
  const fecha = new Date(data.fechaAprobacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  drawPageFrame(doc, pageW, pageH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text('ACREDITACIÓN PROFESIONAL', cx, 38, { align: 'center' });
  doc.setFontSize(32);
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('CERTIFICADO', cx, 53, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text('Se certifica que', cx, 66, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.setTextColor(teal.r, teal.g, teal.b);
  doc.text(data.nombreEmpleado.toUpperCase(), cx, 81, { align: 'center' });
  if (data.dniEmpleado) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(`DNI: ${data.dniEmpleado}`, cx, 89, { align: 'center' });
  }
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text('ha superado satisfactoriamente el curso de formación', cx, 101, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(slate.r, slate.g, slate.b);
  const courseLines = doc.splitTextToSize(data.nombreCurso, 190);
  doc.text(courseLines, cx, 114, { align: 'center' });
  const courseBottom = 114 + (courseLines.length - 1) * 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(`${data.duracionCurso ? `${data.duracionCurso} · ` : ''}Puntuación: ${data.puntuacion}%`, cx, courseBottom + 12, { align: 'center' });
  doc.text(`Aprobado el ${fecha}`, cx, courseBottom + 20, { align: 'center' });
  doc.setDrawColor(teal.r, teal.g, teal.b);
  doc.setLineWidth(0.5);
  doc.line(cx - 40, courseBottom + 27, cx + 40, courseBottom + 27);
  doc.setFontSize(10);
  doc.text('Responsable de Formación', cx - 55, courseBottom + 45, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(cx - 80, courseBottom + 40, cx - 30, courseBottom + 40);
  addLogo(doc, data.logoDataUrl, cx + 39, Math.min(courseBottom + 29, pageH - 63));
  doc.setFontSize(10);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(data.nombreEmpresa, cx + 55, Math.min(courseBottom + 57, pageH - 35), { align: 'center' });
  addCode(doc, data.codigoVerificacion, pageW, pageH);

  doc.addPage('a4', 'landscape');
  drawPageFrame(doc, pageW, pageH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('CONTENIDOS SUPERADOS', cx, 36, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(`Curso: ${data.nombreCurso}`, cx, 47, { align: 'center' });
  doc.text(`Empleado: ${data.nombreEmpleado}`, cx, 54, { align: 'center' });

  let y = 70;
  const topics = data.temas.length > 0 ? data.temas : ['Contenido del curso'];
  topics.forEach((tema, index) => {
    if (y > pageH - 35) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(teal.r, teal.g, teal.b);
    doc.text(`Tema ${index + 1}`, 30, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(tema, pageW - 85);
    doc.text(lines, 60, y);
    y += Math.max(9, lines.length * 5 + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(30, y, pageW - 30, y);
    y += 7;
  });
  doc.setFontSize(9);
  doc.setTextColor(muted.r, muted.g, muted.b);
  doc.text(`Emitido por ${data.nombreEmpresa}`, cx, pageH - 18, { align: 'center' });
  addCode(doc, data.codigoVerificacion, pageW, pageH);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Certificado_${data.nombreEmpleado.replace(/\s+/g, '_')}_${data.nombreCurso.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
