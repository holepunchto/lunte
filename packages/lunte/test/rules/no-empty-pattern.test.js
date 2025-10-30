import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-empty-pattern'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags empty object pattern', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-empty-object-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty-pattern')
  t.ok(result.diagnostics[0].message.includes('empty'))
})

test('flags empty array pattern', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-empty-array-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty-pattern')
})

test('flags array pattern with only holes', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-array-holes-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty-pattern')
})

test('flags empty pattern in function param', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-function-param-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty-pattern')
})

test('allows object destructuring', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-object-destructure-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows array destructuring', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-array-destructure-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows array pattern with some holes', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-array-with-holes-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows rest pattern', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-pattern-rest-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
