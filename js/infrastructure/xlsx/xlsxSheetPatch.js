function xmlText(text) {
  const esc = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const space = text !== text.trim() ? ' xml:space="preserve"' : "";
  return `<is><t${space}>${esc}</t></is>`;
}

function patchCellBlock(block, value) {
  let b = block.replace(/>\s*<v>[\s\S]*?<\/v>\s*/g, ">");
  b = b.replace(/>\s*<is>[\s\S]*?<\/is>\s*/g, ">");
  b = b.replace(/\s+t="[^"]*"/g, "");

  if (value == null || value === "") {
    if (/\/>$/.test(b.trim())) return b;
    return b.replace(/>[\s\S]*<\/c>$/, "/>");
  }

  const inner = xmlText(value);
  if (/\/>$/.test(b.trim())) {
    return b.trim().replace(/\/>\s*$/, ` t="inlineStr">${inner}</c>`);
  }
  return b.replace(/>[\s\S]*<\/c>$/, ` t="inlineStr">${inner}</c>`);
}

export function setCellInSheetXml(sheetXml, ref, value) {
  const pattern = new RegExp(
    `(<c r="${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*)(?:/>|>[\\s\\S]*?</c>)`,
  );
  const m = sheetXml.match(pattern);
  if (!m) throw new Error(`Комірку ${ref} не знайдено в шаблоні`);
  return sheetXml.replace(pattern, patchCellBlock(m[0], value));
}

export function buildUpdates(documentDef, values) {
  const updates = {};
  for (const field of documentDef.fields) {
    updates[field.cell] = values[field.id] ?? "";
  }
  for (const addr of documentDef.clearCells ?? []) {
    updates[addr] = null;
  }
  return updates;
}

export function applyUpdatesToSheetXml(sheetXml, updates) {
  let xml = sheetXml;
  for (const [ref, val] of Object.entries(updates)) {
    xml = setCellInSheetXml(xml, ref, val);
  }
  return xml;
}
