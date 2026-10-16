import test from 'brittle'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { analyze } from '../../src/index.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixture = (name) => join(__dirname, '..', 'fixtures', name)

const RULE_ID = 'no-redeclare'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('flags duplicate var declarations', async (t) => {
  const result = await analyze({
    files: [fixture('no-redeclare-var-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-redeclare')
  t.ok(result.diagnostics[0].message.includes('already defined'))
})

test('allows var reassignment without redeclaration', async (t) => {
  const result = await analyze({
    files: [fixture('no-redeclare-var-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows different function declarations', async (t) => {
  const result = await analyze({
    files: [fixture('no-redeclare-function-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
