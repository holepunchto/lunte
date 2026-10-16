import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-duplicate-case'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags duplicate literal case labels', async (t) => {
  const result = await analyze({
    files: [fixture('no-duplicate-case-literal-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, RULE_ID)
  t.is(result.diagnostics[0].message, 'Duplicate case label.')
})

test('allows distinct case labels', async (t) => {
  const result = await analyze({
    files: [fixture('no-duplicate-case-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('treats +0 and -0 as duplicates', async (t) => {
  const result = await analyze({
    files: [fixture('no-duplicate-case-negative-zero-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, RULE_ID)
  t.is(result.diagnostics[0].message, 'Duplicate case label.')
})
