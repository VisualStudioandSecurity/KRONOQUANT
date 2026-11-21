import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCsvContent } from './portfolioMath';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const csv = formatCsvContent(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportToExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, string | number>[] }[]
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeRows = sheet.rows.length > 0 ? sheet.rows : [{ Info: 'Sem registros disponíveis' }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToPDF(
  filename: string,
  title: string,
  subtitle: string,
  metrics: { label: string; value: string }[],
  tableHeaders: string[],
  tableRows: (string | number)[][]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Institutional dark slate header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('KronoQuant', 40, 32);

  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text(title, 40, 52);

  doc.setFontSize(9);
  doc.text(subtitle, doc.internal.pageSize.getWidth() - 40, 52, { align: 'right' });

  // Metrics strip
  let startY = 96;
  if (metrics.length > 0) {
    const colWidth = (doc.internal.pageSize.getWidth() - 80) / Math.min(metrics.length, 6);
    metrics.slice(0, 6).forEach((m, idx) => {
      const x = 40 + idx * colWidth;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, startY, colWidth - 10, 44, 4, 4, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label, x + 10, startY + 16);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(m.value, x + 10, startY + 34);
    });
    startY += 64;
  }

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableRows.map((r) => r.map((c) => String(c))),
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252],
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
