/**
 * Process-local memory cache for Gemini arbiter decisions on unknown
 * liquidación-de-sueldo line-item clusters.
 *
 * Key shape: `hash(DECISION_SCHEMA_VERSION + section + normalizedLabel)`.
 * Identity bakes in the schema version, so bumping `DECISION_SCHEMA_VERSION`
 * invalidates every cached entry without touching the Map. TTL defaults to
 * 6 hours (see `DEFAULT_TTL_MS`).
 *
 * Hard constraints (see plan → *Cache* section):
 * - Process-local only — a plain `Map`. No Prisma, no `derived_caches`, no
 *   `configureExtractor` host-cache integration. v1 is deliberately DB-free.
 * - Stores **only** the cluster decision shape (`canonicalId`, `canonical`,
 *   `classification`, etc.). Never store file IDs, names, RUTs, exact
 *   amounts, client identifiers, or host DB field names.
 * - Known rows bypass this cache entirely; the deterministic matcher runs
 *   before any cache lookup so newly-added aliases are never blocked by a
 *   stale entry.
 */

import type { ItemClassification, ItemType, Naturaleza, TipoRenta } from './types'

/**
 * Bump this when the Gemini decision rule set or result shape changes.
 * YAML membership changes must NOT bump this — those are handled by the
 * deterministic matcher running first.
 */
export const DECISION_SCHEMA_VERSION = 1

/** Default TTL (6 hours). Cache is an optimization; correctness never depends on it. */
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000

type Section = 'haberes' | 'descuentos'

/**
 * Cached Gemini decision shape. Mirrors the response schema in the plan but
 * normalized so the consumer never re-parses raw model JSON on a cache hit.
 *
 * Both branches carry the classification metadata that the arbiter applies
 * to the row; the consumer never has to look up the lexicon again on a hit.
 */
export type CachedDecision =
    | {
          decision: 'known'
          canonicalId: string
          canonical: string
          classification: ItemClassification
          confidence: 'high' | 'medium'
      }
    | {
          decision: 'new_item'
          proposedCanonical: string
          itemType: ItemType
          classification: {
              tipoRenta: TipoRenta
              naturaleza: Naturaleza
              legalType?: ItemClassification['legalType']
          }
          confidence: 'high' | 'medium'
      }

interface CacheEntry {
    decision: CachedDecision
    expiresAt: number
}

/** Module-local store. Process-scoped; resets on restart. */
const STORE = new Map<string, CacheEntry>()

/** Indirection so tests can advance the clock without `vi.useFakeTimers()`. */
let nowFn: () => number = () => Date.now()

function buildKey(section: Section, normalizedLabel: string): string {
    // The schema version is baked into the key so a version bump invalidates
    // every entry implicitly. Plain string concat is fine — the key is never
    // exposed outside this module and contains no PII (the normalized label
    // is the lexicon-normalized form, never raw input).
    return `v${DECISION_SCHEMA_VERSION}|${section}|${normalizedLabel}`
}

/**
 * Look up a cached decision. Returns undefined on miss or when the entry has
 * expired (expired entries are evicted lazily on read).
 */
export function getCachedDecision(
    section: Section,
    normalizedLabel: string,
): CachedDecision | undefined {
    const key = buildKey(section, normalizedLabel)
    const entry = STORE.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= nowFn()) {
        STORE.delete(key)
        return undefined
    }
    return entry.decision
}

/**
 * Store a decision under `{section, normalizedLabel}` with the default TTL.
 * Overwrites any prior entry for the same key.
 */
export function setCachedDecision(
    section: Section,
    normalizedLabel: string,
    decision: CachedDecision,
): void {
    const key = buildKey(section, normalizedLabel)
    STORE.set(key, { decision, expiresAt: nowFn() + DEFAULT_TTL_MS })
}

/** Test-only. Clear the entire cache between cases. */
export function clearCache(): void {
    STORE.clear()
}

/**
 * Test-only. Override the clock used for TTL math. Pass `undefined` to reset.
 * Not exported from the package barrel; tests reach in via the direct module
 * path.
 */
export function __setNowForTest(fn: (() => number) | undefined): void {
    nowFn = fn ?? (() => Date.now())
}
