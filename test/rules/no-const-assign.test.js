import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-const-assign'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags basic const reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-basic-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
  t.ok(result.diagnostics[0].message.includes('constant'))
})

test('flags const increment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-increment-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
})

test('flags const decrement', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-decrement-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
})

test('flags compound assignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-compound-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
})

test('flags destructuring reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-destructuring-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 2)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
  t.is(result.diagnostics[1].ruleId, 'no-const-assign')
})

test('flags const in loop', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-loop-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-const-assign')
})

test('allows const without reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-basic-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-let-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows var reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-var-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows const object mutation', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-object-mutation-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows const array mutation', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-array-mutation-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows const in for-of loop', async (t) => {
  const result = await analyze({
    files: [fixture('no-const-assign-for-of-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
