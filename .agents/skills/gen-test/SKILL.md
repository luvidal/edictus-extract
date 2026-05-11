---
name: gen-test
description: Generate vitest tests for a module following project conventions
disable-model-invocation: true
---

# Generate Tests

Generate unit tests for the specified module.

## Conventions

- Test location: `tests/` directory
- File naming: `<module>.test.ts`
- Framework: `vitest` (no DOM env — pure Node)
- Imports: relative paths (`../src/...`), no `@/` aliases
- Stub the host-injected `geminiCall` with a fixture function — the library has no AI SDK runtime dependency so there is nothing to mock at the network layer
- Prefer small JSON fixtures over live Gemini calls; manual corpus and groundtruth harnesses are not CI

```typescript
import { describe, it, expect } from 'vitest'
import { extract, configure, type GeminiCall } from '../src/index'

function stubGemini(data: Record<string, unknown>): GeminiCall {
  return async () => ({ text: JSON.stringify({ data, docdate: null }) })
}
```

## Workflow

1. Read the target file to understand exports and behavior
2. If a test file exists, add missing cases rather than rewriting
3. Cover: happy path per export, fenced code stripping, loose JSON recovery, field ordering, type coercion, missing-field nulls, references, and usage parsing
4. Run `npm test` to verify
5. Fix failures
