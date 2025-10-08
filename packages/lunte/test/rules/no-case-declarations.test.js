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

const RULE_ID = 'no-case-declarations'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function analyzeSnippet(source) {
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${virtualId += 1}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags lexical declarations in switch cases', async (t) => {
  const result = await analyze({
    files: [fixture('case-declaration.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.ok(result.diagnostics.length > 0)
  t.ok(result.diagnostics.every((d) => d.ruleId === 'no-case-declarations'))
})

test('allows var in switch cases', async (t) => {
  const result = await analyzeSnippet('switch (value) { case 1: var ok = true; break; }\n')
  t.is(result.diagnostics.length, 0)
})

test('allows block-scoped declarations inside block', async (t) => {
  const result = await analyzeSnippet(
    'switch (value) { case 1: { let ok = true; console.log(ok) } break; }\n'
  )
  t.is(result.diagnostics.length, 0)
})
