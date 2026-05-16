/**
 * Deterministic-path unit tests for the liquidación lexicon matcher.
 *
 * S2 will add a separate `describe('lexicon — arbiter', ...)` block in this
 * same file; keep the deterministic-path tests in their own block so the
 * two streams can land without merge conflicts.
 *
 * These tests build a synthetic `Lexicon` covering the behaviors the plan
 * requires (Colación, Movilización, Salud 7%, Adicional Salud, AFP
 * contribution vs AFP commission, section-incompatibility, collision) and
 * exercise the production `classifySection` against it via the exported
 * `buildAliasIndex`. The checked-in YAML seed only covers `sueldo_base`
 * (S1 schema portion); the full Chilean payroll lands with S3.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { buildAliasIndex, classifySection, classifyLiquidacionRows } from './lexicon'
import type { Lexicon } from './types'

const TEST_LEXICON: Lexicon = {
    version: 1,
    doctype: 'liquidaciones-sueldo',
    itemTypes: ['income', 'deduction'],
    items: [
        {
            id: 'colacion',
            canonical: 'Colación',
            itemType: 'income',
            aliases: ['Colación', 'Colacion', 'Asignación Colación', 'Asignacion Colacion'],
            classification: { naturaleza: 'No imponible', tipoRenta: 'Fija' },
        },
        {
            id: 'movilizacion',
            canonical: 'Movilización',
            itemType: 'income',
            aliases: ['Movilización', 'Movilizacion', 'Asignación Movilización'],
            classification: { naturaleza: 'No imponible', tipoRenta: 'Fija' },
        },
        {
            id: 'salud_obligatoria',
            canonical: 'Cotiz. Salud Obligatoria',
            itemType: 'deduction',
            aliases: ['Salud 7%', 'Salud 7', 'Cotiz. Salud Obligatoria'],
            classification: { naturaleza: 'Legal', tipoRenta: 'Fija', legalType: 'salud' },
        },
        {
            id: 'adicional_salud',
            canonical: 'Adicional Salud',
            itemType: 'deduction',
            aliases: ['Adicional Salud', 'Cotización Adicional Salud'],
            classification: { naturaleza: 'Otro', tipoRenta: 'Fija' },
        },
        {
            id: 'afp_cotizacion_obligatoria',
            canonical: 'Cotiz. Previsional Obligatoria',
            itemType: 'deduction',
            aliases: ['AFP', 'Cotiz. Previ. Obligatoria', 'Capitalización Individual'],
            classification: { naturaleza: 'Legal', tipoRenta: 'Fija', legalType: 'afp' },
        },
        {
            id: 'comision_afp',
            canonical: 'Comisión AFP',
            itemType: 'deduction',
            aliases: ['Comisión AFP', 'Comision AFP'],
            classification: { naturaleza: 'Legal', tipoRenta: 'Fija', legalType: 'afp' },
        },
    ],
}

describe('lexicon — deterministic', () => {
    const idx = buildAliasIndex(TEST_LEXICON)

    it('resolves Colación by canonical spelling', () => {
        const [out] = classifySection([{ label: 'Colación', value: 12345 }], 'haberes', idx)
        expect(out).toMatchObject({
            canonicalId: 'colacion',
            label: 'Colación',
            naturaleza: 'No imponible',
            tipoRenta: 'Fija',
        })
    })

    it('resolves Movilización by canonical spelling', () => {
        const [out] = classifySection([{ label: 'Movilización', value: 5000 }], 'haberes', idx)
        expect(out).toMatchObject({ canonicalId: 'movilizacion', naturaleza: 'No imponible' })
    })

    it('resolves "Asignacion Colacion" (unaccented) to colacion', () => {
        const [out] = classifySection([{ label: 'Asignacion Colacion', value: 1 }], 'haberes', idx)
        expect(out.canonicalId).toBe('colacion')
        expect(out.label).toBe('Colación')
    })

    it('classifies Salud 7% as Legal/salud', () => {
        const [out] = classifySection([{ label: 'Salud 7%', value: 70000 }], 'descuentos', idx)
        expect(out).toMatchObject({
            canonicalId: 'salud_obligatoria',
            naturaleza: 'Legal',
            legalType: 'salud',
        })
    })

    it('classifies Adicional Salud as Otro (voluntary), not Legal', () => {
        const [out] = classifySection([{ label: 'Adicional Salud', value: 15000 }], 'descuentos', idx)
        expect(out).toMatchObject({ canonicalId: 'adicional_salud', naturaleza: 'Otro' })
        expect(out.legalType).toBeUndefined()
    })

    it('classifies AFP contribution and AFP commission both as Legal/afp (distinct canonical ids)', () => {
        const out = classifySection(
            [{ label: 'AFP', value: 80000 }, { label: 'Comisión AFP', value: 6000 }],
            'descuentos',
            idx,
        )
        expect(out[0]).toMatchObject({ canonicalId: 'afp_cotizacion_obligatoria', naturaleza: 'Legal', legalType: 'afp' })
        expect(out[1]).toMatchObject({ canonicalId: 'comision_afp', naturaleza: 'Legal', legalType: 'afp' })
        expect(out[0].canonicalId).not.toBe(out[1].canonicalId)
    })

    it('rejects section-incompatible income alias appearing in descuentos', () => {
        // Colación is income-only; in descuentos it must fall through to unknown
        // so the raw label survives instead of being silently classified.
        const [out] = classifySection([{ label: 'Colación', value: 12345 }], 'descuentos', idx)
        expect(out.canonicalId).toBeNull()
        expect(out.label).toBe('Colación')
        expect(out.naturaleza).toBe('Otro')
    })

    it('rejects section-incompatible deduction alias appearing in haberes', () => {
        const [out] = classifySection([{ label: 'Salud 7%', value: 70000 }], 'haberes', idx)
        expect(out.canonicalId).toBeNull()
        expect(out.label).toBe('Salud 7%')
        expect(out.naturaleza).toBe('Imponible')
    })

    it('collision: two descuentos rows normalizing to comision_afp emit one winner and one loser, both classified', () => {
        const out = classifySection(
            [{ label: 'Comisión AFP', value: 6000 }, { label: 'Comision AFP', value: 4000 }],
            'descuentos',
            idx,
        )
        expect(out).toHaveLength(2)
        // Winner keeps canonicalId; loser drops it but both stay classified.
        expect(out[0].canonicalId).toBe('comision_afp')
        expect(out[1].canonicalId).toBeNull()
        expect(out[0].naturaleza).toBe('Legal')
        expect(out[0].legalType).toBe('afp')
        expect(out[1].naturaleza).toBe('Legal')
        expect(out[1].legalType).toBe('afp')
        // Values are preserved (no summing, no drops).
        expect(out[0].value).toBe(6000)
        expect(out[1].value).toBe(4000)
    })
})

describe('lexicon — public entry (shipped seed)', () => {
    it('classifies Sueldo Base against the shipped YAML seed', async () => {
        const out = await classifyLiquidacionRows({
            haberes: [{ label: 'Sueldo Base', value: 500000 }],
            descuentos: [],
        })
        expect(out.haberes[0]).toMatchObject({
            canonicalId: 'sueldo_base',
            label: 'Sueldo Base',
            naturaleza: 'Imponible',
            tipoRenta: 'Fija',
        })
        expect(out.descuentos).toEqual([])
    })

    it('preserves unknown rows with their raw label', async () => {
        const out = await classifyLiquidacionRows({
            haberes: [{ label: 'Bono Misterioso', value: 1234 }],
            descuentos: [{ label: 'Algo Desconocido', value: 999 }],
        })
        expect(out.haberes[0]).toMatchObject({ canonicalId: null, label: 'Bono Misterioso', value: 1234 })
        expect(out.descuentos[0]).toMatchObject({ canonicalId: null, label: 'Algo Desconocido', value: 999 })
    })
})

/**
 * Arbiter tests (S2).
 *
 * These exercise `classifyAndArbitrate` against the same synthetic `TEST_LEXICON`
 * used by the deterministic block. `geminiCall` is stubbed via the satellite's
 * `configure({ doctypes, geminiCall })` channel — the arbiter pulls it through
 * the shared `Symbol.for('@jogi/extract.config')` global. No real Gemini call.
 *
 * Each test calls `clearCache()` first so cross-test state never leaks.
 */
