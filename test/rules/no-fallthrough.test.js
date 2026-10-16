import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'no-fallthrough'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags missing break before next case', async (t) => {
  const result = await analyze({
    files: [fixture('no-fallthrough-missing-break-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, RULE_ID)
  t.is(result.diagnostics[0].message, 'Expected a break statement before next case.')
})

test('allows fallthrough when break is present', async (t) => {
  const result = await analyze({
    files: [fixture('no-fallthrough-break-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows fallthrough when commented intentionally', async (t) => {
  const result = await analyze({
    files: [fixture('no-fallthrough-comment-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
