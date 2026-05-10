import type { DoctypeField, ExtractedField, FieldType } from './types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH_OR_DATE = /^(\d{4}-\d{2})(-\d{2})?$/
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/

/**
 * Best-effort JSON parse with brace-matching recovery for truncated outputs.
 * Returns `null` if nothing usable can be parsed.
 */
export function parseJsonLoose(text: string): Record<string, unknown> | null {
    const cleaned = stripFences(text).trim()
    if (!cleaned) return null
    try {
        const parsed = JSON.parse(cleaned)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null
    } catch {
        let depth = 0
        let inStr = false
        let escape = false
        let start = -1
        for (let i = 0; i < cleaned.length; i++) {
            const ch = cleaned[i]
            if (escape) { escape = false; continue }
            if (ch === '\\' && inStr) { escape = true; continue }
            if (ch === '"') { inStr = !inStr; continue }
            if (inStr) continue
            if (ch === '{') {
                if (depth === 0) start = i
                depth++
            } else if (ch === '}') {
                depth--
                if (depth === 0 && start >= 0) {
                    try {
                        const obj = JSON.parse(cleaned.slice(start, i + 1))
                        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                            return obj as Record<string, unknown>
                        }
                    } catch { /* keep walking */ }
                }
            }
        }
        return null
    }
}

export const stripFences = (s: string): string => s.replace(/```json|```/g, '').trim()

/** Coerce a CL-formatted number string. Strips $/CLP/UF/spaces; `.` = thousands, `,` = decimal. */
const coerceNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(/,/g, '.')
        if (!cleaned || cleaned === '-' || cleaned === '.') return null
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : null
    }
    return null
}

const coerceString = (v: unknown): string | null => {
    if (typeof v === 'string') {
        const t = v.trim()
        return t.length > 0 ? t : null
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return null
}

const coerceBool = (v: unknown): boolean | null => {
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') {
        const t = v.trim().toLowerCase()
        if (['true', 'sí', 'si', 'yes', '1'].includes(t)) return true
        if (['false', 'no', '0'].includes(t)) return false
    }
    return null
}

const matchOrNull = (v: unknown, re: RegExp): string | null => {
    const s = coerceString(v)
    return s && re.test(s) ? s : null
}

/** Accept YYYY-MM or YYYY-MM-DD; emit canonical YYYY-MM. */
const coerceMonth = (v: unknown): string | null => {
    const s = coerceString(v)
    if (!s) return null
    const m = s.match(ISO_MONTH_OR_DATE)
    return m ? m[1] : null
}

const coerceForType = (type: FieldType | string | undefined, v: unknown): unknown => {
    if (v === null || v === undefined) return null
    switch (type) {
        case 'num':
        case 'number': return coerceNumber(v)
        case 'date': return matchOrNull(v, ISO_DATE)
        case 'month': return coerceMonth(v)
        case 'time': return matchOrNull(v, ISO_TIME)
        case 'bool': return coerceBool(v)
        case 'list': return Array.isArray(v) ? v : null
        case 'obj':
        case 'object': return v && typeof v === 'object' && !Array.isArray(v) ? v : null
        case 'string':
        default: return coerceString(v)
    }
}

export function normalizeFields(fields: DoctypeField[], data: Record<string, unknown> | null | undefined): ExtractedField[] {
    const src = data ?? {}
    return fields.map(f => ({
        key: f.key,
        type: String(f.type ?? 'string'),
        value: coerceForType(f.type, src[f.key]),
    }))
}

export function normalizeDocdate(v: unknown): string | null {
    return matchOrNull(v, ISO_DATE)
}
