import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

const LOGO_BLUE_RGB = [0, 64, 129];

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
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const generatedOn = new Date().toLocaleString();

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 98, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 34, 22, 54, 54);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(organizationName || 'Gurdwara', 102, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Volunteer Registration Sheet', 102, 58);
  doc.text(`Service: ${serviceName || '-'}`, 102, 72);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Registration List', pageWidth - 40, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Registrations: ${rows.length}`, pageWidth - 40, 60, { align: 'right' });
  doc.text(`Generated: ${generatedOn}`, pageWidth - 40, 74, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Date: ${serviceDate || '-'}`, 40, 114);
  doc.text(`Time: ${serviceTime || '-'}`, pageWidth / 2, 114);

  autoTable(doc, {
    startY: 126,
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

  const finalY = doc.lastAutoTable?.finalY || 260;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This report compiles all registrations captured for the selected service.', 40, Math.min(finalY + 20, pageHeight - 34));

  doc.save(fileName || 'registrations.pdf');
};

export const createDonationInvoicePdfBlob = async ({
  organizationName,
  address,
  phone,
  donation,
  campaignDescription = ''
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const invoiceDate = donation?.createdAt
    ? new Date(donation.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const purposeText = campaignDescription || `Support for ${donation?.campaignName || 'community seva'}`;

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 98, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 34, 22, 54, 54);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(organizationName || 'Gurdwara', 102, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(address || '', 102, 58);
  doc.text(phone || '', 102, 72);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Donation Invoice', pageWidth - 40, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${donation?.receiptId || donation?.id || '-'}`, pageWidth - 40, 60, { align: 'right' });
  doc.text(`Date: ${invoiceDate}`, pageWidth - 40, 74, { align: 'right' });

  autoTable(doc, {
    startY: 126,
    head: [['Field', 'Details']],
    body: [
      ['Donor Name', donation?.donorName || '-'],
      ['Donor Email', donation?.donorEmail || '-'],
      ['Campaign', donation?.campaignName || '-'],
      ['Purpose', purposeText],
      ['Amount', donation?.amount != null ? `$${Number(donation.amount).toFixed(2)}` : '-'],
      ['Frequency', donation?.frequency || '-'],
      ['Payment Provider', donation?.paymentProvider || '-'],
      ['Payment Status', donation?.paymentStatus || '-'],
      ['Gateway Transaction', donation?.gatewayTransactionId || '-']
    ],
    styles: {
      fontSize: 10,
      cellPadding: 7,
      valign: 'top'
    },
    headStyles: {
      fillColor: LOGO_BLUE_RGB,
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
      1: { cellWidth: 'auto' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  const finalY = doc.lastAutoTable?.finalY || 260;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Authorized Signature', 40, Math.min(finalY + 120, pageHeight - 70));
  doc.setDrawColor(148, 163, 184);
  doc.line(40, Math.min(finalY + 138, pageHeight - 55), 220, Math.min(finalY + 138, pageHeight - 55));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This invoice confirms the donation received for the specified campaign.', 40, Math.min(finalY + 160, pageHeight - 34));

  return doc.output('blob');
};

export const downloadDonationInvoicePdf = async (payload) => {
  const blob = await createDonationInvoicePdfBlob(payload);
  const fileName = payload?.fileName || `invoice-${payload?.donation?.receiptId || payload?.donation?.id || 'donation'}.pdf`;
  triggerFileDownload(blob, fileName);
};

export const downloadCampaignDonationsCsv = ({
  fileName,
  organizationName,
  campaignName,
  donations = []
}) => {
  const metadataRows = [
    ['Organization', organizationName || ''],
    ['Campaign', campaignName || ''],
    ['Total Donations', String(donations.length)],
    ['Generated On', new Date().toLocaleString()],
    []
  ];

  const headers = ['Date', 'Donor Name', 'Email', 'Amount', 'Frequency', 'Receipt', 'Status', 'Gateway Transaction'];
  const rows = donations.map((donation) => ([
    donation.createdAt ? new Date(donation.createdAt).toLocaleString() : '',
    donation.donorName || '',
    donation.donorEmail || '',
    donation.amount != null ? Number(donation.amount).toFixed(2) : '',
    donation.frequency || '',
    donation.receiptId || '',
    donation.paymentStatus || '',
    donation.gatewayTransactionId || ''
  ]));

  const csvData = [
    ...metadataRows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
    buildCsv(headers, rows)
  ].join('\n');

  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, fileName || 'campaign-donations.csv');
};

export const downloadCampaignDonationsPdf = async ({
  fileName,
  organizationName,
  campaignName,
  donations = []
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const generatedOn = new Date().toLocaleString();

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 98, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 34, 22, 54, 54);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(organizationName || 'Gurdwara', 102, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Campaign Donation Report', 102, 58);
  doc.text(`Campaign: ${campaignName || '-'}`, 102, 72);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Donor List', pageWidth - 40, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Donations: ${donations.length}`, pageWidth - 40, 60, { align: 'right' });
  doc.text(`Generated: ${generatedOn}`, pageWidth - 40, 74, { align: 'right' });

  autoTable(doc, {
    startY: 126,
    head: [['Date', 'Donor Name', 'Email', 'Amount', 'Frequency', 'Receipt'] ],
    body: donations.map((donation) => ([
      donation.createdAt ? new Date(donation.createdAt).toLocaleString() : '-',
      donation.donorName || '-',
      donation.donorEmail || '-',
      donation.amount != null ? `$${Number(donation.amount).toFixed(2)}` : '-',
      donation.frequency || '-',
      donation.receiptId || '-'
    ])),
    styles: {
      fontSize: 9,
      cellPadding: 5,
      valign: 'top'
    },
    headStyles: {
      fillColor: LOGO_BLUE_RGB,
      textColor: 255,
      fontStyle: 'bold'
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  const finalY = doc.lastAutoTable?.finalY || 260;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This report compiles all donation entries for the selected campaign.', 40, Math.min(finalY + 20, pageHeight - 34));

  doc.save(fileName || 'campaign-donations.pdf');
};