import { configure } from '../index'
import { classifyAndArbitrate } from './lexicon'
import {
    clearCache,
    __setNowForTest,
    DECISION_SCHEMA_VERSION,
    DEFAULT_TTL_MS,
} from './unknown-cache'
import type { DoctypesMap, GeminiCall } from '../index'

const NOOP_DOCTYPES: DoctypesMap = {
    'liquidaciones-sueldo': { label: 'Liquidación', fields: [{ key: 'haberes', type: 'list' }] },
}

function configureWith(geminiCall: GeminiCall): void {
    configure({ doctypes: NOOP_DOCTYPES, geminiCall })
}

function stubGemini(payload: unknown): GeminiCall {
    return async () => ({
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
    })
}

function trackingStub(payload: unknown): { call: GeminiCall; calls: number } {
    let calls = 0
    const call: GeminiCall = async () => {
        calls++
        return { text: typeof payload === 'string' ? payload : JSON.stringify(payload) }
    }
    return {
        get calls() {
            return calls
        },
        call,
    }
}

describe('lexicon — arbiter', () => {
    const idx = buildAliasIndex(TEST_LEXICON)

    beforeEach(() => {
        clearCache()
        __setNowForTest(undefined)
    })

    it('caches a known-cluster decision: second call skips geminiCall', async () => {
        const tracker = trackingStub({
            decision: 'known',
            canonicalId: 'colacion',
            confidence: 'high',
            reason: 'Employer-specific alias of Colación',
        })
        configureWith(tracker.call)

        const rows = [{ label: 'Aporte Comida', value: 12345 }]
        const first = await classifyAndArbitrate(rows, 'haberes', TEST_LEXICON, idx)
        expect(first[0]).toMatchObject({
            canonicalId: 'colacion',
            label: 'Colación',
            naturaleza: 'No imponible',
            tipoRenta: 'Fija',
        })
        expect(tracker.calls).toBe(1)

        const second = await classifyAndArbitrate(rows, 'haberes', TEST_LEXICON, idx)
        expect(second[0].canonicalId).toBe('colacion')
        // Second call must NOT invoke geminiCall again — cache hit.
        expect(tracker.calls).toBe(1)
    })

    it('new_item branch: row keeps raw label, gets proposed classification, no canonicalId', async () => {
        configureWith(stubGemini({
            decision: 'new_item',
            proposedCanonical: 'Bono Apertura',
            itemType: 'income',
            classification: { naturaleza: 'Imponible', tipoRenta: 'Variable' },
            confidence: 'medium',
            reason: 'Employer-specific bonus; not equivalent to existing canonical items',
        }))

        const out = await classifyAndArbitrate(
            [{ label: 'Bono Apertura Sucursal', value: 50000 }],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        expect(out[0]).toMatchObject({
            canonicalId: null,
            label: 'Bono Apertura Sucursal',
            value: 50000,
            naturaleza: 'Imponible',
            tipoRenta: 'Variable',
        })
        expect(out[0].legalType).toBeUndefined()
    })

    it('low-confidence fallback: row preserved with raw label and safest classification', async () => {
        configureWith(stubGemini({
            decision: 'known',
            canonicalId: 'colacion',
            confidence: 'low',
            reason: 'Ambiguous',
        }))

        const out = await classifyAndArbitrate(
            [{ label: 'Aporte Misterioso', value: 1234 }],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        // Low confidence → arbiter declines → safest haberes fallback: Imponible / Variable.
        expect(out[0]).toMatchObject({
            canonicalId: null,
            label: 'Aporte Misterioso',
            naturaleza: 'Imponible',
            tipoRenta: 'Variable',
        })
    })

    it('section-incompatibility rejection: known pointing at income item but row is in descuentos', async () => {
        configureWith(stubGemini({
            decision: 'known',
            canonicalId: 'colacion', // income-only
            confidence: 'high',
            reason: 'Pretends to be Colación',
        }))

        const out = await classifyAndArbitrate(
            [{ label: 'Algo Raro', value: 9999 }],
            'descuentos',
            TEST_LEXICON,
            idx,
        )
        // Section mismatch → arbiter rejects → safest descuentos fallback: Otro / Variable.
        expect(out[0]).toMatchObject({
            canonicalId: null,
            label: 'Algo Raro',
            naturaleza: 'Otro',
            tipoRenta: 'Variable',
        })
    })

    it('unavailable / thrown geminiCall: row preserved, no error propagates', async () => {
        configureWith(async () => {
            throw new Error('Gemini down')
        })

        const out = await classifyAndArbitrate(
            [{ label: 'Algo Desconocido', value: 777 }],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({
            canonicalId: null,
            label: 'Algo Desconocido',
            naturaleza: 'Imponible',
            tipoRenta: 'Variable',
        })
    })

    it('malformed JSON response: row preserved with safest fallback', async () => {
        configureWith(stubGemini('not json at all {{{'))

        const out = await classifyAndArbitrate(
            [{ label: 'Algo Roto', value: 1 }],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        expect(out[0]).toMatchObject({ canonicalId: null, label: 'Algo Roto' })
    })

    it('cache TTL: after entry expires, next call re-invokes geminiCall', async () => {
        const tracker = trackingStub({
            decision: 'known',
            canonicalId: 'colacion',
            confidence: 'high',
            reason: 'Alias of Colación',
        })
        configureWith(tracker.call)

        const rows = [{ label: 'Aporte Comida', value: 1 }]

        // Pin clock to t=0 for the first call.
        let now = 1_000_000
        __setNowForTest(() => now)

        await classifyAndArbitrate(rows, 'haberes', TEST_LEXICON, idx)
        expect(tracker.calls).toBe(1)

        // Advance past TTL.
        now += DEFAULT_TTL_MS + 1000
        await classifyAndArbitrate(rows, 'haberes', TEST_LEXICON, idx)
        expect(tracker.calls).toBe(2)
    })

    it('schema version is exported and >= 1 (used to invalidate cache on rule changes)', () => {
        expect(DECISION_SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
    })

    it('deterministic match bypasses the arbiter entirely (no geminiCall for known rows)', async () => {
        const tracker = trackingStub({ decision: 'known', canonicalId: 'colacion', confidence: 'high', reason: '' })
        configureWith(tracker.call)

        const out = await classifyAndArbitrate(
            // Deterministic alias — already in the lexicon.
            [{ label: 'Colación', value: 12345 }],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        expect(out[0]).toMatchObject({ canonicalId: 'colacion', label: 'Colación' })
        expect(tracker.calls).toBe(0)
    })

    it('arbiter-promoted row that collides with a deterministic winner drops canonicalId on the loser', async () => {
        // Arbiter says "Aporte Comida" → colacion (known). Deterministic pass
        // already matched a literal "Colación" row → colacion. Collision
        // detection runs after the arbiter pass and demotes the second hit.
        configureWith(stubGemini({
            decision: 'known',
            canonicalId: 'colacion',
            confidence: 'high',
            reason: 'Alias of Colación',
        }))

        const out = await classifyAndArbitrate(
            [
                { label: 'Colación', value: 10000 },
                { label: 'Aporte Comida', value: 5000 },
            ],
            'haberes',
            TEST_LEXICON,
            idx,
        )
        expect(out).toHaveLength(2)
        expect(out[0].canonicalId).toBe('colacion')
        expect(out[1].canonicalId).toBeNull()
        // Both still carry the classification metadata.
        expect(out[1].naturaleza).toBe('No imponible')
        expect(out[1].tipoRenta).toBe('Fija')
        // Loser keeps the raw label (it was arbiter-promoted, but collision
        // demotion strips canonicalId without re-labeling).
        expect(out[0].value).toBe(10000)
        expect(out[1].value).toBe(5000)
    })

    it('deterministic collision loser keeps Legal/legalType even when arbiter declines (regression: collision losers must not be re-arbitrated)', async () => {
        // Two `descuentos` rows that both alias to `comision_afp` — the second
        // is a collision loser in the deterministic pass. Arbiter is stubbed
        // to decline (`null` result via low confidence): if `classifyAndArbitrate`
        // routes the loser through the arbiter, the row downgrades to the
        // safest descuentos fallback (`Otro` / `Variable`, no `legalType`) and
        // the `Legal/legalType=afp` contribution to `cotizPreviReal` is lost.
        // The fix: lexicon-matched rows (winner OR loser) bypass the arbiter
        // entirely, so the loser keeps its full classification.
        const tracker = trackingStub({
            decision: 'known',
            canonicalId: 'comision_afp',
            confidence: 'low', // → parseArbiterResponse returns null
            reason: 'irrelevant',
        })
        configureWith(tracker.call)

        const out = await classifyAndArbitrate(
            [
                { label: 'Comisión AFP', value: 6000 },
                { label: 'Comision AFP', value: 4000 },
            ],
            'descuentos',
            TEST_LEXICON,
            idx,
        )
        expect(out).toHaveLength(2)
        // Winner: full canonical classification.
        expect(out[0]).toMatchObject({
            canonicalId: 'comision_afp',
            naturaleza: 'Legal',
            legalType: 'afp',
            tipoRenta: 'Fija',
            value: 6000,
        })
        // Loser: canonicalId null, but classification preserved.
        expect(out[1].canonicalId).toBeNull()
        expect(out[1]).toMatchObject({
            naturaleza: 'Legal',
            legalType: 'afp',
            tipoRenta: 'Fija',
            value: 4000,
        })
        // The arbiter must not have been called for either row — both were
        // lexicon-matched by the deterministic pass.
        expect(tracker.calls).toBe(0)
    })
})

describe('lexicon — D2 parametric-stripped aliases (shipped seed)', () => {
    beforeEach(() => {
        clearCache()
        __setNowForTest(undefined)
    })

    it('Seguro de Cesantía 0,6% resolves deterministically to seguro_cesantia without an arbiter call', async () => {
        // Jogi's `doctypes.json` `descuentos[].label` normalize block has
        // `stripParametric: true`, but it only strips `(...)` and `:N UNIT`
        // suffixes — not bare `0,6%` tails. A row labeled "Seguro de Cesantía
        // 0,6%" reaches the satellite as-is, and the deterministic matcher
        // must resolve it directly via an alias (regression: pre-fix the row
        // fell through to the arbiter and, on decline, downgraded to Otro).
        const tracker = trackingStub({
            decision: 'new_item',
            proposedCanonical: 'Something Else',
            itemType: 'deduction',
            classification: { naturaleza: 'Otro', tipoRenta: 'Variable' },
            confidence: 'high',
            reason: 'should never be called',
        })
        configureWith(tracker.call)

        const out = await classifyLiquidacionRows({
            haberes: [],
            descuentos: [{ label: 'Seguro de Cesantía 0,6%', value: 3500 }],
        })
        expect(out.descuentos[0]).toMatchObject({
            canonicalId: 'seguro_cesantia',
            label: 'Seguro de Cesantía',
            naturaleza: 'Legal',
            legalType: 'afp',
            tipoRenta: 'Fija',
        })
        // Deterministic match — arbiter must not have been called.
        expect(tracker.calls).toBe(0)
    })
})

