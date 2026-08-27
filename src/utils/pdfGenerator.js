import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * downloadPDF – Captures .app-content with html2canvas and manually places it
 * on PDF pages using jsPDF. This bypasses html2pdf's automatic page-splitting
 * which is the root cause of the blank first page bug.
 *
 * @param {string} filename - PDF filename including .pdf extension
 */
export const downloadPDF = async (filename = 'Report.pdf', orientation = 'portrait') => {
  // 1. Show print header, hide no-print elements
  document.body.classList.add('pdf-export-mode');

  // 2. Scroll to absolute top
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // 3. Wait two animation frames so CSS repaints fully before capture
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const element = document.querySelector('.app-content');
    if (!element) throw new Error('.app-content not found');

    // 4. Capture the element — start from its top-left corner exactly
    const canvas = await html2canvas(element, {
      scale:        2,
      useCORS:      true,
      logging:      false,
      // Tell html2canvas the element starts at y=0, x=0 in the document
      // so it doesn't add any offset / blank space at the top
      x:            0,
      y:            0,
      scrollX:      0,
      scrollY:      0,
      width:        element.scrollWidth,
      height:       element.scrollHeight,
      windowWidth:  element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // 5. Build PDF page-by-page from the canvas image
    const isLandscape = orientation === 'landscape';
    const A4_W_MM  = isLandscape ? 297 : 210;
    const A4_H_MM  = isLandscape ? 210 : 297;
    const MARGIN   = 8; // mm each side

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation });

    const printableW = A4_W_MM - MARGIN * 2; // usable width in mm
    const printableH = A4_H_MM - MARGIN * 2; // usable height in mm

    const imgData   = canvas.toDataURL('image/jpeg', 0.95);
    // How tall (in mm) is the full canvas when scaled to printableW?
    const totalImgH = (canvas.height / canvas.width) * printableW;

    let yRemaining = totalImgH; // how much image height is left to print
    let yOffset    = 0;         // where in the image we currently are (mm)

    while (yRemaining > 0) {
      // Slice height for this page
      const sliceH = Math.min(yRemaining, printableH);

      // Source rect in canvas pixels
      const srcY = (yOffset / totalImgH) * canvas.height;
      const srcH = (sliceH / totalImgH) * canvas.height;

      // Create a temporary canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width  = canvas.width;
      sliceCanvas.height = srcH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(sliceData, 'JPEG', MARGIN, MARGIN, printableW, sliceH);

      yRemaining -= sliceH;
      yOffset    += sliceH;

      if (yRemaining > 0) pdf.addPage();
    }

    pdf.save(filename);
  } catch (err) {
    console.error('PDF generation error:', err);
  } finally {
    document.body.classList.remove('pdf-export-mode');
  }
};

/**
 * buildPdfFilename – Creates a clean filename from a report name + filter values.
 *
 * @param {string}   reportName  e.g. "Sales & Purchase Report"
 * @param {Object[]} filters     e.g. [{ value: 'July 2026' }, { value: 'Main Branch' }]
 * @returns {string}             e.g. "Sales_And_Purchase_Report_July_2026_Main_Branch.pdf"
 */
export const buildPdfFilename = (reportName, filters = []) => {
  const parts = [reportName, ...filters.map((f) => f.value)]
    .join('_')
    .replace(/[&]/g, 'And')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_');
  return parts + '.pdf';
};
