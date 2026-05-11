import type { Doctype, ResponseSchema } from './types'

const NON_FLAT_FIELD_TYPES = new Set(['list', 'array', 'obj', 'object'])

function fieldSchemaType(type: string | undefined): ResponseSchema['type'] {
    switch (type) {
        case 'num':
        case 'number':
            return 'NUMBER'
        case 'bool':
            return 'BOOLEAN'
        case 'string':
        case 'date':
        case 'month':
        case 'time':
        default:
            return 'STRING'
    }
}

export function buildResponseSchema(dt: Doctype): ResponseSchema | null {
    if (dt.fields.some(field => NON_FLAT_FIELD_TYPES.has(field.type ?? 'string'))) {
        return null
    }

    const properties: Record<string, ResponseSchema> = {}
    const required: string[] = []
    for (const field of dt.fields) {
        properties[field.key] = {
            type: fieldSchemaType(field.type),
            nullable: true,
        }
        required.push(field.key)
    }

    return {
        type: 'OBJECT',
        properties: {
            data: {
                type: 'OBJECT',
                properties,
                required,
            },
            docdate: { type: 'STRING', nullable: true },
        },
        required: ['data', 'docdate'],
    }
}
