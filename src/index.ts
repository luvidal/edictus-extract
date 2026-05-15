/**
 * @jogi/extract — lean prompt-first single-doctype field extractor.
 *
 * One Gemini call per file, responseSchema for flat doctypes, local
 * normalization of the JSON payload. Mirrors @jogi/classifier's host-injected
 * dependency pattern: the host owns Gemini auth and passes an already-
 * authenticated `geminiCall`; this package never reads API keys.
 */

import { buildExtractPrompt } from './prompt'
import { normalizeDocdate, normalizeFields, parseJsonLoose, stripFences } from './parse'
import { buildResponseSchema } from './schema'
import type {
    Doctype,
    DoctypesMap,
    ExtractedField,
    ExtractionUsage,
    ExtractorConfig,
    ExtractOptions,
    ExtractResult,
    GeminiCall,
} from './types'

export type {
    Doctype,
    DoctypeField,
    DoctypesMap,
    ExtractedField,
    ExtractionUsage,
    ExtractorConfig,
    ExtractOptions,
    ExtractResult,
    FieldType,
    GeminiCall,
    ResponseSchema,
} from './types'
export { buildExtractPrompt } from './prompt'
export { buildResponseSchema } from './schema'
export { parseJsonLoose, normalizeDocdate, normalizeFields, stripFences } from './parse'
export { resolveLabel, normalizeLabel, stripParametricTail, validateNormalizeConfig, applyNormalizeBlock } from './normalize'
export type { NormalizeRule, NormalizeFieldConfig, NormalizedLabel } from './normalize'
import { applyNormalizeBlock, validateNormalizeConfig } from './normalize'

const CONFIG_KEY = Symbol.for('@jogi/extract.config')
const g = globalThis as unknown as Record<symbol, ExtractorConfig | undefined>

export function configure(c: ExtractorConfig): void {
    // Fail fast on malformed normalize blocks (unanchored regex) before any
    // extraction call exercises them. No-ops when no doctype declares one.
    for (const dt of Object.values(c.doctypes)) validateNormalizeConfig(dt.normalize)
    g[CONFIG_KEY] = c
}

function getConfig(): ExtractorConfig {
    const c = g[CONFIG_KEY]
    if (!c) throw new Error('@jogi/extract: configure({ doctypes, geminiCall }) was not called')
    return c
}

export function getDoctypesMap(): DoctypesMap { return getConfig().doctypes }
export function getDoctypes(): Array<Doctype & { id: string }> {
    return Object.entries(getConfig().doctypes).map(([id, dt]) => ({ ...dt, id }))
}

const DEFAULT_MODEL = 'gemini-2.5-pro'

function resolveReferences(config: ExtractorConfig, id: string, doctype: Doctype, extra?: unknown[]): unknown[] {
    const refs: unknown[] = []
    for (const r of [config.references?.[id], doctype.examples, extra]) {
        if (Array.isArray(r)) refs.push(...r)
        if (refs.length >= 3) break
    }
    return refs.slice(0, 3)
}

function geminiText(r: unknown): string {
    const x = r as {
        text?: string | (() => string)
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    if (typeof x?.text === 'function') return x.text() ?? ''
    if (typeof x?.text === 'string') return x.text
    return x?.candidates?.[0]?.content?.parts?.map(p => p?.text ?? '').join('') ?? ''
}

function geminiUsage(r: unknown): ExtractionUsage | undefined {
    const u = (r as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } })?.usageMetadata
    if (!u) return undefined
    return { promptTokens: u.promptTokenCount, candidatesTokens: u.candidatesTokenCount, totalTokens: u.totalTokenCount }
}

/**
 * Run a single-doctype extraction against `buffer` / `mimetype`.
 *
 * Returns the doctype-shaped field array plus an optional document date and
 * token usage. The host's `geminiCall` handles auth, retries, and quota — this
 * function only orchestrates prompt → call → normalize.
 */
export async function extract(
    buffer: Buffer,
    mimetype: string,
    doctype: string,
    opts: ExtractOptions = {},
): Promise<ExtractResult> {
    const config = getConfig()
    const dt = config.doctypes[doctype]
    if (!dt) throw new Error(`Unknown doctype: ${doctype}`)
    if (!Array.isArray(dt.fields) || dt.fields.length === 0) {
        throw new Error(`Doctype "${doctype}" has no fields`)
    }

    const references = resolveReferences(config, doctype, dt, opts.references)
    const prompt = buildExtractPrompt(doctype, dt, references)
    const responseSchema = buildResponseSchema(dt)

    const r = await config.geminiCall({
        model: opts.model ?? DEFAULT_MODEL,
        contents: [{
            role: 'user',
            parts: [
                { text: prompt },
                { inlineData: { mimeType: mimetype, data: buffer.toString('base64') } },
            ],
        }],
        // Extraction wants deterministic output (same input → same fields).
        // We default temperature to 0 and cap output tokens, then let the
        // caller override via opts.generationConfig.
        config: {
            temperature: 0,
            maxOutputTokens: 8192,
            ...(responseSchema ? { responseSchema } : {}),
            ...(opts.generationConfig ?? {}),
            responseMimeType: 'application/json',
        },
    })

    const text = stripFences(geminiText(r))
    const parsed = parseJsonLoose(text)
    if (!parsed) throw new Error('@jogi/extract: Gemini response was not valid JSON')

    const data = (parsed.data ?? parsed) as Record<string, unknown> | null
    const docdate = normalizeDocdate(parsed.docdate)
    const fields = applyNormalizeBlock(normalizeFields(dt.fields, data), dt.normalize)

    return { doctype, fields, docdate, usage: geminiUsage(r) }
}

/**
 * Convenience wrapper — returns only the field array (per the original spec).
 * Use `extract()` when you also need `docdate` and token usage.
 */
export async function extractFields(
    buffer: Buffer,
    mimetype: string,
    doctype: string,
    opts: ExtractOptions = {},
): Promise<ExtractedField[]> {
    const r = await extract(buffer, mimetype, doctype, opts)
    return r.fields
}
