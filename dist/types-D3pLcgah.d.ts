/**
 * Label normalization — two-job pipeline.
 *
 * Job 1 (generic, in code): strip parametric tails, lowercase, accent-fold,
 * collapse punctuation/whitespace. Doctype-agnostic, runs on every targeted
 * field.
 *
 * Job 2 (synonym resolution, from doctypes.json config): an ordered list of
 * `{match, canonical}` rules evaluated against the Job-1 output. All patterns
 * MUST be anchored (`^…$`); first match wins. A label that matches no rule
 * passes through with only Job-1 cleanup applied.
 *
 * Replaces the consumer-side stop-gap at
 * `app/reports/situacion/helpers/synonyms.ts` — same behavior, now owned by
 * the satellite.
 */
interface NormalizeRule {
    /** Regex pattern (string) run against the Job-1-normalized label. MUST be anchored. */
    match: string;
    /** Display string — properly cased + accented; becomes the row label downstream. */
    canonical: string;
}
interface NormalizeFieldConfig {
    /** If true, strip parametric tails before lowercasing/accent-folding. Default: false. */
    stripParametric?: boolean;
    /** Ordered synonym list, evaluated top-to-bottom on the Job-1-normalized label. */
    synonyms?: NormalizeRule[];
}
interface NormalizedLabel {
    /** Normalized form — used as the downstream dedup/grouping key. */
    key: string;
    /** Display label — the matched canonical, or the original-cased stripped label. */
    display: string;
}
/** Trailing `(…)` parenthetical, `:N UNIT` suffix, trailing colons/whitespace. */
declare const stripParametricTail: (label: string) => string;
/**
 * Job 1 — generic cleanup. Lowercase, accent-fold, drop punctuation (so
 * `Cotiz.` and `Cotiz` collapse), collapse whitespace. Optionally strips the
 * parametric tail first.
 */
declare const normalizeLabel: (label: string, stripParametric?: boolean) => string;
/**
 * Resolve a raw label against a `NormalizeFieldConfig`. Returns the dedup key
 * + the display string. Pass-through when no synonym matches: key = Job-1
 * normalized, display = parametric-stripped (cased preserved) raw label.
 */
declare const resolveLabel: (rawLabel: string, config?: NormalizeFieldConfig) => NormalizedLabel;
/**
 * Throws if any `match` pattern in any field config is unanchored. Use at
 * config-load time (tests at minimum) to enforce the plan's anchoring rule.
 */
declare const validateNormalizeConfig: (block: Record<string, NormalizeFieldConfig> | null | undefined) => void;
/**
 * Apply a doctype's `normalize` block to a freshly-coerced `ExtractedField[]`
 * (from `normalizeFields()`). Returns a new array; does NOT mutate input or
 * nested rows.
 *
 * - Skip silently if the doctype has no `normalize` block.
 * - For scalar paths, rewrite the field's string `value`.
 * - For `<field>[].<rowKey>` paths, walk the list `value` and rewrite each
 *   row's `rowKey` property when it is a string. Rows that are not plain
 *   objects, or that are missing the property, pass through unchanged — the
 *   AI sometimes returns short rows and the rest of the pipeline is tolerant.
 */
declare const applyNormalizeBlock: (fields: ExtractedField[], block: Record<string, NormalizeFieldConfig> | null | undefined) => ExtractedField[];

type FieldType = 'string' | 'num' | 'number' | 'date' | 'month' | 'time' | 'bool' | 'list' | 'array' | 'obj' | 'object';
interface DoctypeField {
    key: string;
    type?: FieldType | string;
    ai?: string;
    internal?: boolean;
    label?: string;
}
interface Doctype {
    label?: string;
    definition?: string;
    dateHint?: string | null;
    fields: DoctypeField[];
    /** Optional in-doctype few-shot examples used as reference output style. */
    examples?: unknown[];
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
    normalize?: Record<string, NormalizeFieldConfig>;
}
type DoctypesMap = Record<string, Doctype>;
type ResponseSchema = {
    type: 'OBJECT' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY';
    properties?: Record<string, ResponseSchema>;
    required?: string[];
    nullable?: boolean;
    items?: ResponseSchema;
};
interface ExtractedField {
    key: string;
    type: string;
    value: unknown;
}
interface ExtractionUsage {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
}
interface ExtractResult {
    doctype: string;
    fields: ExtractedField[];
    docdate: string | null;
    usage?: ExtractionUsage;
}
interface ExtractOptions {
    /** Override the model id. Default: `gemini-2.5-pro`. */
    model?: string;
    /** Caller-supplied Gemini `generationConfig` overrides (temperature, topP, thinkingConfig, ...). */
    generationConfig?: Record<string, unknown>;
    /** Inline few-shot examples (per-call). Merged with config-level references. */
    references?: unknown[];
}
type GeminiCall = (params: {
    model: string;
    contents: any;
    config?: any;
}) => Promise<any>;
interface ExtractorConfig {
    doctypes: DoctypesMap;
    geminiCall: GeminiCall;
    /** Optional cross-doctype references table: `{ <doctypeId>: [...examples] }`. */
    references?: Record<string, unknown[]>;
}

export { type Doctype as D, type ExtractedField as E, type FieldType as F, type GeminiCall as G, type NormalizeFieldConfig as N, type ResponseSchema as R, type DoctypeField as a, type ExtractorConfig as b, type ExtractOptions as c, type ExtractResult as d, type DoctypesMap as e, type ExtractionUsage as f, type NormalizeRule as g, type NormalizedLabel as h, applyNormalizeBlock as i, normalizeLabel as n, resolveLabel as r, stripParametricTail as s, validateNormalizeConfig as v };
