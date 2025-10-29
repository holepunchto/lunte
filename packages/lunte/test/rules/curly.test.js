import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'curly'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags if statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'if'"))
})

test('flags else statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-else-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'else'"))
})

test('flags else-if without braces on if part', async (t) => {
  const result = await analyze({
    files: [fixture('curly-else-if-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes("Expected { after 'if'"))
})

test('flags while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'while'"))
})

test('flags do-while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-do-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'do'"))
})

test('flags for statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for'"))
})

test('flags for-in statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-in-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for-in'"))
})

test('flags for-of statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-of-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for-of'"))
})

test('allows if statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows if-else with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-else-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows while statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-while-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows do-while statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-do-while-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows for statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows for-in statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-in-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows for-of statement with braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-of-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('flags multiple violations in same file', async (t) => {
  const result = await analyze({
    files: [fixture('curly-multiple-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 3)
  t.ok(result.diagnostics.every(d => d.ruleId === 'curly'))
})
