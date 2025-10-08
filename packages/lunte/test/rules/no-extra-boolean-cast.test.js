import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'no-extra-boolean-cast'
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

test('flags redundant double negation in fixtures', async (t) => {
  const result = await analyze({
    files: [fixture('double-negation.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-extra-boolean-cast')
})

test('allows double negation when explicitly coercing values', async (t) => {
  const result = await analyzeSnippet('const flag = !!maybe\n')
  t.is(result.diagnostics.length, 0)
})

test('flags Boolean call outside boolean context', async (t) => {
  const result = await analyzeSnippet('const flag = Boolean(value)\n')
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].message, 'Unnecessary boolean cast.')
})

test('allows Boolean call inside logical expression', async (t) => {
  const result = await analyzeSnippet('const flag = Boolean(value) && other\n')
  t.is(result.diagnostics.length, 0)
})
