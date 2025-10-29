import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'prefer-const'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags let that is never reassigned', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-basic-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'prefer-const')
  t.ok(result.diagnostics[0].message.includes("never reassigned"))
})

test('flags multiple let declarations never reassigned', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-multiple-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 2)
  t.is(result.diagnostics[0].ruleId, 'prefer-const')
  t.is(result.diagnostics[1].ruleId, 'prefer-const')
})

test('allows let that is reassigned', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-reassigned-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let in for loop', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-for-loop-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let with compound assignment', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-compound-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let with increment', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-increment-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows const declarations', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-const-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('flags let in nested scope', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-nested-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'prefer-const')
})

test('does not flag destructuring by default', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-destructuring-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows let with later reassignment', async (t) => {
  const result = await analyze({
    files: [fixture('prefer-const-later-reassign-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
