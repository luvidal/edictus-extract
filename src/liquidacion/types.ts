/**
 * Liquidación-de-sueldo line-item classification types.
 *
 * **Browser-safe — types only.** This module is exported via the
 * `@jogi/extract/liquidacion/types` subpath and must never import a runtime
 * module, reference `Buffer`/`process`, or pull in a Gemini SDK. Production
 * consumers (Jogi `app/`, `lib/reports/situacion/*`, etc.) import these types
 * to thread `canonicalId` + classification through `LineItem` / `LabelValue`
 * / `MonthData` without dragging the satellite's server-only runtime into
 * the client bundle.
 *
 * The runtime entry point lives at `@jogi/extract/liquidacion`
 * (`classifyLiquidacionRows`); the integrated call site lives inside
 * `extract()` for `doctype === 'liquidaciones-sueldo'` only.
 */

/** Income vs. deduction — drives section/`itemType` compatibility in the matcher. */
export type TipoRenta = 'Fija' | 'Variable'

/** Tax/legal nature of a line item. */
export type Naturaleza = 'Imponible' | 'No imponible' | 'Legal' | 'Otro'

/**
 * Legal-deduction subtype. Only meaningful when `naturaleza === 'Legal'`; the
 * lexicon validator rejects `legalType` on non-Legal items.
 */
export type LegalType = 'afp' | 'salud' | 'cesantia' | 'impuesto'

/** Liquidación section a lexicon item resolves rows from. */
export type ItemType = 'income' | 'deduction'

/** Classification metadata attached to every classified row. */
export interface ItemClassification {
    tipoRenta: TipoRenta
    naturaleza: Naturaleza
    legalType?: LegalType
}

/**
 * One lexicon entry — a canonical concept plus the raw-label aliases that
 * resolve to it. `classification` is allowed only when the concept is stable
 * enough to bypass a Gemini arbiter call. `itemType` enforces section
 * compatibility (`income` items only resolve `haberes`, `deduction` items
 * only resolve `descuentos`); mismatches fall through to unknown.
 */
export interface LexiconItem {
    id: string
    canonical: string
    itemType: ItemType
    aliases: string[]
    classification?: ItemClassification
}

/** Compiled lexicon shape consumed by the deterministic matcher. */
export interface Lexicon {
    version: number
    doctype: 'liquidaciones-sueldo'
    itemTypes: ItemType[]
    items: LexiconItem[]
}

/**
 * One classified row emitted by `classifyLiquidacionRows`.
 *
 * - `canonicalId` is the lexicon id when the row was matched, `null` when the
 *   row is a collision loser (see *Collision Rule*) or when no canonical match
 *   exists; the absent/`null` form routes Jogi's `createDefaultRows` through
 *   the raw-label fallback so no value is silently dropped.
 * - `label` is the canonical display label when matched, else the original raw
 *   label preserved verbatim.
 * - `tipoRenta` / `naturaleza` / `legalType` carry classification metadata
 *   from the matched lexicon item, including on collision losers so
 *   reliquidación math stays correct.
 */
export interface ClassifiedItem {
    /** Lexicon id of the matched canonical, or `null` for collision losers / unknowns. */
    canonicalId?: string | null
    /** Display label — canonical when matched, else the raw label verbatim. */
    label: string
    /** Numeric amount, untouched by the lexicon. */
    value: number
    /** Tax/legal nature. */
    naturaleza: Naturaleza
    /** Income recurrence. */
    tipoRenta: TipoRenta
    /** Legal deduction subtype; present only when `naturaleza === 'Legal'`. */
    legalType?: LegalType
}

/** Input shape consumed by `classifyLiquidacionRows`. */
export interface LiquidacionRowsInput {
    haberes: Array<{ label: string; value: number }>
    descuentos: Array<{ label: string; value: number }>
}

/** Output shape returned by `classifyLiquidacionRows`. */
export interface LiquidacionRowsOutput {
    haberes: ClassifiedItem[]
    descuentos: ClassifiedItem[]
}
