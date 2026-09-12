import { rgb } from "../../../vendor/pdf-lib.esm.min.js";

export const PDF_PAGE_SIZE = { width: 595.2, height: 841.68 };
export const PDF_PRINT_MARGINS = { top: 54, bottom: 54, left: 50.4, right: 50.4 };

function wrapLines(text, font, size, maxWidth) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const tokens = normalized.split(" ").flatMap((word) => {
    if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
    const parts = [];
    let chunk = "";
    for (const ch of word) {
      const next = chunk + ch;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !chunk) {
        chunk = next;
      } else {
        parts.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  });

  const lines = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function layoutForBox(text, font, box, options) {
  const pad = options.pad ?? 2.5;
  const maxSize = options.maxSize ?? 8;
  const minSize = options.minSize ?? 4.5;
  const innerW = Math.max(4, box.w - pad * 2);
  const innerH = Math.max(4, box.h - pad * 2);

  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const lineHeight = size * 1.15;
    const allLines = wrapLines(text, font, size, innerW);
    const blockH = allLines.length * lineHeight;
    if (allLines.length > 0 && blockH <= innerH) {
      return {
        lines: allLines,
        size,
        lineHeight,
        pad,
        overflowLines: [],
      };
    }
  }

  const size = minSize;
  const lineHeight = size * 1.15;
  const allLines = wrapLines(text, font, size, innerW);
  const maxLines = Math.max(1, Math.floor(innerH / lineHeight));
  return {
    lines: allLines.slice(0, maxLines),
    size,
    lineHeight,
    pad,
    overflowLines: allLines.slice(maxLines),
  };
}

function boxTop(box) {
  return box.y + box.h;
}

function drawLines(page, font, lines, box, layout, hAlign, vAlign) {
  const { size, lineHeight, pad } = layout;
  const blockH = lines.length * lineHeight;

  let baseline;
  if (vAlign === "top") {
    baseline = boxTop(box) - pad - size * 0.2;
  } else if (vAlign === "bottom") {
    baseline = box.y + pad + size * 0.85 + (lines.length - 1) * lineHeight;
  } else {
    baseline = box.y + (box.h - blockH) / 2 + size * 0.35;
  }

  for (const line of lines) {
    const lineW = font.widthOfTextAtSize(line, size);
    let x;
    if (hAlign === "left") x = box.x + pad;
    else if (hAlign === "right") x = box.x + box.w - pad - lineW;
    else x = box.x + Math.max(pad, (box.w - lineW) / 2);

    page.drawText(line, {
      x,
      y: baseline,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= lineHeight;
  }
}

export function continuationBox(sourceBox, pageIndex) {
  const { height } = PDF_PAGE_SIZE;
  const { top, bottom } = PDF_PRINT_MARGINS;
  const printableH = height - top - bottom;
  return {
    x: sourceBox.x,
    y: bottom,
    w: sourceBox.w,
    h: printableH,
    page: pageIndex,
  };
}

/**
 * Малює текст у комірці; зайві рядки — на наступний аркуш (та сама колонка).
 */
export function drawTextInCellWithPages(pdf, pages, font, text, box, options = {}) {
  const hAlign = options.hAlign ?? "center";
  const vAlign = options.vAlign ?? "center";
  let pageIndex = box.page ?? 0;
  let pendingLines = null;
  let layout = null;

  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return;

  let firstPass = true;
  while (firstPass || (pendingLines && pendingLines.length)) {
    firstPass = false;
    while (pageIndex >= pages.length) {
      pages.push(pdf.addPage([PDF_PAGE_SIZE.width, PDF_PAGE_SIZE.height]));
    }

    const currentBox =
      pageIndex === (box.page ?? 0) && !pendingLines
        ? box
        : continuationBox(box, pageIndex);

    if (pendingLines?.length) {
      layout = layoutForBox(pendingLines.join(" "), font, currentBox, options);
      pendingLines = layout.overflowLines;
    } else {
      layout = layoutForBox(normalized, font, currentBox, options);
      pendingLines = layout.overflowLines;
    }

    drawLines(
      pages[pageIndex],
      font,
      layout.lines,
      currentBox,
      layout,
      hAlign,
      vAlign,
    );
    pageIndex += 1;
  }
}

export function drawTextInCell(page, font, text, box, options = {}) {
  const stub = { addPage: () => page };
  drawTextInCellWithPages(stub, [page], font, text, box, options);
}
