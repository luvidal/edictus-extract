import { describe, expect, it } from 'vitest'
import { buildResponseSchema, type Doctype } from '../src/index'

describe('buildResponseSchema', () => {
    it('builds a flat scalar schema mirroring deuda-consumo', () => {
        const dt: Doctype = {
            fields: [
                { key: 'institucion', type: 'string' },
                { key: 'producto', type: 'string' },
                { key: 'numero_credito', type: 'string' },
                { key: 'moneda', type: 'string' },
                { key: 'monto_original', type: 'num' },
                { key: 'saldo_insoluto', type: 'num' },
                { key: 'cuota', type: 'num' },
                { key: 'fecha_otorgamiento', type: 'date' },
                { key: 'fecha_vencimiento', type: 'date' },
                { key: 'estado', type: 'string' },
            ],
        }

        const schema = buildResponseSchema(dt)

        expect(schema).not.toBeNull()
        expect(schema?.type).toBe('OBJECT')
        expect(schema?.required).toEqual(['data', 'docdate'])
        expect(schema?.properties?.docdate).toEqual({ type: 'STRING', nullable: true })

        const data = schema?.properties?.data
        expect(data?.type).toBe('OBJECT')
        expect(Object.keys(data?.properties ?? {})).toEqual(dt.fields.map(field => field.key))
        expect(data?.required).toEqual(dt.fields.map(field => field.key))

        for (const field of dt.fields) {
            expect(data?.properties?.[field.key]?.nullable).toBe(true)
        }
        expect(data?.properties?.monto_original?.type).toBe('NUMBER')
        expect(data?.properties?.saldo_insoluto?.type).toBe('NUMBER')
        expect(data?.properties?.cuota?.type).toBe('NUMBER')
        expect(data?.properties?.institucion?.type).toBe('STRING')
        expect(data?.properties?.fecha_otorgamiento?.type).toBe('STRING')
    })

    it('returns null for doctypes with list fields', () => {
        const dt: Doctype = {
            fields: [
                { key: 'empleador', type: 'string' },
                { key: 'haberes', type: 'list' },
            ],
        }

        expect(buildResponseSchema(dt)).toBeNull()
    })

    it('maps bool fields to nullable BOOLEAN properties', () => {
        const dt: Doctype = {
            fields: [{ key: 'vigente', type: 'bool' }],
        }

        const schema = buildResponseSchema(dt)

        expect(schema?.properties?.data?.properties?.vigente).toEqual({
            type: 'BOOLEAN',
            nullable: true,
        })
    })

    it('keeps identifier-style string fields as STRING', () => {
        const dt: Doctype = {
            fields: [{ key: 'numero_credito', type: 'string' }],
        }

        const schema = buildResponseSchema(dt)

        expect(schema?.properties?.data?.properties?.numero_credito?.type).toBe('STRING')
        expect(schema?.properties?.data?.properties?.numero_credito?.type).not.toBe('NUMBER')
    })
})
