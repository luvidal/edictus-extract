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

function addKey(keys: Set<string>, key: string): void {
    if (key.length > 0) keys.add(key)
}

function decoratedCommissionKey(key: string): string | null {
    if (/^comision afp(?:\s|$)/.test(key)) return 'comision afp'
    if (/^comision a f p(?:\s|$)/.test(key)) return 'comision a f p'
    if (/^comision administradora(?:\s|$)/.test(key)) return 'comision administradora'
    if (/^comision adm afp(?:\s|$)/.test(key)) return 'comision adm afp'
    return null
}

/**
 * Candidate alias keys for one raw label. The first key is the strict raw
 * normalized label; later keys cover label decorations observed in real
 * liquidaciones that are not conceptual differences:
 * - parenthetical/base tails (`Seguro Cesantía 0,6% (Imponible: ...)`)
 * - AFP commission administrator/rate suffixes (`Comisión AFP Provida 1,45%`)
 */
export function aliasKeysForLabel(label: string): string[] {
    const keys = new Set<string>()
    addKey(keys, normalizeLabel(label, false))
    addKey(keys, normalizeLabel(label, true))
    for (const key of [...keys]) {
        const decorated = decoratedCommissionKey(key)
        if (decorated) addKey(keys, decorated)
    }
    return [...keys]
}

export function findAliasItem(
    label: string,
    itemType: ItemType,
    index: AliasIndex = INDEX,
): LexiconItem | null {
    for (const key of aliasKeysForLabel(label)) {
        const item = index[itemType].get(key)
        if (item) return item
    }
    return null
}

/**
 * Resolve a raw label to its lexicon `canonicalId`, scoped to an `itemType`.
 * Returns `null` when no alias matches (unknown concept, or a section/itemType
 * mismatch — e.g. `Colación` is `income`, asking with `'deduction'` is null).
 *
 * Matching is against the same candidate-key set the deterministic matcher
 * uses, so any alias the lexicon recognizes resolves identically here.
 */
export function resolveLabelToCanonicalId(
    label: string,
    itemType: ItemType,
): string | null {
    const item = findAliasItem(label, itemType)
    return item ? item.id : null
}
