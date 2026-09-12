import { rgb } from "../../../vendor/pdf-lib.esm.min.js";

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

function fitLayout(text, font, box, pad, maxSize, minSize) {
  const innerW = Math.max(4, box.w - pad * 2);
  const innerH = Math.max(4, box.h - pad * 2);

  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const lineHeight = size * 1.15;
    const lines = wrapLines(text, font, size, innerW);
    const blockH = lines.length * lineHeight;
    if (lines.length > 0 && blockH <= innerH) {
      return { lines, size, lineHeight };
    }
  }

  const size = minSize;
  const lineHeight = size * 1.15;
  let lines = wrapLines(text, font, size, innerW);
  const maxLines = Math.max(1, Math.floor(innerH / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (
      last.length > 1 &&
      font.widthOfTextAtSize(`${last}…`, size) > innerW
    ) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return { lines, size, lineHeight };
}

/**
 * Текст по центру комірки, перенос лише всередині рамки (одна сторінка PDF).
 */
export function drawTextInCell(page, font, text, box, options = {}) {
  const pad = options.pad ?? 2.5;
  const maxSize = options.maxSize ?? 8;
  const minSize = options.minSize ?? 4.5;

  const { lines, size, lineHeight } = fitLayout(
    text,
    font,
    box,
    pad,
    maxSize,
    minSize,
  );
  if (!lines.length) return;

  const blockH = lines.length * lineHeight;
  let baseline =
    box.y + (box.h - blockH) / 2 + size * 0.35;

  for (const line of lines) {
    const lineW = font.widthOfTextAtSize(line, size);
    const x = box.x + Math.max(pad, (box.w - lineW) / 2);
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
