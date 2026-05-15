/**
 * Unit tests for the label normalization pipeline.
 *
 * Mirrors the consumer-side behavioral spec at
 * `../../jogi/app/reports/situacion/helpers/synonyms.ts` (deletion-on-ship
 * target) and the relevant cases from
 * `../../jogi/app/reports/situacion/helpers/rows.test.ts`.
 */

import { describe, it, expect } from 'vitest'
import {
    resolveLabel,
    normalizeLabel,
    stripParametricTail,
    validateNormalizeConfig,
    type NormalizeFieldConfig,
} from '../src/normalize'

const LIQUIDACION_HABERES: NormalizeFieldConfig = {
    stripParametric: true,
    synonyms: [
        { match: '^asignacion colacion$', canonical: 'Colación' },
        { match: '^asignacion movilizacion$', canonical: 'Movilización' },
    ],
}

const LIQUIDACION_DESCUENTOS: NormalizeFieldConfig = {
    stripParametric: true,
    synonyms: [
        { match: '^salud\\s*7\\s*%$', canonical: 'Cotiz. Salud Obligatoria' },
        { match: '^descuento seguro de salud$', canonical: 'Seguro de Salud' },
        { match: '^impuesto unico$', canonical: 'Impuesto Único' },
    ],
}

describe('stripParametricTail', () => {
    it('strips trailing parenthetical with embedded numbers', () => {
        expect(stripParametricTail('Seguro de Cesantía 0,6% (Imponible: 5.222.933)'))
            .toBe('Seguro de Cesantía 0,6%')
    })

    it('strips `:NUMBER UNIT` suffix', () => {
        expect(stripParametricTail('Descuento Seguro de Salud:1,100000 UF'))
            .toBe('Descuento Seguro de Salud')
    })

    it('strips trailing colon + whitespace', () => {
        expect(stripParametricTail('Impuesto Unico:  ')).toBe('Impuesto Unico')
    })

    it('leaves a clean label alone', () => {
        expect(stripParametricTail('Colación')).toBe('Colación')
    })
})

describe('normalizeLabel (Job 1)', () => {
    it('lowercases + accent-folds + collapses punctuation', () => {
        expect(normalizeLabel('Cotiz. Salud Obligatoria')).toBe('cotiz salud obligatoria')
        expect(normalizeLabel('Impuesto Único')).toBe('impuesto unico')
    })

    it('optionally strips parametric tail first', () => {
        expect(normalizeLabel('Seguro de Cesantía 0,6% (Imponible: 5.222.933)', true))
            .toBe('seguro de cesantia 0 6%')
    })
})

describe('resolveLabel — Job 1 + Job 2 pipeline', () => {
    it('strips parametric tail and yields cleaned display when no synonym matches', () => {
        const r = resolveLabel(
            'Seguro de Cesantía 0,6% (Imponible: 5.222.933)',
            LIQUIDACION_HABERES,
        )
        expect(r.display).toBe('Seguro de Cesantía 0,6%')
        expect(r.key).toBe('seguro de cesantia 0 6%')
    })

    it('resolves a synonym match — Asignación Colación → Colación', () => {
        const r = resolveLabel('Asignación Colación', LIQUIDACION_HABERES)
        expect(r.display).toBe('Colación')
        expect(r.key).toBe('colacion')
    })

    it('collapses the older "Asignación X" prefix with the newer "X"', () => {
        const older = resolveLabel('Asignación Colación', LIQUIDACION_HABERES)
        const newer = resolveLabel('Colación', LIQUIDACION_HABERES)
        // "Colación" alone does not match the `^asignacion colacion$` rule —
        // it passes through with only Job-1 cleanup. Both forms must produce
        // the same dedup key so downstream rows collapse.
        expect(older.key).toBe('colacion')
        expect(newer.key).toBe('colacion')
    })

    it('matches the Salud 7% deduction with whitespace tolerance', () => {
        const a = resolveLabel('Salud 7%', LIQUIDACION_DESCUENTOS)
        const b = resolveLabel('Salud  7 %', LIQUIDACION_DESCUENTOS)
        expect(a.display).toBe('Cotiz. Salud Obligatoria')
        expect(b.display).toBe('Cotiz. Salud Obligatoria')
        expect(a.key).toBe(b.key)
    })

    it('collapses accent variants — Impuesto Unico ↔ Impuesto Único', () => {
        const unaccented = resolveLabel('Impuesto Unico: (Base: $15.616.008)', LIQUIDACION_DESCUENTOS)
        const accented = resolveLabel('Impuesto Único', LIQUIDACION_DESCUENTOS)
        expect(unaccented.display).toBe('Impuesto Único')
        expect(accented.display).toBe('Impuesto Único')
        expect(unaccented.key).toBe(accented.key)
    })

    it('first match wins — earlier rule preempts later matches', () => {
        const cfg: NormalizeFieldConfig = {
            synonyms: [
                { match: '^colacion$', canonical: 'Colación (primera)' },
                { match: '^colacion$', canonical: 'Colación (segunda)' },
            ],
        }
        const r = resolveLabel('Colación', cfg)
        expect(r.display).toBe('Colación (primera)')
    })

    it('passes through unknown labels with Job-1 key + parametric-stripped display', () => {
        const r = resolveLabel(
            'Bono Producción Anual (Bruto: 1.500.000)',
            LIQUIDACION_HABERES,
        )
        expect(r.key).toBe('bono produccion anual')
        // Display preserves casing/accents — only the parametric tail is stripped.
        expect(r.display).toBe('Bono Producción Anual')
    })

    it('passes through with raw label when stripParametric is false and no synonym matches', () => {
        const r = resolveLabel('Bono Especial', { synonyms: [] })
        expect(r.key).toBe('bono especial')
        expect(r.display).toBe('Bono Especial')
    })

    it('handles an empty / undefined config — Job-1 cleanup only', () => {
        const r = resolveLabel('Impuesto Único')
        expect(r.key).toBe('impuesto unico')
        expect(r.display).toBe('Impuesto Único')
    })
})

describe('validateNormalizeConfig — anchoring enforcement', () => {
    it('accepts a fully anchored block', () => {
        expect(() => validateNormalizeConfig({
            'haberes[].label': LIQUIDACION_HABERES,
            'descuentos[].label': LIQUIDACION_DESCUENTOS,
        })).not.toThrow()
    })

    it('rejects an unanchored leading pattern', () => {
        expect(() => validateNormalizeConfig({
            'haberes[].label': {
                synonyms: [{ match: 'asignacion colacion$', canonical: 'Colación' }],
            },
        })).toThrow(/not anchored/)
    })

    it('rejects an unanchored trailing pattern', () => {
        expect(() => validateNormalizeConfig({
            'haberes[].label': {
                synonyms: [{ match: '^asignacion colacion', canonical: 'Colación' }],
            },
        })).toThrow(/not anchored/)
    })

    it('rejects a fully unanchored pattern', () => {
        expect(() => validateNormalizeConfig({
            'haberes[].label': {
                synonyms: [{ match: 'colacion', canonical: 'Colación' }],
            },
        })).toThrow(/not anchored/)
    })

    it('no-ops when the block is null or undefined', () => {
        expect(() => validateNormalizeConfig(null)).not.toThrow()
        expect(() => validateNormalizeConfig(undefined)).not.toThrow()
    })
})
