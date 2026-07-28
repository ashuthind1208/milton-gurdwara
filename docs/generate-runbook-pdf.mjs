import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, 'SSM_Handbook_Runbook.md');
const pdfPath = path.join(__dirname, 'SSM_Handbook_Runbook.pdf');

const markdown = fs.readFileSync(mdPath, 'utf8');

const lines = markdown
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('!['))
  .map((line) => line
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^###\s+/, '')
    .replace(/^##\s+/, '')
    .replace(/^#\s+/, '')
    .replace(/^---+$/, '')
  );

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 46;
const maxWidth = pageWidth - (margin * 2);
let y = margin;

const writeParagraph = (text, options = {}) => {
  const {
    fontSize = 11,
    bold = false,
    lineHeight = 15,
    after = 0
  } = options;

  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);

  const chunks = doc.splitTextToSize(text || ' ', maxWidth);
  for (const chunk of chunks) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(chunk, margin, y);
    y += lineHeight;
  }

  y += after;
};

for (const line of lines) {
  const text = line.trimEnd();

  if (!text.trim()) {
    y += 6;
    continue;
  }

  if (/^\d+\.\s+/.test(text)) {
    writeParagraph(text, { fontSize: 11, bold: true, lineHeight: 15, after: 1 });
    continue;
  }

  if (/^[A-Z][A-Za-z\s\/\-()]+:$/.test(text.trim())) {
    writeParagraph(text, { fontSize: 12, bold: true, lineHeight: 16, after: 2 });
    continue;
  }

  if (/^[A-Z][A-Za-z\s0-9&\-()\/]+$/.test(text.trim()) && text.length < 72) {
    if (text.startsWith('Version:') || text.startsWith('Date:') || text.startsWith('Audience:')) {
      writeParagraph(text, { fontSize: 10, bold: false, lineHeight: 14 });
    } else {
      writeParagraph(text, { fontSize: 13, bold: true, lineHeight: 17, after: 2 });
    }
    continue;
  }

  writeParagraph(text, { fontSize: 11, bold: false, lineHeight: 15 });
}

doc.save(pdfPath);
console.log(`Generated ${pdfPath}`);
