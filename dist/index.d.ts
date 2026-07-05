import { D as Doctype, R as ResponseSchema, a as DoctypeField, E as ExtractedField, b as ExtractorConfig, c as ExtractOptions, d as ExtractResult, e as DoctypesMap } from './types-D3pLcgah.js';
export { f as ExtractionUsage, F as FieldType, G as GeminiCall, N as NormalizeFieldConfig, g as NormalizeRule, h as NormalizedLabel, i as applyNormalizeBlock, n as normalizeLabel, r as resolveLabel, s as stripParametricTail, v as validateNormalizeConfig } from './types-D3pLcgah.js';

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
 * @edictus/extract — lean prompt-first single-doctype field extractor.
 *
 * One Gemini call per file, responseSchema for flat doctypes, local
 * normalization of the JSON payload. Mirrors @edictus/classifier's host-injected
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

export { Doctype, DoctypeField, DoctypesMap, ExtractOptions, ExtractResult, ExtractedField, ExtractorConfig, ResponseSchema, buildExtractPrompt, buildResponseSchema, configure, extract, extractFields, getDoctypes, getDoctypesMap, normalizeDocdate, normalizeFields, parseJsonLoose, stripFences };
