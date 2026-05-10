# Extractor testing notes

Active eval log. Append as you run sweeps or change the prompt / coercion rules.

## Baseline (2026-05-10)

Three real prod fixtures pulled from S3, ground truth = DB `ai_fields`:

| Fixture | doctype | ok | mismatch | missing | extra | notes |
| --- | --- | --: | --: | --: | --: | --- |
| `a5837e9d-…` | cedula-identidad | 6 | 0 | 0 | 1 | extra: `fecha_vencimiento` — valid, DB just didn't capture |
| `ac563362-…` | informe-deuda | 7 | 1 | 0 | 0 | `fecha_informe` returned as `DD/MM/YYYY` instead of ISO |
| `c3f292a5-…` | liquidaciones-sueldo | 10 | 3 | 0 | 0 | `periodo` canonical `YYYY-MM` ≠ DB `YYYY-MM-01`; `institucion_previsional` MODELO ≠ DB FONASA (DB wrong); `descuentos` 4 vs 5 rows |

**Total: 23 ok / 4 mismatch / 0 missing / 1 extra**. Token cost ~1k prompt + ~300-900 candidate per doc, ~12-17s wall time on Gemini Pro.

## Open issues (divide & conquer candidates)

1. **`fecha_informe` date format drift** — Gemini emits `DD/MM/YYYY` despite the prompt rule. Likely fix: parse-side `date` normalizer that converts common CL formats to ISO, OR a stronger per-field `ai` instruction in `doctypes.json`.
2. **Last descuento row dropped on short liquidación** — stable miss, suggests a tokenization or prompt-emphasis issue on tight payloads. Try splitting the haberes/descuentos extraction into a separate prompt section?
3. **`base_tributable` was missing under v2 schema** — fixed by dropping `responseSchema`. Sanity check: any other Pass-2 doctype fields that the legacy `@jogi/docs` schema constrained are now flowing through?
4. **`docdate` for cedula** — extractor picks `fecha_vencimiento`; DB stores `fecha_emision`. Cedula doctype has no `dateHint`. Decide canonical date and pin via `dateHint`.
5. **Carpeta tributaria / DAI / boletas-sii** — not yet in the baseline. Need fixtures for the multi-instance & container doctypes; ground truth diff likely needs a tolerance mode (per-period array length / per-code value).
6. **Cedula back-side MRZ RUT** — currently not extracted on back-only PDFs. The doctype's per-field `ai` says "Si aparece en ambos lados, cópialo del frente", which biases against the back-only case. Consider relaxing or splitting front/back prompts.

## Manual harness pointers

- `FIXTURES_DIR=/Users/avd/GitHub/jogi/sandbox/claude/dev/fixtures` (PII — gitignored over there).
- `JOGI_DOCTYPES=/Users/avd/GitHub/jogi/data/doctypes.json`.
- Auth: either `GEMINI_API_KEY` (AI Studio, sandbox key restricted to Generative Language API) or `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` (Vertex via ADC).
