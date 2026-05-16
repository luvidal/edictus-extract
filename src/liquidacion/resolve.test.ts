import { describe, it, expect } from 'vitest'
import { resolveLabelToCanonicalId } from './resolve'

describe('resolveLabelToCanonicalId', () => {
    it('resolves AFP-family aliases to afp_cotizacion_obligatoria', () => {
        expect(resolveLabelToCanonicalId('AFP', 'deduction')).toBe('afp_cotizacion_obligatoria')
        expect(resolveLabelToCanonicalId('Cotiz. Previsional Obligatoria', 'deduction')).toBe('afp_cotizacion_obligatoria')
        expect(resolveLabelToCanonicalId('Capitalización Individual', 'deduction')).toBe('afp_cotizacion_obligatoria')
    })

    it('resolves decorated legal deduction labels the same way the matcher does', () => {
        expect(resolveLabelToCanonicalId('Seguro de Cesantía 0,6% (Imponible: 5.222.933)', 'deduction')).toBe('seguro_cesantia')
        expect(resolveLabelToCanonicalId('Comisión AFP Provida 1,45%', 'deduction')).toBe('comision_afp')
    })

    it('resolves Colación accent/synonym variants to colacion', () => {
        expect(resolveLabelToCanonicalId('Colación', 'income')).toBe('colacion')
        expect(resolveLabelToCanonicalId('Asignación Colación', 'income')).toBe('colacion')
        expect(resolveLabelToCanonicalId('Asignacion Colacion', 'income')).toBe('colacion')
    })

    it('enforces itemType compatibility — income alias asked as deduction is null', () => {
        expect(resolveLabelToCanonicalId('Colación', 'deduction')).toBeNull()
        expect(resolveLabelToCanonicalId('AFP', 'income')).toBeNull()
    })

    it('returns null for unknown labels and empty strings', () => {
        expect(resolveLabelToCanonicalId('Random Bonus XYZ', 'income')).toBeNull()
        expect(resolveLabelToCanonicalId('', 'income')).toBeNull()
        expect(resolveLabelToCanonicalId('   ', 'income')).toBeNull()
    })
})
