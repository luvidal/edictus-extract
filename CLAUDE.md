# @jogi/extract

Lean AI-first single-doctype field extractor satellite for Jogi. One Gemini call → JSON → per-type coercion → schema-ordered field array.

## Operating memory

- Read this file before editing; it is the canonical module contract.
- Parent Jogi context lives in `../jogi`; doctypes are in `../jogi/data/doctypes.json`. Do not modify `../jogi` unless the PM explicitly asks.
- Sibling satellite `../jogi@classifier` is the structural template. Mirror its conventions; do not re-invent build, test, or harness shape.
- Keep code simple and minimal; add LOC only when necessary.

## Contract

1. **Two library entry points**: `extract(buffer, mimetype, doctype, opts?) → ExtractResult` and `extractFields(buffer, mimetype, doctype, opts?) → ExtractedField[]`. No classification, no PDF splitting, no boundary detection — the host already classified the file and tells us which doctype to extract.
2. **Host-injected dependencies**: `configure({ doctypes, geminiCall, references? })` is the only setup. The main app owns Gemini auth and passes an already-authenticated caller; do not add `geminiKey`/`apiKey` config fields, raw API-key handling, or AI SDK runtime deps to `src/`.
3. **Prompt-only contract**. No `responseSchema` — Vertex AI's structured-output silently drops nested keys not enumerated in `properties`, and doctypes.json does not declare inner row shapes. Gemini Pro is steered entirely by the prompt's per-field `ai` text + optional reference examples; types are coerced post-parse.
4. **Algorithm is frozen**. Do not add per-page calls, local OCR, PDF slicing, multi-key rotation, or "smart" retries to `src/`. If a doctype consistently mis-extracts, fix the `ai` instruction or `dateHint` in the host's `doctypes.json`, or surface a prompt change for review. **Scoped exception**: see "Liquidación lexicon" below.
5. **Runtime deps**: **none**. No `pdf-lib`, no `sharp`, no AWS, no `@google/genai` in `src/`; `@google/genai` is allowed only in manual harnesses/playground.
6. **Output shape**: `{ doctype, fields: ExtractedField[], docdate: string | null, usage? }`. `fields` is exactly the doctype's `fields` array in declared order, each row coerced to its `type`. Missing fields become `null`. `docdate` is `YYYY-MM-DD` or null.

### Liquidación lexicon

Scoped algorithm exception for `doctype === 'liquidaciones-sueldo'` **only** — every other doctype keeps the frozen-algorithm rule in clause 4.

- Entry point inside `extract()`: after `applyNormalizeBlock(normalizeFields(...), dt.normalize)`, when `doctype === 'liquidaciones-sueldo'`, the helper `rewriteLiquidacionRows` runs `classifyLiquidacionRows({ haberes, descuentos })` and rewrites those two list fields in place with `canonicalId` + `tipoRenta` / `naturaleza` / `legalType`. No other doctype path is touched; the public `ExtractResult` shape is unchanged.
- Public server-only entry: `classifyLiquidacionRows` exported from `@jogi/extract/liquidacion` (`src/liquidacion/index.ts`) — the same function `extract()` calls internally, exposed so the host's one-shot legacy `ai_fields` backfill can classify rows without re-running Gemini extraction.
- Browser-safe types subpath: `@jogi/extract/liquidacion/types` (`TipoRenta`, `Naturaleza`, `LegalType`, `ItemType`, `ClassifiedItem`, …). No runtime imports, no `@google/genai` references; safe for client-side Jogi modules to import.
- Lexicon source: `src/data/liquidacion-lexicon.yaml` (human-edited). The `prebuild` script (`tests/compile-lexicon.ts`, devDep `js-yaml`) compiles it to `src/data/liquidacion-lexicon.generated.ts` — runtime imports the generated TS only. No YAML parser ships in production deps. CI fails if the generated file diverges from the YAML.

## Code rules

- Keep `src/index.ts` focused on orchestration; prompt text lives in `src/prompt.ts`; coercion in `src/parse.ts`.
- No `@/` imports — relative paths only.
- No Sentry, no host-specific logger. If the AI call throws, let it throw — host wraps.
- Tests under `tests/`. Vitest for unit smoke (`*.test.ts`). Corpus/groundtruth harnesses are manual, not CI.

## Build

- `npm run build` — tsup ESM + CJS + types into `dist/`.
- `npm test` — Vitest smoke (no API key required).
- `npm run corpus` / `npm run groundtruth` — manual harnesses; need Gemini credentials, `JOGI_DOCTYPES`, `FIXTURES_DIR`.
- `npm run playground` — local HTML dropzone at `http://localhost:4178`.

## Evaluation notes

- Current debugging context lives in `docs/extractor-testing-notes.md`; read it before changing prompt, definitions, model, or coercion rules.
- Default model is `gemini-2.5-pro`; callers may override `opts.model` for experiments.
- Live baseline on three real prod fixtures (cedula / informe-deuda / liquidación): 23 ok / 4 mismatch / 0 missing / 1 extra. Of the 4 nominal mismatches, 2 are the lib being more correct than the legacy DB (`periodo` canonical `YYYY-MM` vs DB `YYYY-MM-01`; `institucion_previsional` MODELO vs DB FONASA).
- Known real misses (model variance on small docs): occasional `descuentos` row drop on short liquidaciones.
- Known format drift: Gemini occasionally returns dates as `DD/MM/YYYY` for `fecha_informe` despite the prompt rule — candidate for a parse-side date normalizer.

## Consumer integration

Consumed by Jogi via GitHub SHA pin (never `#main`, never `file:`):

```json
"@jogi/extract": "github:luvidal/jogi-extract#<40-char-sha>"
```

Host wiring lives in a server-only parent init (`lib/server/docsinit.ts` style): `configureExtractor({ doctypes, geminiCall })`. If the host uses `GEMINI_API_KEY` or Vertex auth, wrap it inside the host's `geminiCall`; do not pass raw secrets to this library.

## Behavior bar

- Unit tests must stay green without API credentials.
- Manual harnesses should compare against DB-stored `ai_fields` and report ok / mismatch / missing / extra counts.
- Treat the live baseline above as a floor — regressions on the three baseline fixtures block merges.
- Prefer prompt + per-doctype `ai` text changes over new code in `src/`.
