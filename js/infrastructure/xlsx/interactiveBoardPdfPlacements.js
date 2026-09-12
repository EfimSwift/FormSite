/**
 * Координати тексту на interactive-board-print.pdf (pt, pdf-lib: знизу-ліворуч).
 * Знято з Excel ExportAsFixedFormat при заповненому рядку 10 / 14.
 * Перегенерація: tools/calibrate_pdf_placements.py (Windows + Excel).
 */
export const INTERACTIVE_BOARD_PDF_PLACEMENTS = {
  B10: { x: 127.46, y: 632.71, size: 8, maxWidth: 102, lineHeight: 9 },
  C10: { x: 236.09, y: 632.71, size: 8, maxWidth: 86, lineHeight: 9 },
  D10: { x: 328.27, y: 632.71, size: 8, maxWidth: 100, lineHeight: 9 },
  E10: { x: 436.54, y: 632.71, size: 8, maxWidth: 52, lineHeight: 9 },
  F10: { x: 476.0, y: 632.71, size: 8, maxWidth: 42, lineHeight: 9 },

  B14: { x: 97.344, y: 546.91, size: 8, maxWidth: 90, lineHeight: 9 },
  C14: { x: 192.62, y: 540.91, size: 8, maxWidth: 152, lineHeight: 9 },
  D14: { x: 351.43, y: 541.15, size: 8, maxWidth: 88, lineHeight: 9 },
  E14: { x: 444.94, y: 541.15, size: 7.5, maxWidth: 48, lineHeight: 8.5 },
  F14: { x: 476.0, y: 546.91, size: 6.5, maxWidth: 42, lineHeight: 7.5 },
};
