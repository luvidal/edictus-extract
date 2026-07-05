import { ItemType, LexiconItem, Lexicon } from './types.mjs';

/**
 * Browser-safe lexicon-alias resolver — maps an arbitrary label back to its
 * lexicon `canonicalId`. Exposed via `@edictus/extract/liquidacion/resolve` for
 * host consumers (Jogi) that need to bridge pre-cutover saved row labels to
 * post-cutover canonical rows without round-tripping through the
 * classification pipeline.
 *
 * Browser-safe: imports only `LEXICON` (pure data) and `normalizeLabel`
 * (pure string fn). No Gemini SDK, no Node-only modules.
 */

/** Map<itemType, Map<normalizedAlias, LexiconItem>> built per-lexicon. */
type AliasIndex = Record<ItemType, Map<string, LexiconItem>>;
/** Build an alias index. Exported so the deterministic matcher can share the
 *  same construction; first-wins on duplicate aliases within an itemType. */
declare function buildAliasIndex(lexicon: Lexicon): AliasIndex;
/**
 * Candidate alias keys for one raw label. The first key is the strict raw
 * normalized label; later keys cover label decorations observed in real
 * liquidaciones that are not conceptual differences:
 * - parenthetical/base tails (`Seguro Cesantía 0,6% (Imponible: ...)`)
 * - AFP commission administrator/rate suffixes (`Comisión AFP Provida 1,45%`)
 */
declare function aliasKeysForLabel(label: string): string[];
declare function findAliasItem(label: string, itemType: ItemType, index?: AliasIndex): LexiconItem | null;
/**
 * Resolve a raw label to its lexicon `canonicalId`, scoped to an `itemType`.
 * Returns `null` when no alias matches (unknown concept, or a section/itemType
 * mismatch — e.g. `Colación` is `income`, asking with `'deduction'` is null).
 *
 * Matching is against the same candidate-key set the deterministic matcher
 * uses, so any alias the lexicon recognizes resolves identically here.
 */
declare function resolveLabelToCanonicalId(label: string, itemType: ItemType): string | null;

export { type AliasIndex, aliasKeysForLabel, buildAliasIndex, findAliasItem, resolveLabelToCanonicalId };
