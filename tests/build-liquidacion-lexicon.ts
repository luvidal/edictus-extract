/**
 * Manual lexicon-growth harness for `liquidaciones-sueldo`.
 *
 * Reads anonymized JSONL exported by the Jogi-side
 * `scripts/export-liquidacion-corpus.ts` and emits a proposed YAML patch
 * (sequence of `- id: ...` items in the lexicon shape) that a human triages
 * and pastes into `src/data/liquidacion-lexicon.yaml`. Production never
 * auto-edits the YAML; this script is offline tooling.
 *
 * Pipeline (per *Corpus Build* in
 * `~/GitHub/jogi/docs/plans/extract-liquidacion-lexicon.md`):
 *  1. Load JSONL clusters.
 *  2. Group by `{ section, normalizedLabel }`.
 *  3. For each cluster, run the satellite's deterministic matcher. A hit on
 *     an existing alias → already covered, skip.
 *  4. For unresolved clusters, optionally call the Gemini arbiter
 *     (`arbitrate(...)` in `src/liquidacion/lexicon.ts`). The arbiter already
 *     enforces section compatibility. `--no-arbiter` skips Gemini entirely
 *     and emits raw cluster summaries for manual triage.
 *  5. Emit a YAML patch to stdout (or `--out`).
 *
 *   GEMINI_API_KEY=... (or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION)
 *   tsx tests/build-liquidacion-lexicon.ts --in <jsonl> [--out path] [--no-arbiter] [--limit N]
 *
 * Not a vitest test — naming intentionally lacks `*.test.ts` suffix to stay
 * out of `npm test`, matching the convention of `tests/corpus.ts` and
 * `tests/groundtruth.ts`.
 */

import 'dotenv/config'
import * as fs from 'node:fs'
import * as yaml from 'js-yaml'
import { GoogleGenAI } from '@google/genai'
import { configure, type DoctypesMap, type GeminiCall } from '../src/index'
import { normalizeLabel } from '../src/normalize'
import { LEXICON } from '../src/data/liquidacion-lexicon.generated'
import { arbitrate, buildAliasIndex } from '../src/liquidacion/lexicon'
import type {
    ItemClassification,
    ItemType,
    LexiconItem,
} from '../src/liquidacion/types'

interface InputCluster {
    section: 'haberes' | 'descuentos'
    rawLabel: string
    normalizedLabel: string
    count: number
    rawVariants?: string[]
    employerCount?: number
    periodCount?: number
    valueBucket?: string
    neighborLabels?: string[]
}

interface CliArgs {
    inPath: string | null
    outPath: string | null
    noArbiter: boolean
    limit: number | null
}

function parseArgs(argv: string[]): CliArgs {
    let inPath: string | null = null
    let outPath: string | null = null
    let noArbiter = false
    let limit: number | null = null
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--in') {
            inPath = argv[++i] ?? null
        } else if (arg === '--out') {
            outPath = argv[++i] ?? null
        } else if (arg === '--no-arbiter') {
            noArbiter = true
        } else if (arg === '--limit') {
            const n = Number(argv[++i])
            if (!Number.isFinite(n) || n <= 0) {
                console.error('Invalid --limit value')
                process.exit(1)
            }
            limit = Math.floor(n)
        } else if (arg === '--help' || arg === '-h') {
            console.error(USAGE)
            process.exit(0)
        } else if (!arg.startsWith('--') && !inPath) {
            // Positional input path.
            inPath = arg
        } else {
            console.error(`Unknown argument: ${arg}`)
            process.exit(1)
        }
    }
    if (!inPath) {
        console.error('Missing --in <path>')
        console.error(USAGE)
        process.exit(1)
    }
    return { inPath, outPath, noArbiter, limit }
}

const USAGE =
    'Usage: tsx tests/build-liquidacion-lexicon.ts --in <jsonl> [--out path] [--no-arbiter] [--limit N]'

function buildGeminiCall(): GeminiCall {
    const apiKey = process.env.GEMINI_API_KEY
    const project = process.env.GOOGLE_CLOUD_PROJECT
    const location = process.env.GOOGLE_CLOUD_LOCATION
    const ai = apiKey
        ? new GoogleGenAI({ apiKey })
        : project && location
            ? new GoogleGenAI({ vertexai: true, project, location } as never)
            : null
    if (!ai) {
        throw new Error(
            'Set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION, or pass --no-arbiter',
        )
    }
    return ({ model, contents, config }) =>
        ai.models.generateContent({ model, contents, config })
}

