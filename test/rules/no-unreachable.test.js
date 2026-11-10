import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-unreachable'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags code after return', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-after-return-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-unreachable')
  t.ok(result.diagnostics[0].message.includes('Unreachable'))
})

test('flags code after throw', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-after-throw-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-unreachable')
})

test('flags code after break', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-after-break-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-unreachable')
})

test('flags code after continue', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-after-continue-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-unreachable')
})

test('flags code after if with both branches returning', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-if-both-branches-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-unreachable')
})

test('allows function with just return', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-return-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows code after if with one branch returning', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-if-one-branch-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows hoisted function after return', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-function-after-return-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows code after conditional break', async (t) => {
  const result = await analyze({
    files: [fixture('no-unreachable-conditional-break-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
