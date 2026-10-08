# @edictus/extract

Prompt-first field extractor for Chilean documents: payslips, tax folders, CMF
debt reports, bank statements and more. Given a file and its document type, one
Gemini call returns typed fields.

It is the second step after the classifier in
[`edictus-document-ai`](https://github.com/luvidal/edictus-document-ai): the
classifier decides *what* a file is, and this package reads it.

## Highlights

- **One model call per document.** Local code does the rest:
  - loose JSON parsing that recovers truncated output;
  - per-type coercion (number, date, month, time, bool, list, object).

  That is about 350 lines plus the prompt.
- **No `responseSchema`, on purpose.** Vertex AI structured output silently
  drops nested keys that aren't declared up front, and row shapes vary between
  documents.
- **Few-shot by configuration.** Up to 3 reference outputs per document type
  steer the format without code changes.
- **Payslip lexicon** (`@edictus/extract/liquidacion`). A deterministic matcher
  maps raw payslip labels to canonical items:
  - accent, case and punctuation variants collapse (`Asignacion Colacion` → `Colación`);
  - income items only resolve under earnings, and deductions only under deductions;
  - when two lines claim the same item in the same month, one wins and the
    other stays unmatched.

  The source of truth is a human-edited YAML file compiled at build time.
- **Host-injected AI.** There is no SDK at runtime: the host passes an
  authenticated `geminiCall` and keeps keys, quotas and retries.
- **95 tests** (Vitest, with Gemini stubbed). Manual corpus and ground-truth
  harnesses run against real documents that are kept out of the repo.

## Install

```bash
npm i github:luvidal/edictus-extract#<commit-sha>
```

## Usage

```ts
import { GoogleGenAI } from '@google/genai'
import { configure, extract } from '@edictus/extract'
import doctypes from './doctypes.json'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
// For Vertex AI: new GoogleGenAI({ vertexai: true, project, location })

configure({
  doctypes,
  geminiCall: ({ model, contents, config }) => ai.models.generateContent({ model, contents, config }),
})

const result = await extract(pdfBuffer, 'application/pdf', 'liquidaciones-sueldo')
// → { doctype, fields: [{ key: 'empleador', type: 'string', value: 'Acme SpA' }, …], docdate: '2024-06-30', usage }
```

The document-type catalog lives in
[`edictus-document-ai/packages/doctypes`](https://github.com/luvidal/edictus-document-ai/tree/main/packages/doctypes).

## API

```ts
extract(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractResult>
extractFields(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractedField[]>
```

- **`buffer` and `mimetype`**: PDF or image bytes. Accepted types are
  `application/pdf` and `image/jpeg`, `png`, `webp`, `heic` and `heif`.
- **`doctype`**: an id from the configured catalog.
- **`opts.model`**: defaults to `gemini-2.5-pro`.
- **`opts.generationConfig`**: optional Gemini overrides (`temperature`, `topP`,
  `seed`, `thinkingConfig`, …).
- **`opts.references`**: per-call few-shot examples.

Each `ExtractedField` is `{ key, type, value }`, and missing values are `null`.
`ExtractResult` adds `docdate` (`YYYY-MM-DD` or `null`) and `usage` (token
counts).

### Few-shot references

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

References are picked in this order until 3 are filled: `configure` references,
then the catalog's own `examples`, then per-call `opts.references`.

## Model choice and known gaps

- **Model.** Gemini Pro is the correctness baseline for scanned PDFs and
  table-heavy payslips. Lighter models dropped payroll rows in production
  tests, so they are only used for low-risk auxiliary analysis.
- **Date drift.** The model occasionally returns `DD/MM/YYYY` for some date
  fields despite the prompt rule.
- **Short payslips** sometimes lose their last deduction row. This is stable
  across re-runs at `temperature: 0`.

The evaluation log is in
[`docs/extractor-testing-notes.md`](docs/extractor-testing-notes.md).

## Development

```bash
npm test             # Vitest, Gemini stubbed
npm run build        # compiles the lexicon, then tsup → dist/
npm run playground   # local browser dropzone (needs Gemini credentials)
npm run corpus       # manual run over a local corpus
npm run groundtruth  # manual comparison against reviewed outputs
```
