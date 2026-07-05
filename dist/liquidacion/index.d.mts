import { AliasIndex } from './resolve.mjs';
import { LiquidacionRowsInput, Lexicon, LiquidacionRowsOutput } from './types.mjs';

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
declare function classifyLiquidacionRows(input: LiquidacionRowsInput, lexicon?: Lexicon, index?: AliasIndex): Promise<LiquidacionRowsOutput>;

export { classifyLiquidacionRows };
