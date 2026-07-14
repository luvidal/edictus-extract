# @edictus/extract

Lean prompt-first **single-doctype** field extractor for Chilean documents. Sibling satellite to `@edictus/classifier`: that package decides *what* the file is, this one extracts the fields once the doctype is known.

## How it works

One Gemini call sees the file and a doctype-specific prompt and returns
`{ data: { ...fields }, docdate }`. Local code only does JSON parsing (with
brace recovery for truncated outputs) and per-type coercion (number, date,
month, time, bool, list, obj). No `responseSchema` — Vertex AI's structured
output silently drops nested object keys that aren't enumerated up-front, and
doctypes.json does not declare inner row shapes.

Approximately 350 LOC of code, plus the prompt.

## Inputs / outputs

```ts
extract(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractResult>
extractFields(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractedField[]>
```

- **buffer** — PDF or image bytes.
- **mimetype** — `'application/pdf'` | `'image/jpeg'` | `'image/png'` | `'image/webp'` | `'image/heic'` | `'image/heif'`.
- **doctype** — id in the configured `doctypes` map.
- **opts.model** — defaults to `gemini-2.5-pro`.
- **opts.generationConfig** — optional Gemini overrides (`temperature`, `topP`, `seed`, `candidateCount`, `thinkingConfig`, ...).
- **opts.references** — inline few-shot examples (per-call), merged with config-level references.

Model-choice note (2026-05): keep Pro as the extraction correctness baseline for scanned/image-only PDFs and table-heavy Chilean documents, especially liquidaciones, until corpus fixtures prove otherwise. Gemini 3.5 Flash is the first replacement candidate to benchmark; Flash-Lite-class models are acceptable only for low-risk auxiliary analysis, not authoritative extraction, after prior Jogi tests dropped real payroll rows.

Each `ExtractedField` has `{ key, type, value }`; missing values are `null`. `ExtractResult` adds `docdate` (`YYYY-MM-DD` or null) and `usage` (token counts).

## Configure (host-injected)

The library has no AI SDK as a runtime dependency. The host provides the doctypes catalog and a Gemini caller:

```ts
import { configure, extract } from '@edictus/extract'
import doctypes from './data/doctypes.json'
import { geminiGenerate } from './lib/server/gemini'

configure({ doctypes, geminiCall: geminiGenerate })

const result = await extract(pdfBuffer, 'application/pdf', 'liquidaciones-sueldo')
// → { doctype, fields: [{ key: 'empleador', type: 'string', value: 'Acme' }, ...], docdate: '2024-06-30', usage }
```

The main app owns Gemini authentication. Keep API keys, Vertex credentials,
quotas, retries, logging, and auth refresh in the host's `geminiGenerate`
implementation; this package only receives the already-authenticated
`geminiCall` function.

Correct:

```ts
configure({ doctypes, geminiCall })
```

Do not add raw secrets to this package's config:

```ts
// Not supported.
configure({ doctypes, geminiCall, geminiKey })
```

`geminiCall` signature:

```ts
type GeminiCall = (params: { model: string; contents: any; config?: any }) => Promise<any>
```

The library handles JSON parsing, code-fence stripping, and per-type coercion.

## Reference output style (few-shot)

If `configure` is called with a `references` map keyed by doctype id, up to 3
examples per doctype are injected into the prompt as JSON examples of the
expected output shape (the `documents.files.ai_fields` style):

```ts
configure({
    doctypes,
    geminiCall,
    references: {
        'liquidaciones-sueldo': [
            { empleador: 'Acme SpA', rut: '12.345.678-9', periodo: '2024-06', haberes: [{ label: 'Sueldo Base', value: 800000 }] },
        ],
    },
})
```

Per-call `opts.references` and per-doctype `doctype.examples` are also
honored, with `config.references` > `doctype.examples` > `opts.references`
order; whichever fills first wins, capped at 3.

## Host transition guide

When migrating a host app from inline `Doc2Fields()` to `@edictus/extract`,
move only the single-doctype extraction prompt + coercion into this package.
Leave auth, transport, classification, PDF slicing, and post-extraction
business logic in the host:

```ts
// Host app code, not @edictus/extract/src.
import { GoogleGenAI } from '@google/genai'
import { configure as configureExtractor } from '@edictus/extract'
import doctypes from './data/doctypes.json'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const geminiCall = ({ model, contents, config }) =>
    ai.models.generateContent({ model, contents, config })

configureExtractor({ doctypes, geminiCall })
```

For Vertex AI:

```ts
const ai = new GoogleGenAI({ vertexai: true, project, location })
```

## Project layout

```
src/
  index.ts     configure + extract + extractFields + getDoctypes
  prompt.ts    buildExtractPrompt (Spanish, with references slot)
  parse.ts     parseJsonLoose + normalizeFields + normalizeDocdate
  types.ts     types
tests/
  extractor.test.ts   vitest smoke (Gemini stubbed)
  corpus.ts           manual bulk runner (real Gemini)
  groundtruth.ts      manual diff vs DB ai_fields (real Gemini)
dev/
  server.ts           HTTP playground (AI Studio or Vertex)
  index.html          browser dropzone
```

## Limits / known gaps

- **Date format drift**: Gemini occasionally returns `DD/MM/YYYY` for
  `fecha_informe`-style fields despite the prompt rule. Currently passes
  through; candidate for parse-side normalization.
- **List row dropping**: short liquidaciones sometimes lose the trailing
  `descuentos` row (`DESCTO. LEGALES` on the smallest fixture). Stable across
  re-runs with `temperature: 0` — likely a tokenization edge.
- **`month` vs DB legacy**: lib emits canonical `YYYY-MM`; DB historically
  stores `YYYY-MM-01`. Append `-01` downstream if a consumer wants the legacy
  shape.

See `docs/extractor-testing-notes.md` for the current evaluation log.
