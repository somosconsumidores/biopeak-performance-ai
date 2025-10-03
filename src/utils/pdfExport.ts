import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { KmData } from '@/hooks/useRacePlanning';

export async function exportStrategyToPDF(
  strategyName: string,
  distance: number,
  totalTime: string,
  avgPace: string,
  strategyType: string,
  kmDistribution: KmData[],
  formatTime: (seconds: number) => string,
  formatPace: (seconds: number) => string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Pre-load template image
  let templateImg: string | null = null;
  try {
    templateImg = await loadImage('/src/assets/biopeak-pdf-template.png');
    pdf.addImage(templateImg, 'PNG', 0, 0, pageWidth, pageHeight);
  } catch (error) {
    console.error('Error loading template:', error);
  }

  // Position content below the logo area (logo is in the template)
  yPosition = 80; // Start content below the template logo

  // Add title
  pdf.setFontSize(20);
  pdf.setTextColor(0, 176, 240); // BioPeak blue
  pdf.text('BioPeak - Planejador de Prova', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text(strategyName, margin, yPosition);
  yPosition += 15;

  // Add summary info
  pdf.setFontSize(12);
  pdf.text(`Distância: ${distance.toFixed(2)} km`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Tempo Total: ${totalTime}`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Pace Médio: ${avgPace}/km`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Estratégia: ${getStrategyLabel(strategyType)}`, margin, yPosition);
  yPosition += 15;

  // Add table header
  pdf.setFillColor(0, 176, 240);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text('Km', margin + 2, yPosition + 5);
  pdf.text('Pace', margin + 30, yPosition + 5);
  pdf.text('Tempo', margin + 60, yPosition + 5);
  pdf.text('Acumulado', margin + 90, yPosition + 5);
  yPosition += 8;

  // Add table rows
  pdf.setTextColor(0, 0, 0);
  kmDistribution.forEach((row, index) => {
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      // Add template to new page
      if (templateImg) {
        pdf.addImage(templateImg, 'PNG', 0, 0, pageWidth, pageHeight);
      }
      yPosition = margin;
    }

    const bgColor = index % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
    pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 7, 'F');

    pdf.text(row.km.toString(), margin + 2, yPosition + 5);
    pdf.text(`${formatPace(row.pace)}/km`, margin + 30, yPosition + 5);
    pdf.text(formatTime(row.time), margin + 60, yPosition + 5);
    pdf.text(formatTime(row.accumulatedTime), margin + 90, yPosition + 5);
    yPosition += 7;
  });

  // Add footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Gerado por BioPeak AI - ${new Date().toLocaleDateString('pt-BR')}`,
    margin,
    pageHeight - 10
  );

  // Save the PDF
  pdf.save(`${strategyName.replace(/\s+/g, '_')}_BioPeak.pdf`);
}

function getStrategyLabel(type: string): string {
  switch (type) {
    case 'constant':
      return 'Pace Constante';
    case 'negative':
      return 'Negative Split';
    case 'positive':
      return 'Positive Split';
    default:
      return type;
  }
}

function loadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}
