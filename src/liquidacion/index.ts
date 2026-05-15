/**
 * Server-only public surface for the `@jogi/extract/liquidacion` subpath.
 *
 * This barrel is for the runtime entry point Jogi consumes from the
 * one-shot backfill script (`scripts/backfill-liquidacion-classification.ts`).
 * The same function is invoked internally by `extract()` for the
 * `liquidaciones-sueldo` doctype.
 *
 * Browser-safe types live at `@jogi/extract/liquidacion/types` (`./types.ts`);
 * do not re-export them from here — that would pull the runtime module into
 * any consumer that only needed types.
 */

export { classifyLiquidacionRows } from './lexicon'
