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

const RULE_ID = 'no-return-assign'
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

test('flags assignment in return statements', async (t) => {
  const result = await analyze({
    files: [fixture('return-assign-bad.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-return-assign')
})

test('allows parenthesised assignment in return', async (t) => {
  const result = await analyze({
    files: [fixture('return-assign-good.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('flags assignment in arrow function returns', async (t) => {
  const result = await analyzeSnippet('const fn = () => { return foo = bar }\n')
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-return-assign')
})

test('allows parenthesised assignment with whitespace', async (t) => {
  const result = await analyzeSnippet('function demo () { return (foo = bar) }\n')
  t.is(result.diagnostics.length, 0)
})
