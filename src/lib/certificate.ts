import { jsPDF } from 'jspdf';

export interface CertificateData {
  nombreEmpleado: string;
  dniEmpleado: string | null;
  nombreCurso: string;
  fechaAprobacion: string;
  puntuacion: number;
  modulos: { titulo: string; descripcion: string | null }[];
  nombreEmpresa: string;
}

export function generateCertificatePDF(data: CertificateData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cx = pageW / 2;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Decorative border
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(2.5);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.8);
  doc.setDrawColor(13, 148, 136);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Corner ornaments
  const cornerSize = 18;
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(1.5);
  const corners: [number, number, number, number][] = [
    [12, 12, cornerSize, 0],
    [12, 12, 0, cornerSize],
    [pageW - 12, 12, -cornerSize, 0],
    [pageW - 12, 12, 0, cornerSize],
    [12, pageH - 12, cornerSize, 0],
    [12, pageH - 12, 0, -cornerSize],
    [pageW - 12, pageH - 12, -cornerSize, 0],
    [pageW - 12, pageH - 12, 0, -cornerSize],
  ];
  corners.forEach(([x, y, dx, dy]) => {
    doc.line(x, y, x + dx, y + dy);
  });

  // Top decorative line
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.5);
  doc.line(cx - 40, 30, cx + 40, 30);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('ACREDITACION PROFESIONAL', cx, 38, { align: 'center' });

  doc.setFontSize(32);
  doc.setTextColor(15, 23, 42);
  doc.text('DIPLOMA', cx, 52, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Se certifica que', cx, 64, { align: 'center' });

  // Employee name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(13, 148, 136);
  doc.text(data.nombreEmpleado.toUpperCase(), cx, 78, { align: 'center' });

  if (data.dniEmpleado) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(`DNI: ${data.dniEmpleado}`, cx, 86, { align: 'center' });
  }

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text('ha superado satisfactoriamente el curso', cx, 96, { align: 'center' });

  // Course name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(data.nombreCurso, cx, 108, { align: 'center' });

  // Score
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`con una puntuacion de ${data.puntuacion}%`, cx, 118, { align: 'center' });

  // Date
  const fecha = new Date(data.fechaAprobacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Aprobado el ${fecha}`, cx, 126, { align: 'center' });

  // Bottom decorative line
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.5);
  doc.line(cx - 40, 132, cx + 40, 132);

  // Signatures
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('El Responsable de Formacion', cx - 55, 150, { align: 'center' });
  doc.text(data.nombreEmpresa, cx + 55, 150, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(cx - 80, 145, cx - 30, 145);
  doc.line(cx + 30, 145, cx + 80, 145);

  // Page 2: modules
  doc.addPage('a4', 'landscape');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(2);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.6);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('CONTENIDO DEL CURSO', cx, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Este diploma se ha obtenido por haber superado los siguientes modulos`, cx, 40, { align: 'center' });
  doc.text(`del curso "${data.nombreCurso}"`, cx, 47, { align: 'center' });

  let y = 62;
  const leftMargin = 30;
  const maxWidth = pageW - 60;
  data.modulos.forEach((m, i) => {
    if (y > pageH - 30) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136);
    doc.text(`Modulo ${i + 1}: ${m.titulo}`, leftMargin, y);
    y += 7;
    if (m.descripcion) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(m.descripcion, maxWidth);
      doc.text(lines, leftMargin, y);
      y += lines.length * 5 + 4;
    } else {
      y += 6;
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, y, pageW - 30, y);
    y += 6;
  });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Certificado generado el ${new Date().toLocaleDateString('es-ES')} - ${data.nombreEmpresa}`, cx, pageH - 18, { align: 'center' });

  doc.save(`Diploma_${data.nombreCurso.replace(/\s+/g, '_')}.pdf`);
}
