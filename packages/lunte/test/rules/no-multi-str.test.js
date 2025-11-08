import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'no-multi-str'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function analyzeSnippet(source) {
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags multiline string with escapes', async (t) => {
  const result = await analyze({
    files: [fixture('no-multi-str-backslash-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-multi-str')
})

test('allows template literals', async (t) => {
  const result = await analyze({
    files: [fixture('no-multi-str-template-literal-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows template literals (inline)', async (t) => {
  const result = await analyzeSnippet('const message = `line1\nline2`\n')
  t.is(result.diagnostics.length, 0)
})

test('allows regular single-line strings', async (t) => {
  const result = await analyzeSnippet('const value = "hello"\n')
  t.is(result.diagnostics.length, 0)
})
