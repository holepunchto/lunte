import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'require-await'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags async function without await', async (t) => {
  const result = await analyze({
    files: [fixture('require-await-basic-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })

  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'require-await')
})

test('flags async arrow function without await', async (t) => {
  const result = await analyze({
    files: [fixture('require-await-arrow-function-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })

  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'require-await')
})

test('allows async generators without await', async (t) => {
  const result = await analyze({
    files: [fixture('require-await-async-generator-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })

  t.is(result.diagnostics.length, 0)
})

test('allows valid cases', async (t) => {
  const result = await analyze({
    files: [fixture('require-await-valid-cases.js')],
    ruleOverrides: BASE_OVERRIDES
  })

  t.is(result.diagnostics.length, 0)
})
