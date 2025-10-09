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

const RULE_ID = 'no-debugger'
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

test('flags debugger statements in fixtures', async (t) => {
  const result = await analyze({
    files: [fixture('has-debugger.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-debugger')
})

test('does not flag code without debugger', async (t) => {
  const result = await analyzeSnippet('console.log("debugger")\n')
  t.is(result.diagnostics.length, 0)
})

test('flags debugger inside nested block', async (t) => {
  const result = await analyzeSnippet('if (true) { debugger; }\n')
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-debugger')
})
