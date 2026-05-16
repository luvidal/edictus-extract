'use strict';

// src/normalize.ts
var stripParametricTail = (label) => label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*:\s*[\d.,]+\s*[A-Za-z%]{0,3}\s*$/, "").replace(/[:\s]+$/, "").trim();
var stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
var normalizeLabel = (label, stripParametric = false) => {
  const stripped = stripParametric ? stripParametricTail(label) : label;
  return stripAccents(stripped.toLowerCase()).replace(/[^\w\s%]/g, " ").replace(/\s+/g, " ").trim();
};

// src/data/liquidacion-lexicon.generated.ts
var LEXICON = {
  "version": 1,
  "doctype": "liquidaciones-sueldo",
  "itemTypes": [
    "income",
    "deduction"
  ],
  "items": [
    {
      "id": "sueldo_base",
      "canonical": "Sueldo Base",
      "itemType": "income",
      "aliases": [
        "Sueldo Base",
        "Sueldo",
        "Sueldo Mensual",
        "Sueldo Base Mensual",
        "Remuneraci\xF3n Base",
        "Remuneracion Base"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "gratificacion",
      "canonical": "Gratificaci\xF3n",
      "itemType": "income",
      "aliases": [
        "Gratificaci\xF3n",
        "Gratificacion",
        "Gratificaci\xF3n Legal",
        "Gratificacion Legal",
        "Gratificaci\xF3n Mensual",
        "Gratificacion Mensual",
        "Grat. Legal",
        "Grat Legal"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "colacion",
      "canonical": "Colaci\xF3n",
      "itemType": "income",
      "aliases": [
        "Colaci\xF3n",
        "Colacion",
        "Asignaci\xF3n Colaci\xF3n",
        "Asignacion Colacion",
        "Asig. Colaci\xF3n",
        "Asig. Colacion",
        "Asig Colacion",
        "Bono Colaci\xF3n",
        "Bono Colacion"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "No imponible"
      }
    },
    {
      "id": "movilizacion",
      "canonical": "Movilizaci\xF3n",
      "itemType": "income",
      "aliases": [
        "Movilizaci\xF3n",
        "Movilizacion",
        "Asignaci\xF3n Movilizaci\xF3n",
        "Asignacion Movilizacion",
        "Asig. Movilizaci\xF3n",
        "Asig. Movilizacion",
        "Asig Movilizacion",
        "Bono Movilizaci\xF3n",
        "Bono Movilizacion"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "No imponible"
      }
    },
    {
      "id": "asignacion_familiar",
      "canonical": "Asignaci\xF3n Familiar",
      "itemType": "income",
      "aliases": [
        "Asignaci\xF3n Familiar",
        "Asignacion Familiar",
        "Asig. Familiar",
        "Asig Familiar",
        "Asignaci\xF3n Fam.",
        "Asignacion Fam.",
        "Cargas Familiares"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "No imponible"
      }
    },
    {
      "id": "asignacion_estudios",
      "canonical": "Asignaci\xF3n de Estudios",
      "itemType": "income",
      "aliases": [
        "Asignaci\xF3n de Estudios",
        "Asignacion de Estudios",
        "Asignaci\xF3n Estudios",
        "Asignacion Estudios",
        "Asig. Estudios",
        "Asig Estudios",
        "Bono Estudios",
        "Bono de Estudios"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "No imponible"
      }
    },
    {
      "id": "viatico",
      "canonical": "Vi\xE1tico",
      "itemType": "income",
      "aliases": [
        "Vi\xE1tico",
        "Viatico",
        "Vi\xE1ticos",
        "Viaticos",
        "Asignaci\xF3n Vi\xE1tico",
        "Asignacion Viatico"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "No imponible"
      }
    },
    {
      "id": "horas_extras",
      "canonical": "Horas Extras",
      "itemType": "income",
      "aliases": [
        "Horas Extras",
        "Horas Extra",
        "Hrs. Extras",
        "Hrs Extras",
        "H. Extras",
        "HH.EE.",
        "HH EE",
        "Sobretiempo",
        "Sobre Tiempo",
        "Sobresueldo"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "comisiones",
      "canonical": "Comisiones",
      "itemType": "income",
      "aliases": [
        "Comisiones",
        "Comisi\xF3n",
        "Comision",
        "Comisi\xF3n de Ventas",
        "Comision de Ventas",
        "Comisiones de Venta",
        "Comisiones Ventas"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "aguinaldo",
      "canonical": "Aguinaldo",
      "itemType": "income",
      "aliases": [
        "Aguinaldo",
        "Aguinaldo Fiestas Patrias",
        "Aguinaldo Navidad",
        "Aguinaldo de Fiestas Patrias",
        "Aguinaldo de Navidad",
        "Bono Fiestas Patrias",
        "Bono Navidad",
        "Bono de Navidad",
        "Bono de Fiestas Patrias"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "vacaciones",
      "canonical": "Vacaciones",
      "itemType": "income",
      "aliases": [
        "Vacaciones",
        "Feriado Legal",
        "Feriado Anual",
        "Pago Vacaciones",
        "Remuneraci\xF3n Vacaciones",
        "Remuneracion Vacaciones"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Imponible"
      }
    },
    {
      "id": "afp_cotizacion_obligatoria",
      "canonical": "Cotiz. Previsional Obligatoria",
      "itemType": "deduction",
      "aliases": [
        "AFP",
        "Cotizaci\xF3n AFP",
        "Cotizacion AFP",
        "Cotiz. AFP",
        "Cotiz AFP",
        "Cotiz. Previsional Obligatoria",
        "Cotizacion Previsional Obligatoria",
        "Cotizaci\xF3n Previsional Obligatoria",
        "Cotiz. Previ. Obligatoria",
        "Cotiz Previ Obligatoria",
        "Cotizaci\xF3n Previsional",
        "Cotizacion Previsional",
        "Capitalizaci\xF3n Individual",
        "Capitalizacion Individual",
        "Capitalizaci\xF3n Individual 10%",
        "Capitalizacion Individual 10%",
        "AFP Obligatoria",
        "Previsi\xF3n AFP",
        "Prevision AFP"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Legal",
        "legalType": "afp"
      }
    },
    {
      "id": "comision_afp",
      "canonical": "Comisi\xF3n AFP",
      "itemType": "deduction",
      "aliases": [
        "Comisi\xF3n AFP",
        "Comision AFP",
        "Comisi\xF3n A.F.P.",
        "Comision A.F.P.",
        "Comisi\xF3n Administradora",
        "Comision Administradora",
        "Comisi\xF3n Adm. AFP",
        "Comision Adm AFP"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Legal",
        "legalType": "afp"
      }
    },
    {
      "id": "salud_obligatoria",
      "canonical": "Cotiz. Salud Obligatoria",
      "itemType": "deduction",
      "aliases": [
        "Salud 7%",
        "Salud 7",
        "Salud Obligatoria",
        "Salud",
        "Cotizaci\xF3n Salud",
        "Cotizacion Salud",
        "Cotiz. Salud",
        "Cotiz Salud",
        "Cotiz. Salud Obligatoria",
        "Cotizacion Salud Obligatoria",
        "Cotizaci\xF3n Salud Obligatoria",
        "Cotiz. Salud Obligatoria 7%",
        "Cotizacion Salud Obligatoria 7%",
        "Cotizaci\xF3n Salud Obligatoria 7%",
        "Fonasa",
        "Isapre",
        "Cotizaci\xF3n Isapre",
        "Cotizacion Isapre"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Legal",
        "legalType": "salud"
      }
    },
    {
      "id": "adicional_salud",
      "canonical": "Adicional Salud",
      "itemType": "deduction",
      "aliases": [
        "Adicional Salud",
        "Adicional de Salud",
        "Cotizaci\xF3n Adicional Salud",
        "Cotizacion Adicional Salud",
        "Cotiz. Adicional Salud",
        "Cotiz Adicional Salud",
        "Salud Adicional",
        "Salud Voluntaria",
        "Cotizaci\xF3n Voluntaria Salud",
        "Cotizacion Voluntaria Salud",
        "Pactado Isapre",
        "Adicional Isapre"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Otro"
      }
    },
    {
      "id": "seguro_cesantia",
      "canonical": "Seguro de Cesant\xEDa",
      "itemType": "deduction",
      "aliases": [
        "Seguro de Cesant\xEDa",
        "Seguro de Cesantia",
        "Seguro Cesant\xEDa",
        "Seguro Cesantia",
        "Seguro de Cesant\xEDa 0,6%",
        "Seguro de Cesantia 0,6%",
        "Seguro Cesant\xEDa 0,6%",
        "Seguro Cesantia 0,6%",
        "Cesant\xEDa",
        "Cesantia",
        "Cesant\xEDa 0,6%",
        "Cesantia 0,6%",
        "AFC",
        "AFC 0,6%",
        "Cotizaci\xF3n AFC",
        "Cotizacion AFC",
        "Cotiz. AFC",
        "Cotiz AFC",
        "Aporte Trabajador AFC"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Legal",
        "legalType": "cesantia"
      }
    },
    {
      "id": "impuesto_unico",
      "canonical": "Impuesto \xDAnico",
      "itemType": "deduction",
      "aliases": [
        "Impuesto \xDAnico",
        "Impuesto Unico",
        "Impuesto \xDAnico de Segunda Categor\xEDa",
        "Impuesto Unico de Segunda Categoria",
        "Impuesto 2da Categor\xEDa",
        "Impuesto 2da Categoria",
        "Impuesto Segunda Categor\xEDa",
        "Impuesto Segunda Categoria",
        "Imp. \xDAnico",
        "Imp. Unico",
        "IUSC"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Legal",
        "legalType": "impuesto"
      }
    },
    {
      "id": "anticipo",
      "canonical": "Anticipo",
      "itemType": "deduction",
      "aliases": [
        "Anticipo",
        "Anticipos",
        "Anticipo de Sueldo",
        "Anticipo Sueldo",
        "Anticipo Quincenal",
        "Anticipo Remuneraci\xF3n",
        "Anticipo Remuneracion"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Otro"
      }
    },
    {
      "id": "prestamo_empresa",
      "canonical": "Pr\xE9stamo Empresa",
      "itemType": "deduction",
      "aliases": [
        "Pr\xE9stamo Empresa",
        "Prestamo Empresa",
        "Pr\xE9stamo de Empresa",
        "Prestamo de Empresa",
        "Pr\xE9stamo",
        "Prestamo",
        "Pr\xE9stamo Empleador",
        "Prestamo Empleador",
        "Cuota Pr\xE9stamo",
        "Cuota Prestamo",
        "Descuento Pr\xE9stamo",
        "Descuento Prestamo"
      ],
      "classification": {
        "tipoRenta": "Variable",
        "naturaleza": "Otro"
      }
    },
    {
      "id": "caja_compensacion",
      "canonical": "Caja de Compensaci\xF3n",
      "itemType": "deduction",
      "aliases": [
        "Caja de Compensaci\xF3n",
        "Caja de Compensacion",
        "Caja Compensaci\xF3n",
        "Caja Compensacion",
        "C.C.A.F.",
        "CCAF",
        "Cuota CCAF",
        "Aporte CCAF",
        "Descuento CCAF"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Otro"
      }
    },
    {
      "id": "cuota_sindical",
      "canonical": "Cuota Sindical",
      "itemType": "deduction",
      "aliases": [
        "Cuota Sindical",
        "Cuota Sindicato",
        "Sindicato",
        "Aporte Sindical",
        "Descuento Sindical",
        "Descuento Sindicato"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Otro"
      }
    },
    {
      "id": "seguro_complementario",
      "canonical": "Seguro Complementario",
      "itemType": "deduction",
      "aliases": [
        "Seguro Complementario",
        "Seguro Complementario de Salud",
        "Seguro Complementario Salud",
        "Seguro de Salud Complementario",
        "Seguro Colectivo",
        "Seguro Colectivo de Salud",
        "Seguro Colectivo Salud",
        "Seguro Vida",
        "Seguro de Vida"
      ],
      "classification": {
        "tipoRenta": "Fija",
        "naturaleza": "Otro"
      }
    }
  ]
};

// src/liquidacion/unknown-cache.ts
var DECISION_SCHEMA_VERSION = 1;
var DEFAULT_TTL_MS = 6 * 60 * 60 * 1e3;
var STORE = /* @__PURE__ */ new Map();
var nowFn = () => Date.now();
function buildKey(section, normalizedLabel) {
  return `v${DECISION_SCHEMA_VERSION}|${section}|${normalizedLabel}`;
}
function getCachedDecision(section, normalizedLabel) {
  const key = buildKey(section, normalizedLabel);
  const entry = STORE.get(key);
  if (!entry) return void 0;
  if (entry.expiresAt <= nowFn()) {
    STORE.delete(key);
    return void 0;
  }
  return entry.decision;
}
function setCachedDecision(section, normalizedLabel, decision) {
  const key = buildKey(section, normalizedLabel);
  STORE.set(key, { decision, expiresAt: nowFn() + DEFAULT_TTL_MS });
}

// src/liquidacion/lexicon.ts
var SECTION_TO_ITEM_TYPE = {
  haberes: "income",
  descuentos: "deduction"
};
var ARBITER_MODEL = "gemini-2.5-pro";
var CONFIG_KEY = /* @__PURE__ */ Symbol.for("@jogi/extract.config");
function buildAliasIndex(lexicon) {
  const idx = { income: /* @__PURE__ */ new Map(), deduction: /* @__PURE__ */ new Map() };
  for (const item of lexicon.items) {
    const bucket = idx[item.itemType];
    for (const alias of item.aliases) {
      const key = normalizeLabel(alias, false);
      if (key.length === 0) continue;
      if (!bucket.has(key)) bucket.set(key, item);
    }
  }
  return idx;
}
var INDEX = buildAliasIndex(LEXICON);
function getGeminiCall() {
  const g = globalThis;
  return g[CONFIG_KEY]?.geminiCall;
}
function geminiText(r) {
  const x = r;
  if (typeof x?.text === "function") return x.text() ?? "";
  if (typeof x?.text === "string") return x.text;
  return x?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
}
function stripFences(s) {
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  return (m ? m[1] : s).trim();
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
var TIPO_RENTA_VALUES = /* @__PURE__ */ new Set(["Fija", "Variable"]);
var NATURALEZA_VALUES = /* @__PURE__ */ new Set([
  "Imponible",
  "No imponible",
  "Legal",
  "Otro"
]);
var LEGAL_TYPE_VALUES = /* @__PURE__ */ new Set(["afp", "salud", "cesantia", "impuesto"]);
function isHighOrMedium(v) {
  return v === "high" || v === "medium";
}
function buildArbiterPrompt(input) {
  const candidates = input.candidates.map((c) => ({
    id: c.id,
    canonical: c.canonical,
    aliases: c.aliases,
    ...c.classification ? { classification: c.classification } : {}
  }));
  const payload = {
    doctype: "liquidaciones-sueldo",
    section: input.section,
    rawLabel: input.rawLabel,
    normalizedLabel: input.normalizedLabel,
    candidates
  };
  return [
    "You are arbitrating an unknown liquidaci\xF3n-de-sueldo line-item label.",
    "Decide whether it is an alias of an existing canonical concept or a new concept.",
    "Rules:",
    '- choose "known" ONLY when the meaning is the same, not merely similar;',
    '- if ambiguous, return "new_item";',
    "- never recommend dropping a row;",
    "- respect the table section: haberes cannot map to a deduction, descuentos cannot map to income.",
    "Respond with strict JSON in one of these two shapes:",
    '{"decision":"known","canonicalId":"<id>","confidence":"high"|"medium"|"low","reason":"..."}',
    '{"decision":"new_item","proposedCanonical":"...","itemType":"income"|"deduction","classification":{"tipoRenta":"Fija"|"Variable","naturaleza":"Imponible"|"No imponible"|"Legal"|"Otro","legalType":"afp"|"salud"|"cesantia"|"impuesto"},"confidence":"high"|"medium"|"low","reason":"..."}',
    'legalType is allowed ONLY when naturaleza === "Legal".',
    "Input:",
    JSON.stringify(payload)
  ].join("\n");
}
function parseArbiterResponse(raw, section, lexicon) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (r.confidence === "low" || !isHighOrMedium(r.confidence)) return null;
  if (r.decision === "known") {
    const canonicalId = typeof r.canonicalId === "string" ? r.canonicalId : "";
    if (!canonicalId) return null;
    const item = lexicon.items.find((i) => i.id === canonicalId);
    if (!item) return null;
    if (item.itemType !== SECTION_TO_ITEM_TYPE[section]) return null;
    if (!item.classification) return null;
    return {
      decision: "known",
      canonicalId,
      canonical: item.canonical,
      classification: item.classification,
      confidence: r.confidence
    };
  }
  if (r.decision === "new_item") {
    const proposedCanonical = typeof r.proposedCanonical === "string" ? r.proposedCanonical.trim() : "";
    if (!proposedCanonical) return null;
    const itemType = r.itemType;
    if (itemType !== "income" && itemType !== "deduction") return null;
    if (itemType !== SECTION_TO_ITEM_TYPE[section]) return null;
    const cls = r.classification;
    if (!cls || typeof cls !== "object") return null;
    const tipoRenta = cls.tipoRenta;
    const naturaleza = cls.naturaleza;
    if (typeof tipoRenta !== "string" || !TIPO_RENTA_VALUES.has(tipoRenta)) return null;
    if (typeof naturaleza !== "string" || !NATURALEZA_VALUES.has(naturaleza)) return null;
    let legalType;
    if (cls.legalType !== void 0) {
      if (typeof cls.legalType !== "string" || !LEGAL_TYPE_VALUES.has(cls.legalType)) return null;
      if (naturaleza !== "Legal") return null;
      legalType = cls.legalType;
    } else if (naturaleza === "Legal") {
      return null;
    }
    return {
      decision: "new_item",
      proposedCanonical,
      itemType,
      classification: {
        tipoRenta,
        naturaleza,
        ...legalType ? { legalType } : {}
      },
      confidence: r.confidence
    };
  }
  return null;
}
async function arbitrate(input) {
  const lexicon = input.lexicon ?? LEXICON;
  const cached = getCachedDecision(input.section, input.normalizedLabel);
  const resolveCached = (d) => {
    if (d.decision === "known") {
      const item = lexicon.items.find((i) => i.id === d.canonicalId);
      if (!item || item.itemType !== SECTION_TO_ITEM_TYPE[input.section]) return null;
      return { kind: "known", item };
    }
    return {
      kind: "new_item",
      proposedCanonical: d.proposedCanonical,
      classification: d.classification
    };
  };
  if (cached) {
    const resolved = resolveCached(cached);
    if (resolved) return resolved;
  }
  const geminiCall = getGeminiCall();
  if (!geminiCall) return null;
  const candidates = lexicon.items.filter(
    (i) => i.itemType === SECTION_TO_ITEM_TYPE[input.section]
  );
  const prompt = buildArbiterPrompt({ ...input, candidates });
  let response;
  try {
    response = await geminiCall({
      model: ARBITER_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    });
  } catch {
    return null;
  }
  const text = stripFences(geminiText(response));
  const parsed = parseJson(text);
  const decision = parseArbiterResponse(parsed, input.section, lexicon);
  if (!decision) return null;
  setCachedDecision(input.section, input.normalizedLabel, decision);
  if (decision.decision === "known") {
    const item = lexicon.items.find((i) => i.id === decision.canonicalId);
    if (!item) return null;
    return { kind: "known", item };
  }
  return {
    kind: "new_item",
    proposedCanonical: decision.proposedCanonical,
    classification: decision.classification
  };
}
function classifyMatchedItem(item, value, canonicalId) {
  const cls = item.classification;
  const out = {
    canonicalId,
    label: item.canonical,
    value,
    naturaleza: cls?.naturaleza ?? "Otro",
    tipoRenta: cls?.tipoRenta ?? "Variable"
  };
  if (cls?.legalType !== void 0) out.legalType = cls.legalType;
  return out;
}
function fallback(rawLabel, value, section) {
  return {
    canonicalId: null,
    label: rawLabel,
    value,
    naturaleza: section === "descuentos" ? "Otro" : "Imponible",
    tipoRenta: "Variable"
  };
}
function classifySection(rows, section, index = INDEX) {
  const itemType = SECTION_TO_ITEM_TYPE[section];
  const bucket = index[itemType];
  const winnerSeen = /* @__PURE__ */ new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row.label !== "string") continue;
    const key = normalizeLabel(row.label, false);
    const hit = key ? bucket.get(key) : void 0;
    if (!hit) {
      out.push(fallback(row.label, row.value, section));
      continue;
    }
    const isCollisionLoser = winnerSeen.has(hit.id);
    if (!isCollisionLoser) winnerSeen.add(hit.id);
    out.push(classifyMatchedItem(hit, row.value, isCollisionLoser ? null : hit.id));
  }
  return out;
}
async function classifyLiquidacionRows(input, lexicon = LEXICON, index = INDEX) {
  return {
    haberes: await classifyAndArbitrate(input.haberes ?? [], "haberes", lexicon, index),
    descuentos: await classifyAndArbitrate(input.descuentos ?? [], "descuentos", lexicon, index)
  };
}
async function classifyAndArbitrate(rows, section, lexicon = LEXICON, index = INDEX) {
  const deterministic = classifySection(rows, section, index);
  const itemType = SECTION_TO_ITEM_TYPE[section];
  const bucket = index[itemType];
  const arbiterAnswers = /* @__PURE__ */ new Map();
  const out = new Array(deterministic.length);
  for (let i = 0; i < deterministic.length; i++) {
    const det = deterministic[i];
    const raw = rows[i];
    const normalized = normalizeLabel(raw.label, false);
    if (normalized.length > 0 && bucket.has(normalized)) {
      out[i] = det;
      continue;
    }
    if (!normalized) {
      out[i] = det;
      continue;
    }
    let result = arbiterAnswers.get(normalized);
    if (result === void 0) {
      result = await arbitrate({
        section,
        rawLabel: raw.label,
        normalizedLabel: normalized,
        lexicon
      });
      arbiterAnswers.set(normalized, result);
    }
    out[i] = applyArbiterResult(result, raw, section);
  }
  const winners = /* @__PURE__ */ new Set();
  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    if (!item.canonicalId) continue;
    if (winners.has(item.canonicalId)) {
      out[i] = { ...item, canonicalId: null };
    } else {
      winners.add(item.canonicalId);
    }
  }
  return out;
}
function applyArbiterResult(result, row, section) {
  if (!result) return fallback(row.label, row.value, section);
  if (result.kind === "known") {
    return classifyMatchedItem(result.item, row.value, result.item.id);
  }
  const cls = result.classification;
  const out = {
    canonicalId: null,
    label: row.label,
    value: row.value,
    naturaleza: cls.naturaleza,
    tipoRenta: cls.tipoRenta
  };
  if (cls.legalType !== void 0) out.legalType = cls.legalType;
  return out;
}

exports.classifyLiquidacionRows = classifyLiquidacionRows;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map