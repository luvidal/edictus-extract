type FieldType = 'string' | 'num' | 'number' | 'date' | 'month' | 'time' | 'bool' | 'list' | 'obj' | 'object';
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

/**
 * Best-effort JSON parse with brace-matching recovery for truncated outputs.
 * Returns `null` if nothing usable can be parsed.
 */
declare function parseJsonLoose(text: string): Record<string, unknown> | null;
declare const stripFences: (s: string) => string;
declare function normalizeFields(fields: DoctypeField[], data: Record<string, unknown> | null | undefined): ExtractedField[];
declare function normalizeDocdate(v: unknown): string | null;

/**
 * @jogi/extract — lean prompt-first single-doctype field extractor.
 *
 * One Gemini call per file, prompt-only contract (no responseSchema), local
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

export { type Doctype, type DoctypeField, type DoctypesMap, type ExtractOptions, type ExtractResult, type ExtractedField, type ExtractionUsage, type ExtractorConfig, type FieldType, type GeminiCall, buildExtractPrompt, configure, extract, extractFields, getDoctypes, getDoctypesMap, normalizeDocdate, normalizeFields, parseJsonLoose, stripFences };
