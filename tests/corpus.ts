/**
 * Manual corpus harness for @jogi/extract.
 *
 * Walks `FIXTURES_DIR/*.pdf`, runs `extract()` against each one (doctype
 * resolved from a sibling `groundtruth.json`), and prints a per-file summary.
 * Doesn't compare values — use `npm run groundtruth` for that. Use this when
 * you want to inspect actual extracted shapes / time / token cost across a set.
 *
 *   GEMINI_API_KEY=...   (or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION)
 *   JOGI_DOCTYPES=/path/to/doctypes.json
 *   FIXTURES_DIR=/path/with/{fileId}.pdf + groundtruth.json
 *   npm run corpus -- [--only=substr] [--model=gemini-2.5-flash]
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { GoogleGenAI } from '@google/genai'
import { configure, extract, type DoctypesMap, type GeminiCall } from '../src/index'

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

function mimetypeFor(name: string): string {
    const ext = path.extname(name).toLowerCase()
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    return 'application/octet-stream'
}

async function main(): Promise<void> {
    if (!fs.existsSync(DOCTYPES_PATH)) throw new Error(`doctypes.json missing at ${DOCTYPES_PATH}`)
    const gtPath = path.join(FIXTURES_DIR, 'groundtruth.json')
    if (!fs.existsSync(gtPath)) throw new Error(`groundtruth.json missing at ${gtPath} (corpus needs it to resolve doctypes)`)

    const doctypes = JSON.parse(fs.readFileSync(DOCTYPES_PATH, 'utf8')) as DoctypesMap
    const ground = JSON.parse(fs.readFileSync(gtPath, 'utf8')) as Record<string, { docTypeId: string }>

    configure({ doctypes, geminiCall: buildGeminiCall() })

    const totals = { files: 0, ms: 0, prompt: 0, cand: 0 }
    for (const [fileId, gt] of Object.entries(ground)) {
        if (ONLY && !fileId.includes(ONLY) && !gt.docTypeId.includes(ONLY)) continue
        const pdfPath = path.join(FIXTURES_DIR, `${fileId}.pdf`)
        if (!fs.existsSync(pdfPath)) continue
        totals.files++
        const buffer = fs.readFileSync(pdfPath)
        const t0 = Date.now()
        try {
            const r = await extract(buffer, mimetypeFor(pdfPath), gt.docTypeId, { model: MODEL })
            const ms = Date.now() - t0
            totals.ms += ms
            totals.prompt += r.usage?.promptTokens ?? 0
            totals.cand += r.usage?.candidatesTokens ?? 0
            const populated = r.fields.filter(f => f.value !== null && f.value !== undefined).length
            console.log(`${gt.docTypeId.padEnd(28)} ${fileId.slice(0, 8)}…  ${ms}ms  populated=${populated}/${r.fields.length}  docdate=${r.docdate ?? '∅'}  tokens=${r.usage?.promptTokens ?? '?'}+${r.usage?.candidatesTokens ?? '?'}`)
        } catch (err) {
            console.log(`${gt.docTypeId.padEnd(28)} ${fileId.slice(0, 8)}…  ERROR  ${err instanceof Error ? err.message : err}`)
        }
    }
    console.log(`\n${totals.files} files / ${totals.ms} ms total / ${totals.prompt}+${totals.cand} tokens`)
}

main().catch(err => { console.error(err); process.exit(1) })
