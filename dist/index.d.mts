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

/**
 * Build the user-role prompt for a single-doctype extraction. Driven entirely
 * by the doctype's `definition`, optional `dateHint`, and per-field `ai`
 * instructions in `doctypes.json`. No response schema — the host caller's
 * `geminiCall` only needs `responseMimeType: 'application/json'`.
 */
declare function buildExtractPrompt(doctypeId: string, dt: Doctype, references?: unknown[]): string;

declare function buildResponseSchema(dt: Doctype): ResponseSchema | null;

/**
 * Best-effort JSON parse with brace-matching recovery for truncated outputs.
 * Returns `null` if nothing usable can be parsed.
 */
declare function parseJsonLoose(text: string): Record<string, unknown> | null;
declare const stripFences: (s: string) => string;
declare function normalizeFields(fields: DoctypeField[], data: Record<string, unknown> | null | undefined): ExtractedField[];
declare function normalizeDocdate(v: unknown): string | null;

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
 * @jogi/extract — lean prompt-first single-doctype field extractor.
 *
 * One Gemini call per file, responseSchema for flat doctypes, local
 * normalization of the JSON payload. Mirrors @jogi/classifier's host-injected
 * dependency pattern: the host owns Gemini auth and passes an already-
 * authenticated `geminiCall`; this package never reads API keys.
 */

declare function configure(c: ExtractorConfig): void;
declare function getDoctypesMap(): DoctypesMap;
declare function getDoctypes(): Array<Doctype & {
    id: string;
}>;
/**
 * Run a single-doctype extraction against `buffer` / `mimetype`.
 *
 * Returns the doctype-shaped field array plus an optional document date and
 * token usage. The host's `geminiCall` handles auth, retries, and quota — this
 * function only orchestrates prompt → call → normalize.
 */
declare function extract(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractResult>;
/**
 * Convenience wrapper — returns only the field array (per the original spec).
 * Use `extract()` when you also need `docdate` and token usage.
 */
declare function extractFields(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractedField[]>;

export { type Doctype, type DoctypeField, type DoctypesMap, type ExtractOptions, type ExtractResult, type ExtractedField, type ExtractionUsage, type ExtractorConfig, type FieldType, type GeminiCall, type NormalizeFieldConfig, type NormalizeRule, type NormalizedLabel, type ResponseSchema, buildExtractPrompt, buildResponseSchema, configure, extract, extractFields, getDoctypes, getDoctypesMap, normalizeDocdate, normalizeFields, normalizeLabel, parseJsonLoose, resolveLabel, stripFences, stripParametricTail, validateNormalizeConfig };
