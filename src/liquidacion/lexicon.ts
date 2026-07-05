/**
 * Liquidación-de-sueldo deterministic lexicon matcher.
 *
 * - Source of truth: `src/data/liquidacion-lexicon.yaml` (human-edited).
 *   The `prebuild` step compiles it to `liquidacion-lexicon.generated.ts`,
 *   which is what runtime imports. No YAML parser ships in production deps.
 * - Matching is keyed `{ section, normalizedLabel }` → canonical via the
 *   satellite's own `normalizeLabel` helper, so accent/case/punctuation
 *   variants (`Asignacion Colacion` → `Colación`) collapse for free.
 * - Section / `itemType` compatibility is enforced: income items only
 *   resolve `haberes`, deduction items only resolve `descuentos`; mismatches
 *   fall through to unknown.
 * - Same-month collisions inside one section route the winner with
 *   `canonicalId` and emit losers with `canonicalId: null` while still
 *   carrying classification (see *Collision Rule* in the plan).
 *
 * This file owns the deterministic path only. The Gemini arbiter + memory
 * cache (S2) plug in via the `arbitrate` export below, which currently is a
 * documented stub.
 */

import { normalizeLabel } from '../normalize'
import { LEXICON } from '../data/liquidacion-lexicon.generated'
import { buildAliasIndex, findAliasItem, type AliasIndex } from './resolve'
import {
    DECISION_SCHEMA_VERSION,
    getCachedDecision,
    setCachedDecision,
    type CachedDecision,
} from './unknown-cache'
import type {
    ClassifiedItem,
    ItemClassification,
    ItemType,
    Lexicon,
    LexiconItem,
    LiquidacionRowsInput,
    LiquidacionRowsOutput,
    Naturaleza,
    TipoRenta,
} from './types'

type Section = 'haberes' | 'descuentos'

const SECTION_TO_ITEM_TYPE: Record<Section, ItemType> = {
    haberes: 'income',
    descuentos: 'deduction',
}

/**
 * Gemini model used by the arbiter. Same model as the satellite's default
 * extraction call (see `src/index.ts` → `DEFAULT_MODEL`). Keep in sync.
 */
const ARBITER_MODEL = 'gemini-2.5-pro'

/** Shared symbol used by `configure()` in `src/index.ts`. */
const CONFIG_KEY = Symbol.for('@edictus/extract.config')

const INDEX: AliasIndex = buildAliasIndex(LEXICON)

// Re-export so existing tests can keep importing `buildAliasIndex` from
// `./lexicon`; the canonical source now lives in `./resolve`.
export { buildAliasIndex }

/**
 * Result returned by the arbiter for one unknown cluster. `null` means the
 * arbiter declined (low confidence, malformed JSON, network failure, or
 * section incompatibility) — the caller MUST keep the raw label and apply
 * the safest fallback classification. The row is never dropped.
 *
 * On a `known` resolution the arbiter returns the matched lexicon item plus
 * the canonicalId; the caller emits a `ClassifiedItem` with `canonicalId`
 * set and the lexicon's classification. On `new_item` the arbiter returns
 * the proposed canonical text and the classification only — `canonicalId`
 * stays unset because the new concept is not yet in the lexicon.
 */
export type ArbiterResult =
    | { kind: 'known'; item: LexiconItem }
    | {
          kind: 'new_item'
          proposedCanonical: string
          classification: ItemClassification
      }
    | null

/** Subset of `geminiCall` we need; matches the satellite's `GeminiCall` type. */
type GeminiCallShape = (params: {
    model: string
    contents: unknown
    config?: unknown
}) => Promise<unknown>

