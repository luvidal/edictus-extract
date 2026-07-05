'use strict';

// src/normalize.ts
var stripParametricTail = (label) => label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*:\s*[\d.,]+\s*[A-Za-z%]{0,3}\s*$/, "").replace(/[:\s]+$/, "").trim();
var stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
var normalizeLabel = (label, stripParametric = false) => {
  const stripped = stripParametric ? stripParametricTail(label) : label;
  return stripAccents(stripped.toLowerCase()).replace(/[^\w\s%]/g, " ").replace(/\s+/g, " ").trim();
};
var resolveLabel = (rawLabel, config = {}) => {
  const stripParametric = config.stripParametric === true;
  const key = normalizeLabel(rawLabel, stripParametric);
  for (const rule of config.synonyms ?? []) {
    if (new RegExp(rule.match).test(key)) {
      return { key: normalizeLabel(rule.canonical, false), display: rule.canonical };
    }
  }
  const display = stripParametric ? stripParametricTail(rawLabel) : rawLabel;
  return { key, display };
};
var validateNormalizeConfig = (block) => {
  if (!block) return;
  for (const [field, cfg] of Object.entries(block)) {
    for (const rule of cfg.synonyms ?? []) {
      if (!rule.match.startsWith("^") || !rule.match.endsWith("$")) {
        throw new Error(
          `@edictus/extract: normalize rule for "${field}" is not anchored: ${rule.match}`
        );
      }
    }
  }
};
var parsePath = (path) => {
  const listMatch = path.match(/^([^[.\]]+)\[\]\.([^[.\]]+)$/);
  if (listMatch) return { fieldKey: listMatch[1], rowKey: listMatch[2] };
  if (/^[^[.\]]+$/.test(path)) return { fieldKey: path, rowKey: null };
  throw new Error(
    `@edictus/extract: unsupported normalize path "${path}" \u2014 expected "<field>" or "<field>[].<rowKey>"`
  );
};
var applyNormalizeBlock = (fields, block) => {
  if (!block || Object.keys(block).length === 0) return fields;
  const byField = /* @__PURE__ */ new Map();
  for (const [path, cfg] of Object.entries(block)) {
    const { fieldKey, rowKey } = parsePath(path);
    const bucket = byField.get(fieldKey) ?? [];
    bucket.push({ rowKey, cfg });
    byField.set(fieldKey, bucket);
  }
  return fields.map((f) => {
    const entries = byField.get(f.key);
    if (!entries) return f;
    let value = f.value;
    for (const { rowKey, cfg } of entries) {
      if (rowKey === null) {
        if (typeof value === "string") value = resolveLabel(value, cfg).display;
      } else if (Array.isArray(value)) {
        value = value.map((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return row;
          const r = row;
          const raw = r[rowKey];
          if (typeof raw !== "string") return row;
          return { ...r, [rowKey]: resolveLabel(raw, cfg).display };
        });
      }
    }
    return { ...f, value };
  });
};

exports.applyNormalizeBlock = applyNormalizeBlock;
exports.normalizeLabel = normalizeLabel;
exports.resolveLabel = resolveLabel;
exports.stripParametricTail = stripParametricTail;
exports.validateNormalizeConfig = validateNormalizeConfig;
//# sourceMappingURL=normalize.js.map
//# sourceMappingURL=normalize.js.map