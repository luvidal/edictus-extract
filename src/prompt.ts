import type { Doctype, DoctypeField } from './types'

const fieldLine = (f: DoctypeField): string => {
    const ai = f.ai ? ` — ${f.ai}` : ''
    return `  • ${f.key} (${f.type ?? 'string'})${ai}`
}

const referencesBlock = (refs: unknown[]): string => {
    const examples = refs.slice(0, 3).map(r => JSON.stringify(r))
    if (examples.length === 0) return ''
    return [
        '',
        'Ejemplos del formato exacto que espera la base de datos (Jogi persiste un objeto plano keyed por field key en `documents.files.ai_fields`). Sigue este estilo, NO copies los valores:',
        ...examples,
        '',
    ].join('\n')
}

/**
 * Build the user-role prompt for a single-doctype extraction. Driven entirely
 * by the doctype's `definition`, optional `dateHint`, and per-field `ai`
 * instructions in `doctypes.json`. No response schema — the host caller's
 * `geminiCall` only needs `responseMimeType: 'application/json'`.
 */
export function buildExtractPrompt(doctypeId: string, dt: Doctype, references: unknown[] = []): string {
    const fieldList = dt.fields.map(fieldLine).join('\n')
    const dateInstruction = dt.dateHint
        ? `"docdate": ${dt.dateHint}. Formato YYYY-MM-DD.`
        : `"docdate": la fecha a la que CORRESPONDE la información (no la fecha de descarga). Formato YYYY-MM-DD.`

    return [
        `Extrae los campos del documento chileno "${dt.label ?? doctypeId}" (id: "${doctypeId}").`,
        dt.definition ? `Definición: ${dt.definition}` : '',
        '',
        'Devuelve EXCLUSIVAMENTE JSON válido con esta forma:',
        `{"data": { ...campos... }, "docdate": "YYYY-MM-DD"}`,
        '',
        'Campos:',
        fieldList,
        referencesBlock(references),
        `- ${dateInstruction}`,
        '- Campos type:"num"/"number": entero sin separador de miles. En Chile el punto es separador de miles (NO decimal): $558.376 = 558376.',
        '- Campos type:"date": YYYY-MM-DD. type:"month": YYYY-MM. type:"time": HH:MM.',
        '- Campos type:"list": extrae TODAS las filas visibles, no resumas ni dejes ninguna fuera. Cada fila es un objeto; usa {label, value} salvo que la instrucción "ai" indique una forma distinta.',
        '- Si un campo no aparece en el documento, devuélvelo como null. NO inventes datos salvo donde la instrucción "ai" lo indique.',
        '- Sin markdown, sin texto adicional, solo el JSON.',
    ].filter(line => line !== '').join('\n')
}
