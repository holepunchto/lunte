import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

async function analyzeSnippet(source) {
  const filePath = join(__dirname, `__virtual__/nufd-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    sourceText: new Map([[filePath, source]]),
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
}

test('allows identifier used before definition at module scope', async (t) => {
  const result = await analyze({
    files: [fixturePath('use-before-define-invalid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows const used before definition at module scope', async (t) => {
  const result = await analyze({
    files: [fixturePath('module-const.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows identifier defined before use', async (t) => {
  const result = await analyze({
    files: [fixturePath('use-before-define-valid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows hoisted function declarations', async (t) => {
  const result = await analyze({
    files: [fixturePath('function-hoist.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exported class before usage', async (t) => {
  const result = await analyze({
    files: [fixturePath('export-class.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows usage before block-scoped declaration within function (current behaviour)', async (t) => {
  const result = await analyzeSnippet(
    'function demo () {\n  foo()\n  const foo = () => {}\n}\ndemo()\n'
  )
  t.is(result.diagnostics.length, 0)
})

test('allows function expressions referenced before declaration', async (t) => {
  const expression = await analyzeSnippet('call()\nconst call = function () {}\n')
  t.is(expression.diagnostics.length, 0)
})
