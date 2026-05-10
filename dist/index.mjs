// src/prompt.ts
var fieldLine = (f) => {
  const ai = f.ai ? ` \u2014 ${f.ai}` : "";
  return `  \u2022 ${f.key} (${f.type ?? "string"})${ai}`;
};
var referencesBlock = (refs) => {
  const examples = refs.slice(0, 3).map((r) => JSON.stringify(r));
  if (examples.length === 0) return "";
  return [
    "",
    "Ejemplos del formato exacto que espera la base de datos (Jogi persiste un objeto plano keyed por field key en `documents.files.ai_fields`). Sigue este estilo, NO copies los valores:",
    ...examples,
    ""
  ].join("\n");
};
function buildExtractPrompt(doctypeId, dt, references = []) {
  const fieldList = dt.fields.map(fieldLine).join("\n");
  const dateInstruction = dt.dateHint ? `"docdate": ${dt.dateHint}. Formato YYYY-MM-DD.` : `"docdate": la fecha a la que CORRESPONDE la informaci\xF3n (no la fecha de descarga). Formato YYYY-MM-DD.`;
  return [
    `Extrae los campos del documento chileno "${dt.label ?? doctypeId}" (id: "${doctypeId}").`,
    dt.definition ? `Definici\xF3n: ${dt.definition}` : "",
    "",
    "Devuelve EXCLUSIVAMENTE JSON v\xE1lido con esta forma:",
    `{"data": { ...campos... }, "docdate": "YYYY-MM-DD"}`,
    "",
    "Campos:",
    fieldList,
    referencesBlock(references),
    `- ${dateInstruction}`,
    '- Campos type:"num"/"number": entero sin separador de miles. En Chile el punto es separador de miles (NO decimal): $558.376 = 558376.',
    '- Campos type:"date": YYYY-MM-DD. type:"month": YYYY-MM. type:"time": HH:MM.',
    '- Campos type:"list": extrae TODAS las filas visibles, no resumas ni dejes ninguna fuera. Cada fila es un objeto; usa {label, value} salvo que la instrucci\xF3n "ai" indique una forma distinta.',
    '- Si un campo no aparece en el documento, devu\xE9lvelo como null. NO inventes datos salvo donde la instrucci\xF3n "ai" lo indique.',
    "- Sin markdown, sin texto adicional, solo el JSON."
  ].filter((line) => line !== "").join("\n");
}

// src/parse.ts
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
var ISO_MONTH_OR_DATE = /^(\d{4}-\d{2})(-\d{2})?$/;
var ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;
function parseJsonLoose(text) {
  const cleaned = stripFences(text).trim();
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    let depth = 0;
    let inStr = false;
    let escape = false;
    let start = -1;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\" && inStr) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            const obj = JSON.parse(cleaned.slice(start, i + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
              return obj;
            }
          } catch {
          }
        }
      }
    }
    return null;
  }
}
var stripFences = (s) => s.replace(/```json|```/g, "").trim();
var coerceNumber = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
var coerceString = (v) => {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
};
var coerceBool = (v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["true", "s\xED", "si", "yes", "1"].includes(t)) return true;
    if (["false", "no", "0"].includes(t)) return false;
  }
  return null;
};
var matchOrNull = (v, re) => {
  const s = coerceString(v);
  return s && re.test(s) ? s : null;
};
var coerceMonth = (v) => {
  const s = coerceString(v);
  if (!s) return null;
  const m = s.match(ISO_MONTH_OR_DATE);
  return m ? m[1] : null;
};
var coerceForType = (type, v) => {
  if (v === null || v === void 0) return null;
  switch (type) {
    case "num":
    case "number":
      return coerceNumber(v);
    case "date":
      return matchOrNull(v, ISO_DATE);
    case "month":
      return coerceMonth(v);
    case "time":
      return matchOrNull(v, ISO_TIME);
    case "bool":
      return coerceBool(v);
    case "list":
      return Array.isArray(v) ? v : null;
    case "obj":
    case "object":
      return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    case "string":
    default:
      return coerceString(v);
  }
};
function normalizeFields(fields, data) {
  const src = data ?? {};
  return fields.map((f) => ({
    key: f.key,
    type: String(f.type ?? "string"),
    value: coerceForType(f.type, src[f.key])
  }));
}
function normalizeDocdate(v) {
  return matchOrNull(v, ISO_DATE);
}

// src/index.ts
var CONFIG_KEY = /* @__PURE__ */ Symbol.for("@jogi/extract.config");
var g = globalThis;
function configure(c) {
  g[CONFIG_KEY] = c;
}
function getConfig() {
  const c = g[CONFIG_KEY];
  if (!c) throw new Error("@jogi/extract: configure({ doctypes, geminiCall }) was not called");
  return c;
}
function getDoctypesMap() {
  return getConfig().doctypes;
}
function getDoctypes() {
  return Object.entries(getConfig().doctypes).map(([id, dt]) => ({ ...dt, id }));
}
var DEFAULT_MODEL = "gemini-2.5-pro";
function resolveReferences(config, id, doctype, extra) {
  const refs = [];
  for (const r of [config.references?.[id], doctype.examples, extra]) {
    if (Array.isArray(r)) refs.push(...r);
    if (refs.length >= 3) break;
  }
  return refs.slice(0, 3);
}
function geminiText(r) {
  const x = r;
  if (typeof x?.text === "function") return x.text() ?? "";
  if (typeof x?.text === "string") return x.text;
  return x?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
}
function geminiUsage(r) {
  const u = r?.usageMetadata;
  if (!u) return void 0;
  return { promptTokens: u.promptTokenCount, candidatesTokens: u.candidatesTokenCount, totalTokens: u.totalTokenCount };
}
async function extract(buffer, mimetype, doctype, opts = {}) {
  const config = getConfig();
  const dt = config.doctypes[doctype];
  if (!dt) throw new Error(`Unknown doctype: ${doctype}`);
  if (!Array.isArray(dt.fields) || dt.fields.length === 0) {
    throw new Error(`Doctype "${doctype}" has no fields`);
  }
  const references = resolveReferences(config, doctype, dt, opts.references);
  const prompt = buildExtractPrompt(doctype, dt, references);
  const r = await config.geminiCall({
    model: opts.model ?? DEFAULT_MODEL,
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimetype, data: buffer.toString("base64") } }
      ]
    }],
    // Extraction wants deterministic output (same input → same fields).
    // We default temperature to 0 and cap output tokens, then let the
    // caller override via opts.generationConfig.
    config: {
      temperature: 0,
      maxOutputTokens: 8192,
      ...opts.generationConfig ?? {},
      responseMimeType: "application/json"
    }
  });
  const text = stripFences(geminiText(r));
  const parsed = parseJsonLoose(text);
  if (!parsed) throw new Error("@jogi/extract: Gemini response was not valid JSON");
  const data = parsed.data ?? parsed;
  const docdate = normalizeDocdate(parsed.docdate);
  const fields = normalizeFields(dt.fields, data);
  return { doctype, fields, docdate, usage: geminiUsage(r) };
}
async function extractFields(buffer, mimetype, doctype, opts = {}) {
  const r = await extract(buffer, mimetype, doctype, opts);
  return r.fields;
}

export { buildExtractPrompt, configure, extract, extractFields, getDoctypes, getDoctypesMap, normalizeDocdate, normalizeFields, parseJsonLoose, stripFences };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map