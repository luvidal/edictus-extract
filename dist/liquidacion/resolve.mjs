// src/normalize.ts
var stripParametricTail = (label) => label.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*:\s*[\d.,]+\s*[A-Za-z%]{0,3}\s*$/, "").replace(/[:\s]+$/, "").trim();
var stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
var normalizeLabel = (label, stripParametric = false) => {
  const stripped = stripParametric ? stripParametricTail(label) : label;
  return stripAccents(stripped.toLowerCase()).replace(/[^\w\s%]/g, " ").replace(/\s+/g, " ").trim();
};

// src/data/liquidacion-lexicon.generated.ts
var LEXICON = {
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
        "Seguro de Salud",
        "Seguro Salud",
        "Descuento Seguro de Salud",
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

// src/liquidacion/resolve.ts
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
function addKey(keys, key) {
  if (key.length > 0) keys.add(key);
}
function decoratedCommissionKey(key) {
  if (/^comision afp(?:\s|$)/.test(key)) return "comision afp";
  if (/^comision a f p(?:\s|$)/.test(key)) return "comision a f p";
  if (/^comision administradora(?:\s|$)/.test(key)) return "comision administradora";
  if (/^comision adm afp(?:\s|$)/.test(key)) return "comision adm afp";
  return null;
}
function aliasKeysForLabel(label) {
  const keys = /* @__PURE__ */ new Set();
  addKey(keys, normalizeLabel(label, false));
  addKey(keys, normalizeLabel(label, true));
  for (const key of [...keys]) {
    const decorated = decoratedCommissionKey(key);
    if (decorated) addKey(keys, decorated);
  }
  return [...keys];
}
function findAliasItem(label, itemType, index = INDEX) {
  for (const key of aliasKeysForLabel(label)) {
    const item = index[itemType].get(key);
    if (item) return item;
  }
  return null;
}
function resolveLabelToCanonicalId(label, itemType) {
  const item = findAliasItem(label, itemType);
  return item ? item.id : null;
}

export { aliasKeysForLabel, buildAliasIndex, findAliasItem, resolveLabelToCanonicalId };
//# sourceMappingURL=resolve.mjs.map
//# sourceMappingURL=resolve.mjs.map