import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-dupe-keys'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags simple duplicate keys', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-simple-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-dupe-keys')
  t.ok(result.diagnostics[0].message.includes('foo'))
})

test('flags string literal duplicate', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-string-literal-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-dupe-keys')
})

test('flags number literal duplicate', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-number-literal-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-dupe-keys')
})

test('flags multiple duplicates', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-multiple-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 2)
  t.is(result.diagnostics[0].ruleId, 'no-dupe-keys')
  t.is(result.diagnostics[1].ruleId, 'no-dupe-keys')
})

test('allows unique keys', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-unique-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows shorthand properties', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-shorthand-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows spread properties', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-spread-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows computed properties', async (t) => {
  const result = await analyze({
    files: [fixture('no-dupe-keys-computed-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