function getGeminiCall(): GeminiCallShape | undefined {
    const g = globalThis as unknown as Record<symbol, { geminiCall?: GeminiCallShape } | undefined>
    return g[CONFIG_KEY]?.geminiCall
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

function stripFences(s: string): string {
    // Same idea as src/parse.ts stripFences — but tiny and local; we don't
    // want to widen lexicon.ts's import surface for one helper.
    const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i)
    return (m ? m[1] : s).trim()
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

const TIPO_RENTA_VALUES: ReadonlySet<TipoRenta> = new Set<TipoRenta>(['Fija', 'Variable'])
const NATURALEZA_VALUES: ReadonlySet<Naturaleza> = new Set<Naturaleza>([
    'Imponible',
    'No imponible',
    'Legal',
    'Otro',
])
const LEGAL_TYPE_VALUES = new Set(['afp', 'salud', 'cesantia', 'impuesto'])

function isHighOrMedium(v: unknown): v is 'high' | 'medium' {
    return v === 'high' || v === 'medium'
}

/**
 * Build the per-cluster prompt body. One normalized cluster per call; no
 * row-specific context (so the cache key stays stable at
 * `section + normalizedLabel`).
 */
function buildArbiterPrompt(input: {
    section: Section
    rawLabel: string
    normalizedLabel: string
    candidates: LexiconItem[]
}): string {
    const candidates = input.candidates.map(c => ({
        id: c.id,
        canonical: c.canonical,
        aliases: c.aliases,
        ...(c.classification ? { classification: c.classification } : {}),
    }))
    const payload = {
        doctype: 'liquidaciones-sueldo',
        section: input.section,
        rawLabel: input.rawLabel,
        normalizedLabel: input.normalizedLabel,
        candidates,
    }
    return [
        'You are arbitrating an unknown liquidación-de-sueldo line-item label.',
        'Decide whether it is an alias of an existing canonical concept or a new concept.',
        'Rules:',
        '- choose "known" ONLY when the meaning is the same, not merely similar;',
        '- if ambiguous, return "new_item";',
        '- never recommend dropping a row;',
        '- respect the table section: haberes cannot map to a deduction, descuentos cannot map to income.',
        'Respond with strict JSON in one of these two shapes:',
        '{"decision":"known","canonicalId":"<id>","confidence":"high"|"medium"|"low","reason":"..."}',
        '{"decision":"new_item","proposedCanonical":"...","itemType":"income"|"deduction","classification":{"tipoRenta":"Fija"|"Variable","naturaleza":"Imponible"|"No imponible"|"Legal"|"Otro","legalType":"afp"|"salud"|"cesantia"|"impuesto"},"confidence":"high"|"medium"|"low","reason":"..."}',
        'legalType is allowed ONLY when naturaleza === "Legal".',
        'Input:',
        JSON.stringify(payload),
    ].join('\n')
}

/**
 * Validate Gemini's JSON response and return a normalized `CachedDecision`,
 * or `null` if anything is off (malformed JSON, missing keys, low confidence,
 * unknown enum value, etc.). Section-compatibility rejection happens here:
 * a `known` decision pointing at an item whose `itemType` mismatches the
 * section becomes `null` so the caller falls back to a safe classification.
 */
function parseArbiterResponse(
    raw: unknown,
    section: Section,
    lexicon: Lexicon,
): CachedDecision | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (r.confidence === 'low' || !isHighOrMedium(r.confidence)) return null

    if (r.decision === 'known') {
        const canonicalId = typeof r.canonicalId === 'string' ? r.canonicalId : ''
        if (!canonicalId) return null
        const item = lexicon.items.find(i => i.id === canonicalId)
        if (!item) return null
        // Section enforcement.
        if (item.itemType !== SECTION_TO_ITEM_TYPE[section]) return null
        // We require the lexicon item to ship a classification — otherwise we
        // would have nothing to attach to the row beyond the canonical id.
        if (!item.classification) return null
        return {
            decision: 'known',
            canonicalId,
            canonical: item.canonical,
            classification: item.classification,
            confidence: r.confidence,
        }
    }

    if (r.decision === 'new_item') {
        const proposedCanonical = typeof r.proposedCanonical === 'string' ? r.proposedCanonical.trim() : ''
        if (!proposedCanonical) return null
        const itemType = r.itemType
        if (itemType !== 'income' && itemType !== 'deduction') return null
        if (itemType !== SECTION_TO_ITEM_TYPE[section]) return null
        const cls = r.classification as Record<string, unknown> | undefined
        if (!cls || typeof cls !== 'object') return null
        const tipoRenta = cls.tipoRenta
        const naturaleza = cls.naturaleza
        if (typeof tipoRenta !== 'string' || !TIPO_RENTA_VALUES.has(tipoRenta as TipoRenta)) return null
        if (typeof naturaleza !== 'string' || !NATURALEZA_VALUES.has(naturaleza as Naturaleza)) return null
        let legalType: ItemClassification['legalType'] | undefined
        if (cls.legalType !== undefined) {
            if (typeof cls.legalType !== 'string' || !LEGAL_TYPE_VALUES.has(cls.legalType)) return null
            if (naturaleza !== 'Legal') return null
            legalType = cls.legalType as ItemClassification['legalType']
        } else if (naturaleza === 'Legal') {
            // Legal naturaleza requires a legalType.
            return null
        }
        return {
            decision: 'new_item',
            proposedCanonical,
            itemType,
            classification: {
                tipoRenta: tipoRenta as TipoRenta,
                naturaleza: naturaleza as Naturaleza,
                ...(legalType ? { legalType } : {}),
            },
            confidence: r.confidence,
        }
    }

    return null
}

