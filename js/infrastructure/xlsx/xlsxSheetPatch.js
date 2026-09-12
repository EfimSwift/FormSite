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
  const open = block.match(/^<c r="[^"]+"[^>]*>/);
  if (!open) return block;
  const openTag = open[0].replace(/\s+t="[^"]*"/g, "").replace(/\/>$/, ">");

  if (value == null || value === "") {
    return openTag.replace(/>$/, "/>");
  }

  const inner = xmlText(value);
  return `${openTag.replace(/>$/, "")} t="inlineStr">${inner}</c>`;
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
