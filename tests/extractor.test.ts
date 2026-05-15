/**
 * Smoke tests for @jogi/extract.
 *
 * No real Gemini call: geminiCall is stubbed to return canned JSON. Validates
 * configure() wiring, prompt assembly, references injection, JSON parsing
 * (incl. brace recovery), per-type coercion, and the {data, docdate} envelope.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
    configure,
    extract,
    extractFields,
    getDoctypes,
    getDoctypesMap,
    parseJsonLoose,
    normalizeDocdate,
    type DoctypesMap,
    type GeminiCall,
} from '../src/index'

const DOCTYPES: DoctypesMap = {
    'cedula-identidad': {
        label: 'Cédula',
        fields: [
            { key: 'rut', type: 'string' },
            { key: 'nombres', type: 'string' },
            { key: 'apellidos', type: 'string' },
            { key: 'fecha_nacimiento', type: 'date' },
            { key: 'fecha_vencimiento', type: 'date' },
        ],
    },
    'liquidaciones-sueldo': {
        label: 'Liquidación',
        dateHint: 'Usa el mes/año del PERÍODO',
        fields: [
            { key: 'empleador', type: 'string' },
            { key: 'rut', type: 'string' },
            { key: 'periodo', type: 'month' },
            { key: 'base_imponible', type: 'num' },
            { key: 'haberes', type: 'list', ai: 'array de {label, value}' },
            { key: 'descuentos', type: 'list' },
        ],
    },
    'no-fields': { label: 'Empty', fields: [] },
}

function stubGemini(payload: unknown, usage?: { prompt?: number; cand?: number }): GeminiCall {
    return async () => ({
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
        ...(usage ? { usageMetadata: { promptTokenCount: usage.prompt, candidatesTokenCount: usage.cand, totalTokenCount: (usage.prompt ?? 0) + (usage.cand ?? 0) } } : {}),
    })
}

describe('configure', () => {
    it('throws when extract() is called before configure()', async () => {
        const sym = Symbol.for('@jogi/extract.config')
        ;(globalThis as any)[sym] = undefined
        await expect(extract(Buffer.from('x'), 'image/png', 'cedula-identidad')).rejects.toThrow(/configure/)
    })

    it('exposes doctypes after configure()', () => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ data: {} }) })
        expect(getDoctypes().map(d => d.id)).toEqual(Object.keys(DOCTYPES))
        expect(getDoctypesMap()).toBe(DOCTYPES)
    })
})

describe('extract — happy path', () => {
    beforeEach(() => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ data: {} }) })
    })

    it('returns schema-ordered fields with coerced values', async () => {
        configure({
            doctypes: DOCTYPES,
            geminiCall: stubGemini({
                data: { rut: '12.345.678-9', nombres: 'Juan', apellidos: 'Pérez', fecha_nacimiento: '1980-01-15', fecha_vencimiento: '2030-05-10' },
                docdate: '2020-05-10',
            }, { prompt: 100, cand: 50 }),
        })
        const r = await extract(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(r.doctype).toBe('cedula-identidad')
        expect(r.fields.map(f => f.key)).toEqual(['rut', 'nombres', 'apellidos', 'fecha_nacimiento', 'fecha_vencimiento'])
        expect(r.fields.find(f => f.key === 'rut')?.value).toBe('12.345.678-9')
        expect(r.docdate).toBe('2020-05-10')
        expect(r.usage).toEqual({ promptTokens: 100, candidatesTokens: 50, totalTokens: 150 })
    })

    it('extractFields returns only the field array', async () => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ data: { rut: 'X' }, docdate: '2024-01-01' }) })
        const fields = await extractFields(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(Array.isArray(fields)).toBe(true)
        expect(fields.find(f => f.key === 'rut')?.value).toBe('X')
    })

    it('fills missing fields with null', async () => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ data: { rut: 'X' } }) })
        const r = await extract(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(r.fields.find(f => f.key === 'nombres')?.value).toBeNull()
        expect(r.docdate).toBeNull()
    })

    it('coerces num values from CL-formatted strings', async () => {
        configure({
            doctypes: DOCTYPES,
            geminiCall: stubGemini({ data: { empleador: 'Acme', rut: '1', periodo: '2024-06', base_imponible: '$1.234.567', haberes: [], descuentos: [] } }),
        })
        const r = await extract(Buffer.from('fake'), 'application/pdf', 'liquidaciones-sueldo')
        expect(r.fields.find(f => f.key === 'base_imponible')?.value).toBe(1234567)
    })

    it('normalizes month: YYYY-MM-DD → YYYY-MM', async () => {
        configure({
            doctypes: DOCTYPES,
            geminiCall: stubGemini({ data: { empleador: 'Acme', rut: '1', periodo: '2026-01-01', base_imponible: 100 } }),
        })
        const r = await extract(Buffer.from('fake'), 'application/pdf', 'liquidaciones-sueldo')
        expect(r.fields.find(f => f.key === 'periodo')?.value).toBe('2026-01')
    })

    it('accepts top-level data shape (no `data` wrapper)', async () => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ rut: '12.345.678-9', nombres: 'Juan' }) })
        const r = await extract(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(r.fields.find(f => f.key === 'rut')?.value).toBe('12.345.678-9')
    })

    it('strips ```json fenced blocks', async () => {
        configure({
            doctypes: DOCTYPES,
            geminiCall: async () => ({ text: '```json\n{"data":{"rut":"OK"}}\n```' }),
        })
        const r = await extract(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(r.fields.find(f => f.key === 'rut')?.value).toBe('OK')
    })

    it('recovers from trailing garbage via brace recovery', async () => {
        configure({
            doctypes: DOCTYPES,
            geminiCall: async () => ({ text: '{"data":{"rut":"OK"}} trailing junk' }),
        })
        const r = await extract(Buffer.from('fake'), 'image/png', 'cedula-identidad')
        expect(r.fields.find(f => f.key === 'rut')?.value).toBe('OK')
    })
})

describe('extract — rejections', () => {
    beforeEach(() => {
        configure({ doctypes: DOCTYPES, geminiCall: stubGemini({ data: {} }) })
    })

    it('throws on unknown doctype', async () => {
        await expect(extract(Buffer.from('x'), 'image/png', 'nope')).rejects.toThrow(/Unknown doctype/)
    })

    it('throws when doctype has no fields', async () => {
        await expect(extract(Buffer.from('x'), 'image/png', 'no-fields')).rejects.toThrow(/no fields/)
    })

    it('throws on non-JSON Gemini response', async () => {
        configure({ doctypes: DOCTYPES, geminiCall: async () => ({ text: 'totally not json' }) })
        await expect(extract(Buffer.from('x'), 'image/png', 'cedula-identidad')).rejects.toThrow(/valid JSON/)
    })
})

describe('extract — prompt assembly', () => {
    it('includes every field key with its type', async () => {
        let prompt = ''
        configure({
            doctypes: DOCTYPES,
            geminiCall: async params => {
                prompt = (params.contents[0]?.parts ?? []).find((p: any) => p.text)?.text ?? ''
                return { text: '{"data":{}}' }
            },
        })
        await extract(Buffer.from('x'), 'application/pdf', 'liquidaciones-sueldo')
        for (const f of DOCTYPES['liquidaciones-sueldo'].fields) {
            expect(prompt).toContain(f.key)
            expect(prompt).toContain(`(${f.type})`)
        }
        expect(prompt).toContain('PERÍODO')   // dateHint surfaced
        expect(prompt).toContain('{label, value}')   // per-field ai instruction
    })

    it('passes generationConfig overrides through to Gemini', async () => {
        let observed: any
        configure({
            doctypes: DOCTYPES,
            geminiCall: async params => {
                observed = params.config
                return { text: '{"data":{}}' }
            },
        })
        await extract(Buffer.from('x'), 'image/png', 'cedula-identidad', {
            generationConfig: { temperature: 0, topP: 0.1, thinkingConfig: { thinkingBudget: 1024 } },
        })
        expect(observed).toMatchObject({
            temperature: 0,
            topP: 0.1,
            thinkingConfig: { thinkingBudget: 1024 },
            responseMimeType: 'application/json',
        })
    })

    it('defaults to gemini-2.5-pro', async () => {
        let model = ''
        configure({ doctypes: DOCTYPES, geminiCall: async params => { model = params.model; return { text: '{"data":{}}' } } })
        await extract(Buffer.from('x'), 'image/png', 'cedula-identidad')
        expect(model).toBe('gemini-2.5-pro')
    })

    it('honors opts.model override', async () => {
        let model = ''
        configure({ doctypes: DOCTYPES, geminiCall: async params => { model = params.model; return { text: '{"data":{}}' } } })
        await extract(Buffer.from('x'), 'image/png', 'cedula-identidad', { model: 'gemini-2.5-flash' })
        expect(model).toBe('gemini-2.5-flash')
    })
})

describe('references slot (few-shot)', () => {
    it('injects up to 3 config-level references into the prompt', async () => {
        let prompt = ''
        configure({
            doctypes: DOCTYPES,
            references: { 'cedula-identidad': [{ rut: 'EX1' }, { rut: 'EX2' }, { rut: 'EX3' }, { rut: 'EX4' }] },
            geminiCall: async params => {
                prompt = (params.contents[0]?.parts ?? []).find((p: any) => p.text)?.text ?? ''
                return { text: '{"data":{}}' }
            },
        })
        await extract(Buffer.from('x'), 'image/png', 'cedula-identidad')
        expect(prompt).toContain('Ejemplos del formato')
        expect(prompt).toContain('"rut":"EX1"')
        expect(prompt).toContain('"rut":"EX3"')
        expect(prompt).not.toContain('"rut":"EX4"')
    })

    it('honors per-call opts.references (merged with config / doctype examples, capped at 3)', async () => {
        let prompt = ''
        const dt: DoctypesMap = {
            'cedula-identidad': {
                ...DOCTYPES['cedula-identidad'],
                examples: [{ rut: 'FROM_DT' }],
            },
        }
        configure({
            doctypes: dt,
            references: { 'cedula-identidad': [{ rut: 'FROM_CFG' }] },
            geminiCall: async params => {
                prompt = (params.contents[0]?.parts ?? []).find((p: any) => p.text)?.text ?? ''
                return { text: '{"data":{}}' }
            },
        })
        await extract(Buffer.from('x'), 'image/png', 'cedula-identidad', {
            references: [{ rut: 'FROM_OPTS' }],
        })
        expect(prompt).toContain('"rut":"FROM_CFG"')
        expect(prompt).toContain('"rut":"FROM_DT"')
        expect(prompt).toContain('"rut":"FROM_OPTS"')
    })
})

describe('extract — normalize block applied to list-row labels', () => {
    it('rewrites haberes[].label / descuentos[].label via doctype.normalize', async () => {
        const dt: DoctypesMap = {
            'liquidaciones-sueldo': {
                ...DOCTYPES['liquidaciones-sueldo'],
                normalize: {
                    'haberes[].label': {
                        stripParametric: true,
                        synonyms: [
                            { match: '^asignacion colacion$', canonical: 'Colación' },
                        ],
                    },
                    'descuentos[].label': {
                        stripParametric: true,
                        synonyms: [
                            { match: '^salud\\s*7\\s*%$', canonical: 'Cotiz. Salud Obligatoria' },
                        ],
                    },
                },
            },
        }
        configure({
            doctypes: dt,
            geminiCall: stubGemini({
                data: {
                    empleador: 'Acme',
                    rut: '1',
                    periodo: '2024-06',
                    base_imponible: 100,
                    haberes: [
                        { label: 'Asignación Colación', value: 50000 },
                        { label: 'Bono Producción (Bruto: 1.500.000)', value: 1500000 },
                    ],
                    descuentos: [
                        { label: 'Salud 7%', value: 100000 },
                    ],
                },
            }),
        })
        const r = await extract(Buffer.from('x'), 'application/pdf', 'liquidaciones-sueldo')
        const haberes = r.fields.find(f => f.key === 'haberes')?.value as Array<Record<string, unknown>>
        const descuentos = r.fields.find(f => f.key === 'descuentos')?.value as Array<Record<string, unknown>>
        expect(haberes.map(r => r.label)).toEqual(['Colación', 'Bono Producción'])
        expect(descuentos.map(r => r.label)).toEqual(['Cotiz. Salud Obligatoria'])
    })
})

describe('parseJsonLoose + normalizeDocdate (exported helpers)', () => {
    it('parseJsonLoose recovers a fenced object with surrounding text', () => {
        const r = parseJsonLoose('garbage ```json\n{"a":1}\n``` more garbage')
        expect(r).toEqual({ a: 1 })
    })
    it('normalizeDocdate keeps ISO date, rejects others', () => {
        expect(normalizeDocdate('2024-06-17')).toBe('2024-06-17')
        expect(normalizeDocdate('17/06/2024')).toBeNull()
        expect(normalizeDocdate(null)).toBeNull()
    })
})
