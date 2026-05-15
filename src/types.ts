export type FieldType =
    | 'string'
    | 'num'
    | 'number'
    | 'date'
    | 'month'
    | 'time'
    | 'bool'
    | 'list'
    | 'array'
    | 'obj'
    | 'object'

export interface DoctypeField {
    key: string
    type?: FieldType | string
    ai?: string
    internal?: boolean
    label?: string
}

export interface Doctype {
    label?: string
    definition?: string
    dateHint?: string | null
    fields: DoctypeField[]
    /** Optional in-doctype few-shot examples used as reference output style. */
    examples?: unknown[]
    /**
     * Optional per-field label-normalization map.
     *
     * Keys use a path-like syntax with two supported forms only:
     *   - `"<fieldKey>"`            — apply to the scalar string value of that field.
     *   - `"<fieldKey>[].<rowKey>"` — for a `list`-type field, apply to each row's
     *                                 `<rowKey>` string property.
     *
     * Anything else is a config error and rejected by `validateNormalizeConfig`.
     * Type is `Record<string, NormalizeFieldConfig>` but we leave it loose here
     * to avoid a circular import; the `normalize` module owns the value shape.
     */
    normalize?: Record<string, import('./normalize').NormalizeFieldConfig>
}

export type DoctypesMap = Record<string, Doctype>

export type ResponseSchema = {
    type: 'OBJECT' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY'
    properties?: Record<string, ResponseSchema>
    required?: string[]
    nullable?: boolean
    items?: ResponseSchema
}

export interface ExtractedField {
    key: string
    type: string
    value: unknown
}

export interface ExtractionUsage {
    promptTokens?: number
    candidatesTokens?: number
    totalTokens?: number
}

export interface ExtractResult {
    doctype: string
    fields: ExtractedField[]
    docdate: string | null
    usage?: ExtractionUsage
}

export interface ExtractOptions {
    /** Override the model id. Default: `gemini-2.5-pro`. */
    model?: string
    /** Caller-supplied Gemini `generationConfig` overrides (temperature, topP, thinkingConfig, ...). */
    generationConfig?: Record<string, unknown>
    /** Inline few-shot examples (per-call). Merged with config-level references. */
    references?: unknown[]
}

export type GeminiCall = (params: { model: string; contents: any; config?: any }) => Promise<any>

export interface ExtractorConfig {
    doctypes: DoctypesMap
    geminiCall: GeminiCall
    /** Optional cross-doctype references table: `{ <doctypeId>: [...examples] }`. */
    references?: Record<string, unknown[]>
}