/**
 * Gemini arbiter for one unknown cluster. Memory-cached, host-injected,
 * never throws — failure modes (no `configure()`, network error, malformed
 * JSON, low confidence, section incompatibility) all return `null` so the
 * caller keeps the row with the safest fallback classification.
 *
 * Cache identity is `hash(DECISION_SCHEMA_VERSION + section + normalizedLabel)`
 * with a 6-hour default TTL; see `unknown-cache.ts`. Known matches bypass
 * the cache because the deterministic matcher runs first.
 */
export async function arbitrate(input: {
    section: Section
    rawLabel: string
    normalizedLabel: string
    lexicon?: Lexicon
}): Promise<ArbiterResult> {
    const lexicon = input.lexicon ?? LEXICON
    const cached = getCachedDecision(input.section, input.normalizedLabel)
    const resolveCached = (d: CachedDecision): ArbiterResult => {
        if (d.decision === 'known') {
            const item = lexicon.items.find(i => i.id === d.canonicalId)
            // Lexicon may have changed under us; if the cached canonicalId is
            // gone, treat as a miss and fall through to a fresh call.
            if (!item || item.itemType !== SECTION_TO_ITEM_TYPE[input.section]) return null
            return { kind: 'known', item }
        }
        return {
            kind: 'new_item',
            proposedCanonical: d.proposedCanonical,
            classification: d.classification,
        }
    }
    if (cached) {
        const resolved = resolveCached(cached)
        if (resolved) return resolved
    }

    const geminiCall = getGeminiCall()
    if (!geminiCall) return null

    // Candidates: same-section lexicon items only. The arbiter must respect
    // section compatibility, so we never present cross-section candidates.
    const candidates = lexicon.items.filter(
        i => i.itemType === SECTION_TO_ITEM_TYPE[input.section],
    )
    const prompt = buildArbiterPrompt({ ...input, candidates })

    let response: unknown
    try {
        response = await geminiCall({
            model: ARBITER_MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0,
                responseMimeType: 'application/json',
            },
        })
    } catch {
        return null
    }

    const text = stripFences(geminiText(response))
    const parsed = parseJson(text)
    const decision = parseArbiterResponse(parsed, input.section, lexicon)
    if (!decision) return null

    setCachedDecision(input.section, input.normalizedLabel, decision)

    if (decision.decision === 'known') {
        const item = lexicon.items.find(i => i.id === decision.canonicalId)
        // parseArbiterResponse already verified the item exists and matches
        // the section, but the lookup here defends against a race where the
        // lexicon mutated between parse and emit.
        if (!item) return null
        return { kind: 'known', item }
    }
    return {
        kind: 'new_item',
        proposedCanonical: decision.proposedCanonical,
        classification: decision.classification,
    }
}

// Suppress unused-warning on DECISION_SCHEMA_VERSION re-export consumers — it
// is exported from unknown-cache.ts and used implicitly via cache identity.
// Keeping the import here documents the dependency.
void DECISION_SCHEMA_VERSION

/**
 * Build a `ClassifiedItem` from a matched lexicon entry.
 *
 * The `label` is ALWAYS the raw PDF text the row arrived with — never the
 * lexicon canonical. Rewriting the raw label silently erases information
 * the analyst needs to verify against the source document (e.g. a row
 * arriving as "Comisión Vacaciones" must keep saying "Comisión Vacaciones"
 * in the UI even if it bucketed into the `vacaciones` canonical). Row
 * identity for the report table comes from `canonicalId`; the visible label
 * is always the source-of-truth string from the PDF.
 */
function classifyMatchedItem(
    item: LexiconItem,
    value: number,
    canonicalId: string | null,
    label: string,
): ClassifiedItem {
    const cls = item.classification
    const out: ClassifiedItem = {
        canonicalId,
        label,
        value,
        naturaleza: cls?.naturaleza ?? 'Otro',
        tipoRenta: cls?.tipoRenta ?? 'Variable',
    }
    if (cls?.legalType !== undefined) out.legalType = cls.legalType
    return out
}

