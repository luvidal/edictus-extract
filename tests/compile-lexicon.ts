/**
 * Compile `src/data/liquidacion-lexicon.yaml` → `src/data/liquidacion-lexicon.generated.ts`.
 *
 * - YAML is the human-edited source of truth; the generated TS is the
 *   runtime-loaded artifact. Runtime never imports `js-yaml`.
 * - Wired as `prebuild` so `npm run build` regenerates before tsup emits.
 * - Exits non-zero on schema violation OR on drift — i.e. when the
 *   regenerated content differs from what is already on disk (CI uses
 *   this to enforce that authors check in both files together).
 *
 * Schema validation rules (mirror the plan's *Lexicon Shape* section):
 * - `version` integer; `doctype === 'liquidaciones-sueldo'`.
 * - `itemTypes` is the enum [`income`, `deduction`].
 * - Each item has `id`, `canonical`, `itemType`, `aliases` (non-empty).
 * - `classification.tipoRenta` ∈ [`Fija`, `Variable`].
 * - `classification.naturaleza` ∈ [`Imponible`, `No imponible`, `Legal`, `Otro`].
 * - `legalType` ∈ [`afp`, `salud`, `cesantia`, `impuesto`] and ONLY when
 *   `naturaleza === 'Legal'`.
 * - No unknown keys at the item or classification level.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as yaml from 'js-yaml'

const SRC_YAML = path.resolve(__dirname, '../src/data/liquidacion-lexicon.yaml')
const OUT_TS = path.resolve(__dirname, '../src/data/liquidacion-lexicon.generated.ts')

const TIPO_RENTA = new Set(['Fija', 'Variable'])
const NATURALEZA = new Set(['Imponible', 'No imponible', 'Legal', 'Otro'])
const LEGAL_TYPE = new Set(['afp', 'salud', 'cesantia', 'impuesto'])
const ITEM_TYPE = new Set(['income', 'deduction'])

const CLASSIFICATION_KEYS = new Set(['tipoRenta', 'naturaleza', 'legalType'])
const ITEM_KEYS = new Set(['id', 'canonical', 'itemType', 'aliases', 'classification'])

function fail(msg: string): never {
    console.error(`compile-lexicon: ${msg}`)
    process.exit(1)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === 'object' && !Array.isArray(v)
}

function validateClassification(c: unknown, ctx: string): Record<string, unknown> | undefined {
    if (c === undefined) return undefined
    if (!isPlainObject(c)) fail(`${ctx}.classification must be a mapping`)
    for (const k of Object.keys(c)) {
        if (!CLASSIFICATION_KEYS.has(k)) fail(`${ctx}.classification has unknown key "${k}"`)
    }
    const { tipoRenta, naturaleza, legalType } = c as Record<string, unknown>
    if (typeof tipoRenta !== 'string' || !TIPO_RENTA.has(tipoRenta)) {
        fail(`${ctx}.classification.tipoRenta must be one of ${[...TIPO_RENTA].join(', ')}`)
    }
    if (typeof naturaleza !== 'string' || !NATURALEZA.has(naturaleza)) {
        fail(`${ctx}.classification.naturaleza must be one of ${[...NATURALEZA].join(', ')}`)
    }
    if (legalType !== undefined) {
        if (naturaleza !== 'Legal') {
            fail(`${ctx}.classification.legalType is only allowed when naturaleza === 'Legal'`)
        }
        if (typeof legalType !== 'string' || !LEGAL_TYPE.has(legalType)) {
            fail(`${ctx}.classification.legalType must be one of ${[...LEGAL_TYPE].join(', ')}`)
        }
    }
    // Stable key order: tipoRenta, naturaleza, legalType.
    const out: Record<string, unknown> = { tipoRenta, naturaleza }
    if (legalType !== undefined) out.legalType = legalType
    return out
}

function validate(doc: unknown): Record<string, unknown> {
    if (!isPlainObject(doc)) fail('top-level YAML must be a mapping')
    const { version, doctype, itemTypes, items } = doc as Record<string, unknown>
    if (typeof version !== 'number' || !Number.isInteger(version)) {
        fail('version must be an integer')
    }
    if (doctype !== 'liquidaciones-sueldo') {
        fail(`doctype must be "liquidaciones-sueldo"`)
    }
    if (!Array.isArray(itemTypes) || itemTypes.length !== 2
        || !itemTypes.every(t => typeof t === 'string' && ITEM_TYPE.has(t))) {
        fail('itemTypes must be exactly the enum [income, deduction]')
    }
    if (!Array.isArray(items) || items.length === 0) {
        fail('items must be a non-empty array')
    }
    const seenIds = new Set<string>()
    const cleanItems: Record<string, unknown>[] = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const ctx = `items[${i}]`
        if (!isPlainObject(item)) fail(`${ctx} must be a mapping`)
        for (const k of Object.keys(item)) {
            if (!ITEM_KEYS.has(k)) fail(`${ctx} has unknown key "${k}"`)
        }
        const { id, canonical, itemType, aliases, classification } = item as Record<string, unknown>
        if (typeof id !== 'string' || id.length === 0) fail(`${ctx}.id must be a non-empty string`)
        if (seenIds.has(id)) fail(`${ctx}.id duplicates earlier item: "${id}"`)
        seenIds.add(id)
        if (typeof canonical !== 'string' || canonical.length === 0) {
            fail(`${ctx}.canonical must be a non-empty string`)
        }
        if (typeof itemType !== 'string' || !ITEM_TYPE.has(itemType)) {
            fail(`${ctx}.itemType must be one of income, deduction`)
        }
        if (!Array.isArray(aliases) || aliases.length === 0
            || !aliases.every(a => typeof a === 'string' && a.length > 0)) {
            fail(`${ctx}.aliases must be a non-empty array of strings`)
        }
        const cls = validateClassification(classification, ctx)
        const cleanItem: Record<string, unknown> = {
            id,
            canonical,
            itemType,
            aliases: [...aliases],
        }
        if (cls) cleanItem.classification = cls
        cleanItems.push(cleanItem)
    }
    return {
        version,
        doctype,
        itemTypes: [...itemTypes],
        items: cleanItems,
    }
}

function emit(lexicon: Record<string, unknown>): string {
    // Stable, deterministic JSON serialization (no timestamps, no Date.now()).
    const body = JSON.stringify(lexicon, null, 4)
    return [
        '/**',
        ' * AUTO-GENERATED by `tests/compile-lexicon.ts` from',
        ' * `src/data/liquidacion-lexicon.yaml`. Do not hand-edit; run',
        ' * `npm run build` (which runs `prebuild`) to regenerate.',
        ' */',
        '',
        `import type { Lexicon } from '../liquidacion/types'`,
        '',
        `export const LEXICON: Lexicon = ${body} as const as Lexicon`,
        '',
    ].join('\n')
}

function main(): void {
    if (!fs.existsSync(SRC_YAML)) fail(`source not found: ${SRC_YAML}`)
    const raw = fs.readFileSync(SRC_YAML, 'utf8')
    const parsed = yaml.load(raw)
    const validated = validate(parsed)
    const next = emit(validated)
    const prev = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, 'utf8') : null
    if (prev !== null && prev === next) {
        // Up to date — nothing to write, no drift.
        return
    }
    if (process.env.CI === '1' && prev !== null) {
        fail(
            `generated lexicon is out of sync with YAML\n` +
            `  run \`npm run build\` (or \`tsx tests/compile-lexicon.ts\`) and commit ${OUT_TS}`,
        )
    }
    fs.writeFileSync(OUT_TS, next, 'utf8')
}

main()
