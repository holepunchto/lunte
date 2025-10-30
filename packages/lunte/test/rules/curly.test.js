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

test('flags multi-line if statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'if' for multi-line statement"))
})

test('flags multi-line else statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-else-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'else' for multi-line statement"))
})

test('flags multi-line else-if without braces on if part', async (t) => {
  const result = await analyze({
    files: [fixture('curly-else-if-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes("Expected { after 'if' for multi-line statement"))
})

test('flags multi-line while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'while' for multi-line statement"))
})

test('flags multi-line do-while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-do-while-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'do' for multi-line statement"))
})

test('flags multi-line for statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for' for multi-line statement"))
})

test('flags multi-line for-in statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-in-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for-in' for multi-line statement"))
})

test('flags multi-line for-of statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-of-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'curly')
  t.ok(result.diagnostics[0].message.includes("Expected { after 'for-of' for multi-line statement"))
})

test('allows single-line if statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line if-else without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-if-else-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-while-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line do-while statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-do-while-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line for statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line for-in statement without braces', async (t) => {
  const result = await analyze({
    files: [fixture('curly-for-in-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows single-line for-of statement without braces', async (t) => {
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
  t.ok(result.diagnostics.every((d) => d.ruleId === 'curly'))
})
