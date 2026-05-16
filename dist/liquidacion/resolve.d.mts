import { ItemType, LexiconItem, Lexicon } from './types.mjs';

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

/** Map<itemType, Map<normalizedAlias, LexiconItem>> built per-lexicon. */
type AliasIndex = Record<ItemType, Map<string, LexiconItem>>;
/** Build an alias index. Exported so the deterministic matcher can share the
 *  same construction; first-wins on duplicate aliases within an itemType. */
declare function buildAliasIndex(lexicon: Lexicon): AliasIndex;
/**
 * Resolve a raw label to its lexicon `canonicalId`, scoped to an `itemType`.
 * Returns `null` when no alias matches (unknown concept, or a section/itemType
 * mismatch — e.g. `Colación` is `income`, asking with `'deduction'` is null).
 *
 * Matching is `{ itemType, normalizedLabel }` against the same alias index
 * the satellite's deterministic matcher uses, so any alias the lexicon
 * recognizes resolves identically here.
 */
declare function resolveLabelToCanonicalId(label: string, itemType: ItemType): string | null;

export { type AliasIndex, buildAliasIndex, resolveLabelToCanonicalId };
