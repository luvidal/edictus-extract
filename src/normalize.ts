/**
 * Label normalization — two-job pipeline.
 *
 * Job 1 (generic, in code): strip parametric tails, lowercase, accent-fold,
 * collapse punctuation/whitespace. Doctype-agnostic, runs on every targeted
 * field.
 *
 * Job 2 (synonym resolution, from doctypes.json config): an ordered list of
 * `{match, canonical}` rules evaluated against the Job-1 output. All patterns
 * MUST be anchored (`^…$`); first match wins. A label that matches no rule
 * passes through with only Job-1 cleanup applied.
 *
 * Replaces the consumer-side stop-gap at
 * `app/reports/situacion/helpers/synonyms.ts` — same behavior, now owned by
 * the satellite.
 */

export interface NormalizeRule {
    /** Regex pattern (string) run against the Job-1-normalized label. MUST be anchored. */
    match: string
    /** Display string — properly cased + accented; becomes the row label downstream. */
    canonical: string
}

export interface NormalizeFieldConfig {
    /** If true, strip parametric tails before lowercasing/accent-folding. Default: false. */
    stripParametric?: boolean
    /** Ordered synonym list, evaluated top-to-bottom on the Job-1-normalized label. */
    synonyms?: NormalizeRule[]
}

export interface NormalizedLabel {
    /** Normalized form — used as the downstream dedup/grouping key. */
    key: string
    /** Display label — the matched canonical, or the original-cased stripped label. */
    display: string
}

/** Trailing `(…)` parenthetical, `:N UNIT` suffix, trailing colons/whitespace. */
export const stripParametricTail = (label: string): string =>
    label
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/\s*:\s*[\d.,]+\s*[A-Za-z%]{0,3}\s*$/, '')
        .replace(/[:\s]+$/, '')
        .trim()

const stripAccents = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Job 1 — generic cleanup. Lowercase, accent-fold, drop punctuation (so
 * `Cotiz.` and `Cotiz` collapse), collapse whitespace. Optionally strips the
 * parametric tail first.
 */
export const normalizeLabel = (label: string, stripParametric = false): string => {
    const stripped = stripParametric ? stripParametricTail(label) : label
    return stripAccents(stripped.toLowerCase())
        .replace(/[^\w\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Resolve a raw label against a `NormalizeFieldConfig`. Returns the dedup key
 * + the display string. Pass-through when no synonym matches: key = Job-1
 * normalized, display = parametric-stripped (cased preserved) raw label.
 */
export const resolveLabel = (
    rawLabel: string,
    config: NormalizeFieldConfig = {},
): NormalizedLabel => {
    const stripParametric = config.stripParametric === true
    const key = normalizeLabel(rawLabel, stripParametric)
    for (const rule of config.synonyms ?? []) {
        if (new RegExp(rule.match).test(key)) {
            return { key: normalizeLabel(rule.canonical, false), display: rule.canonical }
        }
    }
    const display = stripParametric ? stripParametricTail(rawLabel) : rawLabel
    return { key, display }
}

/**
 * Throws if any `match` pattern in any field config is unanchored. Use at
 * config-load time (tests at minimum) to enforce the plan's anchoring rule.
 */
export const validateNormalizeConfig = (
    block: Record<string, NormalizeFieldConfig> | null | undefined,
): void => {
    if (!block) return
    for (const [field, cfg] of Object.entries(block)) {
        for (const rule of cfg.synonyms ?? []) {
            if (!rule.match.startsWith('^') || !rule.match.endsWith('$')) {
                throw new Error(
                    `@jogi/extract: normalize rule for "${field}" is not anchored: ${rule.match}`,
                )
            }
        }
    }
}
