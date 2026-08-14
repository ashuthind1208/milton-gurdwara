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

export const createBulkDonationStatementPdfBlob = async ({
  organizationName,
  address,
  phone,
  donor = {},
  donations = [],
  dateFrom = '',
  dateTo = ''
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const formatStatementDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
      : '-';
  };
  const totalAmount = donations.reduce((sum, donation) => sum + Number(donation?.amount || 0), 0);
  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? formatStatementDate(`${dateFrom}T00:00:00`) : 'Beginning'} to ${dateTo ? formatStatementDate(`${dateTo}T00:00:00`) : 'Present'}`
    : 'All dates';

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 112, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'WEBP', 34, 24, 62, 62);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(organizationName || 'Singh Sabha Milton Gurdwara', 112, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(address || '', 112, 59, { maxWidth: 330 });
  doc.text(phone || '', 112, 84);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Donation Statement', pageWidth - 34, 36, { align: 'right' });
  doc.setFontSize(11);
  doc.text(donor.name || 'Donor', pageWidth - 34, 56, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(donor.email || '-', pageWidth - 34, 72, { align: 'right' });
  if (donor.phone) {
    doc.text(donor.phone, pageWidth - 34, 88, { align: 'right' });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Statement period: ${periodLabel}`, 40, 136);
  doc.text(`Donations: ${donations.length}`, pageWidth / 2 - 40, 136);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: CAD $${totalAmount.toFixed(2)}`, pageWidth - 40, 136, { align: 'right' });

  autoTable(doc, {
    startY: 150,
    head: [['Date', 'Receipt', 'Donor Name', 'Campaign', 'Amount', 'Provider', 'Status']],
    body: donations.map((donation) => ([
      formatStatementDate(donation?.createdAt),
      donation?.receiptId || donation?.id || '-',
      donation?.donorName || donor.name || '-',
      donation?.campaignName || '-',
      donation?.amount != null ? `CAD $${Number(donation.amount).toFixed(2)}` : '-',
      donation?.paymentProvider || '-',
      donation?.paymentStatus || '-'
    ])),
    styles: { fontSize: 9, cellPadding: 6, valign: 'top' },
    headStyles: { fillColor: LOGO_BLUE_RGB, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { cellWidth: 105 },
      4: { cellWidth: 82, halign: 'right' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 40, pageHeight - 22, { align: 'right' });
    }
  });

  const finalY = doc.lastAutoTable?.finalY || 300;
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'This statement confirms the donation records received for the selected period. Please contact the Gurdwara office if any details need correction.',
    40,
    Math.min(finalY + 24, pageHeight - 34),
    { maxWidth: pageWidth - 80 }
  );

  return doc.output('blob');
};

const toDisplayLabel = (value, fallback = '-') => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }
  return normalized
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export const createBookingReceiptPdfBlob = async ({
  organizationName,
  address,
  phone,
  email,
  booking = {}
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();
  const receiptNumber = booking.receiptNumber || booking.id || 'Pending';
  const generatedOn = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 112, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'WEBP', 34, 24, 62, 62);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(organizationName || 'Singh Sabha Milton Gurdwara', 112, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(address || '', 112, 60);
  doc.text([phone, email].filter(Boolean).join('  |  '), 112, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Booking Receipt', pageWidth - 34, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Receipt: ${receiptNumber}`, pageWidth - 34, 61, { align: 'right' });
  doc.text(`Prepared: ${generatedOn}`, pageWidth - 34, 77, { align: 'right' });

  autoTable(doc, {
    startY: 140,
    head: [['Booking Information', 'Details']],
    body: [
      ['Booking Type', booking.categoryName || booking.title || '-'],
      ['Date', booking.date || '-'],
      ['Time', `${booking.startTime || '-'} - ${booking.endTime || '-'}`],
      ['Location', booking.bookingLocation || '-'],
      ['Booking Status', toDisplayLabel(booking.status)],
      ['Booking ID', booking.id || '-']
    ],
    styles: { fontSize: 10, cellPadding: 8, valign: 'top' },
    headStyles: { fillColor: LOGO_BLUE_RGB, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold', fillColor: [238, 245, 255], textColor: [0, 64, 129] },
      1: { cellWidth: 'auto' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 330) + 24,
    head: [['Payment Information', 'Details']],
    body: [
      ['Payment Status', toDisplayLabel(booking.paymentStatus)],
      ['Payment Method', toDisplayLabel(booking.paymentMethod || booking.paymentProvider)],
      ['Amount', `CAD ${Number(booking.amount || 0).toFixed(2)}`],
      ['Receipt Number', booking.receiptNumber || 'Not assigned'],
      ['Payment Reference', booking.paymentReference || '-'],
      ...(booking.status === 'cancelled' ? [
        ['Refund Status', toDisplayLabel(booking.refundStatus, 'Not required')],
        ['Refund Amount', `CAD ${Number(booking.refundAmount || 0).toFixed(2)}`],
        ['Refund Method', toDisplayLabel(booking.refundMethod)],
        ['Refund Reference', booking.refundReference || '-'],
        ['Refund Date', booking.refundDate || '-']
      ] : [])
    ],
    styles: { fontSize: 10, cellPadding: 8, valign: 'top' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
      1: { cellWidth: 'auto' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  const contactY = Math.min((doc.lastAutoTable?.finalY || 540) + 36, pageHeight - 70);
  doc.setDrawColor(203, 213, 225);
  doc.line(40, contactY - 16, pageWidth - 40, contactY - 16);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Please retain this receipt for your records. Contact the Gurdwara office if any details need correction.', 40, contactY, { maxWidth: pageWidth - 80 });

  return doc.output('blob');
};

export const createMembershipFeeInformationPdfBlob = async ({ user = {}, organizationName, address, phone, email }) => {
  const records = Array.isArray(user?.membershipFeeRecords) ? user.membershipFeeRecords : [];
  const latestPaidRecord = records
    .filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'paid')
    .sort((left, right) => (
      new Date(right?.paymentDate || right?.updatedAt || 0).getTime()
      - new Date(left?.paymentDate || left?.updatedAt || 0).getTime()
    ))[0];
  const schedule = String(user?.membershipProfile?.donationSchedule || 'monthly').trim().toLowerCase() === 'yearly'
    ? 'Yearly'
    : 'Monthly';
  const validityDays = schedule === 'Yearly' ? 365 : 30;
  const paymentDate = latestPaidRecord ? new Date(latestPaidRecord.paymentDate || latestPaidRecord.updatedAt || '') : null;
  const hasValidPaymentDate = paymentDate && !Number.isNaN(paymentDate.getTime());
  const validUntil = hasValidPaymentDate
    ? new Date(paymentDate.getTime() + (validityDays * 24 * 60 * 60 * 1000))
    : null;
  const isCurrent = validUntil ? validUntil.getTime() >= Date.now() : false;
  const formatDate = (value) => value
    ? value.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not recorded';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoDataUrl = await loadLogoDataUrl();

  doc.setFillColor(...LOGO_BLUE_RGB);
  doc.rect(0, 0, pageWidth, 112, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 34, 24, 62, 62);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(organizationName || 'Singh Sabha Milton Gurdwara', 112, 43);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(address || '', 112, 61);
  doc.text([phone, email].filter(Boolean).join('  |  '), 112, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Membership Fee', pageWidth - 34, 38, { align: 'right' });
  doc.text('Information', pageWidth - 34, 55, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Prepared ${formatDate(new Date())}`, pageWidth - 34, 75, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(`Welcome, ${String(user?.name || 'Member').trim()}.`, 40, 148);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  const welcomeText = latestPaidRecord
    ? 'Thank you for supporting the programs, services, and community work of Singh Sabha Milton. This document summarizes your membership profile and the latest fee payment recorded on your account.'
    : 'Your registration has been approved. A current paid membership fee activates Member access and helps support programs, services, and community work at Singh Sabha Milton.';
  doc.text(welcomeText, 40, 171, { maxWidth: pageWidth - 80, lineHeightFactor: 1.45 });

  const statusY = 220;
  doc.setFillColor(isCurrent ? 232 : 255, isCurrent ? 248 : 247, isCurrent ? 239 : 237);
  doc.setDrawColor(isCurrent ? 74 : 245, isCurrent ? 180 : 166, isCurrent ? 116 : 35);
  doc.roundedRect(40, statusY, pageWidth - 80, 48, 7, 7, 'FD');
  doc.setTextColor(isCurrent ? 22 : 154, isCurrent ? 101 : 52, isCurrent ? 52 : 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(isCurrent ? 'Membership fee status: CURRENT' : 'Membership fee status: PAYMENT REQUIRED', 55, statusY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    isCurrent ? `Current through ${formatDate(validUntil)}.` : 'No current paid membership fee is recorded on this account.',
    55,
    statusY + 36
  );

  autoTable(doc, {
    startY: statusY + 70,
    head: [['Member Information', 'Details']],
    body: [
      ['Member Name', String(user?.name || 'Member').trim()],
      ['Email Address', String(user?.email || '').trim() || '-'],
      ['Phone', String(user?.phone || '').trim() || '-'],
      ['Membership Schedule', schedule],
      ['Registration Status', String(user?.approvalStatus || 'approved').replace(/^./, (value) => value.toUpperCase())]
    ],
    styles: { fontSize: 10, cellPadding: 7, valign: 'top' },
    headStyles: { fillColor: LOGO_BLUE_RGB, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 145, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
      1: { cellWidth: 'auto' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  const paymentTableY = (doc.lastAutoTable?.finalY || 430) + 24;
  autoTable(doc, {
    startY: paymentTableY,
    head: [['Latest Fee Record', 'Details']],
    body: [
      ['Payment Status', latestPaidRecord ? 'Paid' : 'Payment required'],
      ['Payment Date', formatDate(hasValidPaymentDate ? paymentDate : null)],
      ['Amount', latestPaidRecord ? `${String(latestPaidRecord.currency || 'CAD')} ${Number(latestPaidRecord.amount || 0).toFixed(2)}` : '-'],
      ['Receipt Number', String(latestPaidRecord?.receiptNumber || '').trim() || '-'],
      ['Payment Method', String(latestPaidRecord?.paymentMethod || '').trim() || '-'],
      ['Valid Until', formatDate(validUntil)]
    ],
    styles: { fontSize: 10, cellPadding: 7, valign: 'top' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 145, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [30, 41, 59] },
      1: { cellWidth: 'auto' }
    },
    theme: 'grid',
    margin: { left: 40, right: 40 }
  });

  const footerY = Math.min((doc.lastAutoTable?.finalY || 620) + 36, pageHeight - 62);
  doc.setDrawColor(203, 213, 225);
  doc.line(40, footerY - 16, pageWidth - 40, footerY - 16);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Please retain this document for your records. Contact the Gurdwara office if any information needs correction.', 40, footerY, { maxWidth: pageWidth - 80 });
  doc.text('Thank you for your continued participation and seva in the sangat.', 40, footerY + 18);

  return doc.output('blob');
};

export const downloadMembershipFeeInformationPdf = async (payload) => {
  const blob = await createMembershipFeeInformationPdfBlob(payload);
  const memberName = String(payload?.user?.name || 'member').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  triggerFileDownload(blob, `membership-fee-${memberName || 'member'}.pdf`);
};

export const downloadDonationInvoicePdf = async (payload) => {
  const blob = await createDonationInvoicePdfBlob(payload);
  const fileName = payload?.fileName || `invoice-${payload?.donation?.receiptId || payload?.donation?.id || 'donation'}.pdf`;
  triggerFileDownload(blob, fileName);
};

export const downloadBulkDonationStatementPdf = async (payload) => {
  const blob = await createBulkDonationStatementPdfBlob(payload);
  const donorName = String(payload?.donor?.name || 'donor').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  triggerFileDownload(blob, payload?.fileName || `donation-statement-${donorName || 'donor'}.pdf`);
};

export const downloadBookingReceiptPdf = async (payload) => {
  const blob = await createBookingReceiptPdfBlob(payload);
  const reference = payload?.booking?.receiptNumber || payload?.booking?.id || 'booking';
  triggerFileDownload(blob, payload?.fileName || `booking-receipt-${reference}.pdf`);
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
