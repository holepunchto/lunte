import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'package-json/exports-order'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags "default" condition not being last', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-default-first-invalid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, RULE_ID)
  t.ok(result.diagnostics[0].message.includes('default'))
})

test('flags "default" not last in nested exports', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-nested-invalid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 2)
  t.is(result.diagnostics[0].ruleId, RULE_ID)
  t.is(result.diagnostics[1].ruleId, RULE_ID)
})

test('allows "default" as last condition', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-default-last-valid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows package.json without exports', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-no-exports-valid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exports with only "default"', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-only-default-valid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exports without conditional exports', async (t) => {
  const result = await analyze({
    files: [fixture('package-json-exports-order-no-conditionals-valid/package.json')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('reports JSON parse errors', async (t) => {
  const filePath = join(__dirname, '__virtual__/invalid-json/package.json')
  const source = '{ "name": "test", invalid json }'
  const result = await analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceOverrides: new Map([[filePath, source]])
  })
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('Invalid JSON'))
})

test('only runs on files named package.json', async (t) => {
  const filePath = join(__dirname, '__virtual__/not-package.json')
  const source = `{
  "exports": {
    ".": {
      "default": "./index.js",
      "import": "./index.mjs"
    }
  }
}`
  const result = await analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceOverrides: new Map([[filePath, source]])
  })
  // Should get parse error because it tries to parse as JS, not JSON
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('Unexpected token'))
})
