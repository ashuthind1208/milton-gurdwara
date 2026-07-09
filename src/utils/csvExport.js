import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

const escapeCsvCell = (value) => {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
};

const buildCsv = (headers = [], rows = []) => {
  const headerLine = headers.map((header) => escapeCsvCell(header)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return [headerLine, ...rowLines].join('\n');
};

const triggerFileDownload = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadCsv = ({ fileName, headers, rows }) => {
  const csvData = buildCsv(headers, rows);
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

  triggerFileDownload(blob, fileName || 'export.csv');
};

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const loadLogoDataUrl = async () => {
  try {
    const response = await fetch(gurdwaraLogo);
    if (!response.ok) {
      return '';
    }
    const blob = await response.blob();
    return await toDataUrl(blob);
  } catch {
    return '';
  }
};

export const downloadRegistrationCsv = ({
  fileName,
  organizationName,
  serviceName,
  serviceDate,
  serviceTime,
  headers,
  rows
}) => {
  const metadataRows = [
    ['Organization', organizationName || ''],
    ['Service', serviceName || ''],
    ['Date', serviceDate || '-'],
    ['Time', serviceTime || '-'],
    ['Generated On', new Date().toLocaleString()],
    []
  ];

  const csvData = [
    ...metadataRows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
    buildCsv(headers, rows)
  ].join('\n');

  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, fileName || 'registrations.csv');
};

export const downloadRegistrationPdf = async ({
  fileName,
  organizationName,
  serviceName,
  serviceDate,
  serviceTime,
  headers,
  rows
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoDataUrl = await loadLogoDataUrl();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 40, 30, 54, 54);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(organizationName || 'Gurdwara', 104, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Volunteer Registration Sheet', 104, 70);

  doc.setFontSize(10);
  doc.text(`Service: ${serviceName || '-'}`, 40, 104);
  doc.text(`Date: ${serviceDate || '-'}`, pageWidth / 2, 104);
  doc.text(`Time: ${serviceTime || '-'}`, 40, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 120);

  autoTable(doc, {
    startY: 138,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 10,
      cellPadding: 6
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold'
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  doc.save(fileName || 'registrations.pdf');
};