/**
 * Safe fallback for unmatched rows: preserve the raw label, default to a
 * section-appropriate `naturaleza`. The plan forbids dropping unknown rows;
 * the arbiter (S2) may upgrade this classification later but the row must
 * survive.
 */
function fallback(rawLabel: string, value: number, section: Section): ClassifiedItem {
    return {
        canonicalId: null,
        label: rawLabel,
        value,
        naturaleza: section === 'descuentos' ? 'Otro' : 'Imponible',
        tipoRenta: 'Variable',
    }
}

/**
 * Core deterministic classifier — runs against an explicit alias index so
 * tests can exercise a synthetic lexicon without depending on the seed
 * content of `liquidacion-lexicon.yaml`. Production callers should use
 * `classifyLiquidacionRows`.
 */
export function classifySection(
    rows: Array<{ label: string; value: number }>,
    section: Section,
    index: AliasIndex = INDEX,
): ClassifiedItem[] {
    const itemType = SECTION_TO_ITEM_TYPE[section]
    // Detect same-section collisions: track first-winner per canonicalId.
    const winnerSeen = new Set<string>()
    const out: ClassifiedItem[] = []
    for (const row of rows) {
        if (!row || typeof row.label !== 'string') continue
        const hit = findAliasItem(row.label, itemType, index)
        if (!hit) {
            out.push(fallback(row.label, row.value, section))
            continue
        }
        const isCollisionLoser = winnerSeen.has(hit.id)
        if (!isCollisionLoser) winnerSeen.add(hit.id)
        // Always pass the raw PDF label. canonicalId carries identity; the
        // visible label must mirror the source document. See classifyMatchedItem.
        out.push(classifyMatchedItem(
            hit,
            row.value,
            isCollisionLoser ? null : hit.id,
            row.label,
        ))
    }
    return out
}

/**
 * Public deterministic-plus-arbiter entry. Same function `extract()` calls
 * internally for `doctype === 'liquidaciones-sueldo'`; also re-exported via
 * `@edictus/extract/liquidacion` for Jogi's one-shot legacy backfill.
 *
 * Pipeline:
 *  1. Deterministic alias match per section (`classifySection`).
 *  2. For every row that fell through to the unknown fallback, call the
 *     Gemini arbiter (`arbitrate`) once per normalized cluster. Results are
 *     memory-cached; repeated rows in one call hit the cache after the
 *     first arbiter answer.
 *  3. Apply collision detection across the combined (deterministic + arbiter
 *     `known`) winners, so an arbiter-recognized canonical that also appears
 *     deterministically in the same section keeps only one canonicalId
 *     winner.
 *
 * The arbiter NEVER drops a row. If Gemini is unreachable, returns malformed
 * JSON, low confidence, or section-incompatible — the row keeps its raw
 * label with the safest fallback classification.
 */
export async function classifyLiquidacionRows(
    input: LiquidacionRowsInput,
    lexicon: Lexicon = LEXICON,
    index: AliasIndex = INDEX,
): Promise<LiquidacionRowsOutput> {
    return {
        haberes: await classifyAndArbitrate(input.haberes ?? [], 'haberes', lexicon, index),
        descuentos: await classifyAndArbitrate(input.descuentos ?? [], 'descuentos', lexicon, index),
    }
}

/**
 * Per-section pipeline: deterministic pass → arbiter pass → collision
 * resolution. Extracted so tests can exercise it against a synthetic
 * lexicon.
 */