function readJsonl(path: string): InputCluster[] {
    if (!fs.existsSync(path)) {
        console.error(`input file not found: ${path}`)
        process.exit(1)
    }
    const text = fs.readFileSync(path, 'utf8')
    const out: InputCluster[] = []
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue
        try {
            const parsed = JSON.parse(line) as Partial<InputCluster>
            if (
                (parsed.section === 'haberes' || parsed.section === 'descuentos') &&
                typeof parsed.normalizedLabel === 'string' &&
                typeof parsed.rawLabel === 'string' &&
                typeof parsed.count === 'number'
            ) {
                out.push(parsed as InputCluster)
            }
        } catch {
            // Skip malformed lines silently — corpus may grow incrementally.
        }
    }
    return out
}

interface MergedCluster {
    section: 'haberes' | 'descuentos'
    normalizedLabel: string
    rawLabel: string
    count: number
    rawVariants: string[]
    employerCount: number
    periodCount: number
    valueBucket: string
    neighborLabels: string[]
}

/** Group inputs by `{ section, normalizedLabel }` — same key the matcher uses. */
function mergeClusters(rows: InputCluster[]): MergedCluster[] {
    const map = new Map<string, MergedCluster>()
    for (const r of rows) {
        const key = `${r.section}::${r.normalizedLabel}`
        const existing = map.get(key)
        if (!existing) {
            map.set(key, {
                section: r.section,
                normalizedLabel: r.normalizedLabel,
                rawLabel: r.rawLabel,
                count: r.count,
                rawVariants: [...(r.rawVariants ?? [r.rawLabel])],
                employerCount: r.employerCount ?? 0,
                periodCount: r.periodCount ?? 0,
                valueBucket: r.valueBucket ?? 'unknown',
                neighborLabels: [...(r.neighborLabels ?? [])],
            })
            continue
        }
        existing.count += r.count
        existing.employerCount += r.employerCount ?? 0
        existing.periodCount += r.periodCount ?? 0
        for (const v of r.rawVariants ?? [r.rawLabel]) {
            if (!existing.rawVariants.includes(v)) existing.rawVariants.push(v)
        }
        for (const n of r.neighborLabels ?? []) {
            if (!existing.neighborLabels.includes(n)) existing.neighborLabels.push(n)
        }
        if (r.count > existing.count / 2) existing.rawLabel = r.rawLabel
    }
    return [...map.values()].sort(
        (a, b) =>
            a.section.localeCompare(b.section) ||
            b.count - a.count ||
            a.normalizedLabel.localeCompare(b.normalizedLabel),
    )
}

const SECTION_TO_ITEM_TYPE: Record<'haberes' | 'descuentos', ItemType> = {
    haberes: 'income',
    descuentos: 'deduction',
}

/** Build a single-pass alias index keyed `${itemType}::${normalizedAlias}`. */
function buildLookup(): Set<string> {
    const idx = buildAliasIndex(LEXICON)
    const out = new Set<string>()
    for (const [itemType, bucket] of Object.entries(idx) as Array<[
        ItemType,
        Map<string, LexiconItem>,
    ]>) {
        for (const key of bucket.keys()) {
            out.add(`${itemType}::${key}`)
        }
    }
    return out
}

function isCovered(cluster: MergedCluster, lookup: Set<string>): boolean {
    const itemType = SECTION_TO_ITEM_TYPE[cluster.section]
    // The lookup index already stores `normalizeLabel(alias)` keys; the
    // input cluster's `normalizedLabel` should be the same form. Run
    // `normalizeLabel` once more as a belt-and-suspenders defense against an
    // older exporter that emitted a different normalization.
    const key = normalizeLabel(cluster.normalizedLabel, false)
    return lookup.has(`${itemType}::${key}`)
}

interface ProposedItem {
    cluster: MergedCluster
    /** Suggested `id` slug, derived from the most common raw label. */
    id: string
    /** Suggested `canonical` display label. */
    canonical: string
    /** `income` or `deduction` based on the cluster's section. */
    itemType: ItemType
    /** Initial aliases — all observed raw variants. Reviewer can prune. */
    aliases: string[]
    /** Arbiter-suggested classification, when the arbiter returned new_item. */
    classification: ItemClassification | null
    /** Free-form notes for the reviewer — neighbor labels, value bucket, etc. */
    notes: string
}

function slugify(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'unknown'
}

function buildProposed(
    cluster: MergedCluster,
    classification: ItemClassification | null,
    canonicalHint: string | null,
): ProposedItem {
    const canonical = canonicalHint ?? cluster.rawLabel
    return {
        cluster,
        id: slugify(canonical),
        canonical,
        itemType: SECTION_TO_ITEM_TYPE[cluster.section],
        aliases: [...new Set([cluster.rawLabel, ...cluster.rawVariants])].slice(0, 10),
        classification,
        notes: [
            `count=${cluster.count}`,
            `employers=${cluster.employerCount}`,
            `periods=${cluster.periodCount}`,
            `valueBucket=${cluster.valueBucket}`,
            cluster.neighborLabels.length
                ? `neighbors=${cluster.neighborLabels.slice(0, 3).join(' | ')}`
                : '',
        ]
            .filter(Boolean)
            .join(' '),
    }
}

