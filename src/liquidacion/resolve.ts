/**
 * Browser-safe lexicon-alias resolver — maps an arbitrary label back to its
 * lexicon `canonicalId`. Exposed via `@jogi/extract/liquidacion/resolve` for
 * host consumers (Jogi) that need to bridge pre-cutover saved row labels to
 * post-cutover canonical rows without round-tripping through the
 * classification pipeline.
 *
 * Browser-safe: imports only `LEXICON` (pure data) and `normalizeLabel`
 * (pure string fn). No Gemini SDK, no Node-only modules.
 */

import { normalizeLabel } from '../normalize'
import { LEXICON } from '../data/liquidacion-lexicon.generated'
import type { ItemType, Lexicon, LexiconItem } from './types'

/** Map<itemType, Map<normalizedAlias, LexiconItem>> built per-lexicon. */
export type AliasIndex = Record<ItemType, Map<string, LexiconItem>>

/** Build an alias index. Exported so the deterministic matcher can share the
 *  same construction; first-wins on duplicate aliases within an itemType. */
export function buildAliasIndex(lexicon: Lexicon): AliasIndex {
    const idx: AliasIndex = { income: new Map(), deduction: new Map() }
    for (const item of lexicon.items) {
        const bucket = idx[item.itemType]
        for (const alias of item.aliases) {
            const key = normalizeLabel(alias, false)
            if (key.length === 0) continue
            if (!bucket.has(key)) bucket.set(key, item)
        }
    }
    return idx
}

const INDEX: AliasIndex = buildAliasIndex(LEXICON)

/**
 * Resolve a raw label to its lexicon `canonicalId`, scoped to an `itemType`.
 * Returns `null` when no alias matches (unknown concept, or a section/itemType
 * mismatch — e.g. `Colación` is `income`, asking with `'deduction'` is null).
 *
 * Matching is `{ itemType, normalizedLabel }` against the same alias index
 * the satellite's deterministic matcher uses, so any alias the lexicon
 * recognizes resolves identically here.
 */
export function resolveLabelToCanonicalId(
    label: string,
    itemType: ItemType,
): string | null {
    const key = normalizeLabel(label, false)
    if (key.length === 0) return null
    const item = INDEX[itemType].get(key)
    return item ? item.id : null
}