export async function classifyAndArbitrate(
    rows: Array<{ label: string; value: number }>,
    section: Section,
    lexicon: Lexicon = LEXICON,
    index: AliasIndex = INDEX,
): Promise<ClassifiedItem[]> {
    // Step 1: deterministic. Produces a row per input, fallback for unknowns.
    const deterministic = classifySection(rows, section, index)

    // Step 2: arbiter for fallback rows. We dedupe by normalizedLabel so a
    // repeated unknown only triggers one arbiter call per `classifyLiquidacionRows`
    // invocation (the cache further deduplicates across calls within TTL).
    //
    // Bypass guard: a row was matched by the lexicon (deterministic pass)
    // either when its `canonicalId` is a string (winner) OR when the row's
    // normalized label hits the alias index but the canonical slot was
    // already claimed by an earlier row in the same section (collision
    // loser → `canonicalId: null` but full classification preserved).
    // Both winners and losers must skip the arbiter — losers MUST NOT be
    // re-arbitrated since an arbiter decline (Gemini down, low confidence,
    // malformed JSON) would silently downgrade them to the safest fallback
    // and break the `Legal/legalType` contribution to `cotizPreviReal`.
    //
    // True unknowns (the lexicon didn't recognize the label at all) are
    // identified by re-checking the alias index — that's the only way to
    // distinguish a `null`-canonicalId loser from a `null`-canonicalId
    // unknown without changing the `ClassifiedItem` public contract.
    const itemType = SECTION_TO_ITEM_TYPE[section]
    const arbiterAnswers = new Map<string, ArbiterResult>()
    const out: ClassifiedItem[] = new Array(deterministic.length)
    for (let i = 0; i < deterministic.length; i++) {
        const det = deterministic[i]
        const raw = rows[i]
        const normalized = normalizeLabel(raw.label, false)
        // Matched by the lexicon (winner or collision loser) → bypass arbiter.
        if (findAliasItem(raw.label, itemType, index)) {
            out[i] = det
            continue
        }
        if (!normalized) {
            out[i] = det
            continue
        }
        let result: ArbiterResult | undefined = arbiterAnswers.get(normalized)
        if (result === undefined) {
            result = await arbitrate({
                section,
                rawLabel: raw.label,
                normalizedLabel: normalized,
                lexicon,
            })
            arbiterAnswers.set(normalized, result)
        }
        out[i] = applyArbiterResult(result, raw, section)
    }

    // Step 3: collision detection across the full output. Two-tier priority:
    // deterministic (lexicon-matched) rows own the canonical over any
    // arbiter-promoted row that picked the same canonical. Within each tier
    // the first occurrence wins (order-based, matching the in-section
    // collision rule from step 1). The arbiter is a best-effort classifier;
    // when Gemini guesses an existing canonical for a label the lexicon also
    // recognizes explicitly (e.g. "Bono Venta" → `comisiones` in a PDF that
    // also has a literal "Comisión" row), the explicit row must keep the
    // canonicalId so analyst-visible bucketing stays stable across months.
    const lexiconOwnedCanonicals = new Set<string>()
    for (let i = 0; i < out.length; i++) {
        const item = out[i]
        if (!item.canonicalId) continue
        if (findAliasItem(rows[i].label, itemType, index)) {
            lexiconOwnedCanonicals.add(item.canonicalId)
        }
    }
    const winners = new Set<string>()
    for (let i = 0; i < out.length; i++) {
        const item = out[i]
        if (!item.canonicalId) continue
        const isDeterministic = !!findAliasItem(rows[i].label, itemType, index)
        const stolenFromLexicon =
            !isDeterministic && lexiconOwnedCanonicals.has(item.canonicalId)
        if (stolenFromLexicon || winners.has(item.canonicalId)) {
            out[i] = { ...item, canonicalId: null, label: rows[i]?.label ?? item.label }
        } else {
            winners.add(item.canonicalId)
        }
    }
    return out
}

/**
 * Map an arbiter result onto a row. `null` (decline) keeps the raw label
 * with safest fallback. `known` promotes to the matched lexicon item.
 * `new_item` keeps the raw label but adopts the proposed classification;
 * `canonicalId` stays null because the new concept is not yet in the lexicon.
 */
function applyArbiterResult(
    result: ArbiterResult,
    row: { label: string; value: number },
    section: Section,
): ClassifiedItem {
    if (!result) return fallback(row.label, row.value, section)
    if (result.kind === 'known') {
        // Preserve the raw PDF label even when the arbiter promotes the row
        // to a known canonical. This prevents Gemini-assigned canonicals from
        // erasing the source label when the underlying concept is compound
        // (e.g. "Comisión Vacaciones" arbitrated to `vacaciones` — the row
        // bucket is `vacaciones` but the visible label stays "Comisión Vacaciones").
        return classifyMatchedItem(result.item, row.value, result.item.id, row.label)
    }
    const cls = result.classification
    const out: ClassifiedItem = {
        canonicalId: null,
        label: row.label,
        value: row.value,
        naturaleza: cls.naturaleza,
        tipoRenta: cls.tipoRenta,
    }
    if (cls.legalType !== undefined) out.legalType = cls.legalType
    return out
}
