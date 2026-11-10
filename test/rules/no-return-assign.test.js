import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-return-assign'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags assignment in return statements', async (t) => {
  const result = await analyze({
    files: [fixture('no-return-assign-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-return-assign')
})

test('allows parenthesised assignment in return', async (t) => {
  const result = await analyze({
    files: [fixture('no-return-assign-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('flags assignment in arrow function implicit returns', async (t) => {
  const result = await analyze({
    files: [fixture('no-return-assign-arrow-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-return-assign')
})

test('allows parenthesised assignment in arrow function implicit returns', async (t) => {
  const result = await analyze({
    files: [fixture('no-return-assign-arrow-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
