/**
 * Compare @jogi/extract against DB-stored `ai_fields` ground truth.
 *
 *   GEMINI_API_KEY=...   (or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION)
 *   JOGI_DOCTYPES=/path/to/doctypes.json
 *   FIXTURES_DIR=/path/with/{fileId}.pdf + groundtruth.json
 *   npm run groundtruth -- [--only=substr] [--model=gemini-2.5-flash]
 *
 * groundtruth.json shape:
 *   { "<fileId>": { "docTypeId": "...", "docdate": "YYYY-MM-DD"|null, "aiFields": {...} | "<jsonString>" } }
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { GoogleGenAI } from '@google/genai'
import { configure, extract, type DoctypesMap, type GeminiCall, type ExtractedField } from '../src/index'

const DOCTYPES_PATH = process.env.JOGI_DOCTYPES || '/Users/avd/GitHub/jogi/data/doctypes.json'
const FIXTURES_DIR = process.env.FIXTURES_DIR || '/Users/avd/GitHub/jogi@extract/out/fixtures'

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--')) {
        const [k, v] = arg.slice(2).split('=')
        args.set(k, v ?? process.argv[++i] ?? '')
    }
}
const ONLY = args.get('only') ?? ''
const MODEL = args.get('model')

function buildGeminiCall(): GeminiCall {
    const apiKey = process.env.GEMINI_API_KEY
    const project = process.env.GOOGLE_CLOUD_PROJECT
    const location = process.env.GOOGLE_CLOUD_LOCATION
    const ai = apiKey
        ? new GoogleGenAI({ apiKey })
        : (project && location ? new GoogleGenAI({ vertexai: true, project, location } as any) : null)
    if (!ai) throw new Error('Set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION')
    return ({ model, contents, config }) => ai.models.generateContent({ model, contents, config })
}

interface GroundTruth {
    docTypeId: string
    docdate: string | null
    aiFields: Record<string, unknown> | string
}

function mimetypeFor(name: string): string {
    const ext = path.extname(name).toLowerCase()
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    return 'application/octet-stream'
}

function equiv(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a === 'number' && typeof b === 'string') return a === Number(b.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(/,/g, '.'))
    if (typeof a === 'string' && typeof b === 'number') return equiv(b, a)
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length
    return normalize(a) === normalize(b)
}

function normalize(v: unknown): string {
    return JSON.stringify(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function fmt(v: unknown): string {
    if (v === null || v === undefined) return '∅'
    if (typeof v === 'string') return JSON.stringify(v)
    if (Array.isArray(v)) return `[${v.length} items]`
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
    return String(v)
}

async function main(): Promise<void> {
    if (!fs.existsSync(DOCTYPES_PATH)) throw new Error(`doctypes.json missing at ${DOCTYPES_PATH}`)
    const gtPath = path.join(FIXTURES_DIR, 'groundtruth.json')
    if (!fs.existsSync(gtPath)) throw new Error(`groundtruth.json missing at ${gtPath}`)

    const doctypes = JSON.parse(fs.readFileSync(DOCTYPES_PATH, 'utf8')) as DoctypesMap
    const ground = JSON.parse(fs.readFileSync(gtPath, 'utf8')) as Record<string, GroundTruth>

    configure({ doctypes, geminiCall: buildGeminiCall() })

    console.log(`model: ${MODEL ?? 'gemini-2.5-pro'}`)
    console.log(`fixtures: ${FIXTURES_DIR}`)
    console.log(`doctypes: ${DOCTYPES_PATH}`)
    console.log(`cases: ${Object.keys(ground).length}${ONLY ? ` (filter: ${ONLY})` : ''}`)

    const totals = { ok: 0, mismatch: 0, missing: 0, extra: 0, ms: 0, files: 0 }
    for (const [fileId, gt] of Object.entries(ground)) {
        if (ONLY && !fileId.includes(ONLY) && !gt.docTypeId.includes(ONLY)) continue
        const pdfPath = path.join(FIXTURES_DIR, `${fileId}.pdf`)
        if (!fs.existsSync(pdfPath)) {
            console.log(`\n=== ${gt.docTypeId} (${fileId}) — MISSING FIXTURE ${pdfPath} ===`)
            continue
        }
        totals.files++
        const buffer = fs.readFileSync(pdfPath)
        const t0 = Date.now()
        try {
            const r = await extract(buffer, mimetypeFor(pdfPath), gt.docTypeId, { model: MODEL })
            const ms = Date.now() - t0
            totals.ms += ms
            const truthMap = (typeof gt.aiFields === 'string' ? JSON.parse(gt.aiFields) : gt.aiFields) as Record<string, unknown>
            const truthKeys = new Set(Object.keys(truthMap))

            console.log(`\n=== ${gt.docTypeId} (${fileId}) — ${ms} ms ===`)
            console.log(`docdate: extracted=${r.docdate ?? '∅'}  truth=${gt.docdate ?? '∅'}  ${equiv(r.docdate, gt.docdate) ? '✓' : '✗'}`)

            for (const f of r.fields as ExtractedField[]) {
                const expected = truthMap[f.key]
                const hasExpected = truthKeys.has(f.key)
                if (!hasExpected && (f.value === null || f.value === undefined)) continue
                const mark = !hasExpected ? '✗ extra' : f.value == null ? '✗ missing' : equiv(expected, f.value) ? '✓' : '✗ mismatch'
                if (mark === '✓') totals.ok++
                else if (mark.includes('extra')) totals.extra++
                else if (mark.includes('missing')) totals.missing++
                else totals.mismatch++
                if (mark !== '✓') console.log(`  ${mark.padEnd(11)} ${f.key.padEnd(22)} extracted=${fmt(f.value).padEnd(36)}  truth=${fmt(hasExpected ? expected : '(not in truth)')}`)
            }
            if (r.usage) console.log(`tokens: prompt=${r.usage.promptTokens ?? '?'} candidates=${r.usage.candidatesTokens ?? '?'} total=${r.usage.totalTokens ?? '?'}`)
        } catch (err) {
            console.log(`\n=== ${gt.docTypeId} (${fileId}) — ERROR ===`)
            console.log(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
        }
    }
    console.log(`\n=== TOTAL — ${totals.files} files / ${totals.ms} ms ===`)
    console.log(`ok=${totals.ok} mismatch=${totals.mismatch} missing=${totals.missing} extra=${totals.extra}`)
}

main().catch(err => { console.error(err); process.exit(1) })
