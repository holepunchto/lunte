import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-cond-assign'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags assignment in if condition', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-if-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-cond-assign')
  t.ok(result.diagnostics[0].message.includes('conditional'))
})

test('flags assignment in while condition', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-cond-assign')
})

test('flags assignment in do-while condition', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-do-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-cond-assign')
})

test('flags assignment in for condition', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-for-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-cond-assign')
})

test('flags assignment in ternary condition', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-ternary-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-cond-assign')
})

test('allows comparison in if', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-if-comparison-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows comparison in while', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-while-comparison-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows assignment in if body', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-assignment-in-body-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows regular comparison', async (t) => {
  const result = await analyze({
    files: [fixture('no-cond-assign-double-parens-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
