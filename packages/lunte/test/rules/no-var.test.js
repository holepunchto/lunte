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

const RULE_ID = 'no-var'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function analyzeSnippet(source, overrides = BASE_OVERRIDES) {
  const filePath = join(__dirname, `__virtual__/no-var-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: overrides,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags var declarations', async (t) => {
  const result = await analyze({
    files: [fixture('no-var-declaration-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-var')
})

test('flags var in for loop initialiser', async (t) => {
  const result = await analyzeSnippet(
    'for (var i = 0; i < 1; i++) { use(i) }\nfunction use () {}\n'
  )
  const noVarDiagnostics = result.diagnostics.filter((d) => d.ruleId === 'no-var')
  t.is(noVarDiagnostics.length, 1)
  t.is(noVarDiagnostics[0].ruleId, 'no-var')
  t.is(result.diagnostics.length, 1)
})

test('allows let and const declarations', async (t) => {
  const result = await analyze({
    files: [fixture('no-var-let-const-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let and const (inline)', async (t) => {
  const result = await analyzeSnippet('let a = 1; const b = 2; use(a + b)\nfunction use () {}\n')
  t.is(result.diagnostics.length, 0)
})
