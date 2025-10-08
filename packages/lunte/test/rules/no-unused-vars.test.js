import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'no-unused-vars'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function runSnippet(source, overrides = BASE_OVERRIDES) {
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: overrides,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags unused variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  const [diag] = result.diagnostics
  t.ok(diag.message.includes('never used'))
  t.is(diag.severity, 'error')
})

test('does not flag used variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('does not flag unused parameters by default', async (t) => {
  const result = await runSnippet('function demo(foo) { return 42 }\ndemo()\n')
  t.is(result.diagnostics.length, 0)
})

test('allows CommonJS exported generator functions', async (t) => {
  const result = await runSnippet(
    'module.exports = async function * audit (store) {\n  yield store\n}\n'
  )
  t.is(result.diagnostics.length, 0)
})

test('allows CommonJS property exports', async (t) => {
  const result = await runSnippet('exports.audit = function audit () {}\n')
  t.is(result.diagnostics.length, 0)
})

test('flags unused bindings while allowing used destructured params', async (t) => {
  const unusedLocal = await runSnippet('function demo () { const unused = 1; }\ndemo()\n')
  t.is(unusedLocal.diagnostics.length, 1)
  t.ok(unusedLocal.diagnostics[0].message.includes('unused'))

  const destructuredParams = await runSnippet(
    'function demo({a, ...rest}) { console.log(a); return rest.length }\ndemo({ a: 1 })\n'
  )
  t.is(destructuredParams.diagnostics.length, 0)
})
