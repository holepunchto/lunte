import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'eqeqeq'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags == operator', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-double-equals-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'eqeqeq')
  t.ok(result.diagnostics[0].message.includes('==='))
})

test('flags != operator', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-not-equals-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'eqeqeq')
  t.ok(result.diagnostics[0].message.includes('!=='))
})

test('flags == null comparisons', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-null-check-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'eqeqeq')
})

test('flags multiple violations', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-multiple-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 3)
  t.is(result.diagnostics[0].ruleId, 'eqeqeq')
  t.is(result.diagnostics[1].ruleId, 'eqeqeq')
  t.is(result.diagnostics[2].ruleId, 'eqeqeq')
})

test('allows === operator', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-triple-equals-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows !== operator', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-strict-not-equals-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows === null', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-null-strict-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows assignment operator', async (t) => {
  const result = await analyze({
    files: [fixture('eqeqeq-assignment-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