/**
 * Serialize a single proposed item as a YAML block prefixed with a provenance
 * comment so a reviewer can see the cluster it came from. We hand-emit the
 * block instead of letting `yaml.dump` handle the whole list because we want
 * the per-item comment header — `js-yaml` doesn't preserve comments.
 */
function emitProposedItem(p: ProposedItem): string {
    const header =
        `  # proposed from cluster: ${p.cluster.normalizedLabel} ` +
        `(count=${p.cluster.count}, employers=${p.cluster.employerCount}, periods=${p.cluster.periodCount})\n` +
        `  # context: ${p.notes}\n`
    const body: Record<string, unknown> = {
        id: p.id,
        canonical: p.canonical,
        itemType: p.itemType,
        aliases: p.aliases,
    }
    if (p.classification) {
        const cls: Record<string, unknown> = {
            tipoRenta: p.classification.tipoRenta,
            naturaleza: p.classification.naturaleza,
        }
        if (p.classification.legalType) cls.legalType = p.classification.legalType
        body.classification = cls
    }
    // `yaml.dump` emits a top-level mapping; we want it as a list item with
    // `-` prefix so it pastes into the YAML's `items:` list. Two-space indent
    // matches `liquidacion-lexicon.yaml`.
    const dumped = yaml
        .dump(body, { lineWidth: 120, noRefs: true, sortKeys: false })
        .split('\n')
        .filter(Boolean)
        .map((line, i) => (i === 0 ? `  - ${line}` : `    ${line}`))
        .join('\n')
    return header + dumped + '\n'
}

interface Summary {
    seen: number
    covered: number
    proposed: number
    arbiterCalls: number
}

async function processClusters(
    clusters: MergedCluster[],
    lookup: Set<string>,
    noArbiter: boolean,
    summary: Summary,
): Promise<ProposedItem[]> {
    const proposed: ProposedItem[] = []
    for (const cluster of clusters) {
        summary.seen++
        if (isCovered(cluster, lookup)) {
            summary.covered++
            continue
        }
        if (noArbiter) {
            proposed.push(buildProposed(cluster, null, null))
            summary.proposed++
            continue
        }
        summary.arbiterCalls++
        const result = await arbitrate({
            section: cluster.section,
            rawLabel: cluster.rawLabel,
            normalizedLabel: cluster.normalizedLabel,
        })
        if (result && result.kind === 'known') {
            // Arbiter recognized this as an existing concept — already covered
            // semantically, no new lexicon item needed.
            summary.covered++
            continue
        }
        const classification = result?.kind === 'new_item' ? result.classification : null
        const canonical = result?.kind === 'new_item' ? result.proposedCanonical : null
        proposed.push(buildProposed(cluster, classification, canonical))
        summary.proposed++
    }
    return proposed
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv)
    const inPath = args.inPath as string
    const rows = readJsonl(inPath)
    if (!rows.length) {
        console.error(`no clusters found in ${inPath}`)
        process.exit(1)
    }

    if (!args.noArbiter) {
        // The arbiter pulls its `geminiCall` from `configure(...)`; doctypes
        // is irrelevant here (we don't call `extract()`), so an empty map is
        // fine.
        configure({
            doctypes: {} as DoctypesMap,
            geminiCall: buildGeminiCall(),
        })
    }

    const clusters = mergeClusters(rows)
    const limited = args.limit ? clusters.slice(0, args.limit) : clusters
    const lookup = buildLookup()

    const summary: Summary = { seen: 0, covered: 0, proposed: 0, arbiterCalls: 0 }
    const proposed = await processClusters(limited, lookup, args.noArbiter, summary)

    const body = proposed.length
        ? `# Proposed liquidacion-lexicon patch — review and paste into\n` +
          `# src/data/liquidacion-lexicon.yaml under \`items:\` after triage.\n` +
          proposed.map(emitProposedItem).join('\n')
        : '# No new clusters — every input was already covered by the lexicon.\n'

    if (args.outPath) {
        fs.writeFileSync(args.outPath, body, 'utf8')
        console.error(`wrote ${proposed.length} proposed items to ${args.outPath}`)
    } else {
        process.stdout.write(body)
    }

    console.error(
        `${summary.seen} clusters seen, ${summary.covered} already covered, ` +
            `${summary.proposed} proposed, ${summary.arbiterCalls} needed arbiter`,
    )
}

main().catch(err => {
    console.error(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
    process.exit(1)
})
