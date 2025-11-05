import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'no-empty'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function analyzeSnippet(source) {
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags empty blocks except catch', async (t) => {
  const result = await analyze({
    files: [fixture('no-empty-block-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty')

  const allowed = await analyze({
    files: [fixture('no-empty-catch-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(allowed.diagnostics.length, 0)

  const functions = await analyze({
    files: [fixture('no-empty-function-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(functions.diagnostics.length, 0)
})

test('flags empty while loop body', async (t) => {
  const result = await analyzeSnippet('while (false) { }\n')
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty')
})

test('allows empty catch block', async (t) => {
  const result = await analyzeSnippet('try { throw new Error() } catch (error) { }\n')
  t.is(result.diagnostics.length, 0)
})

test('allows block statements that only contain comments', async (t) => {
  const result = await analyzeSnippet('if (flag) { // noop\n}\n')
  t.is(result.diagnostics.length, 0)
})
