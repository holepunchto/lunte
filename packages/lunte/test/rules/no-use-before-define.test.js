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

test('reports identifier used before definition at module scope', async (t) => {
  const result = await analyze({
    files: [fixturePath('use-before-define-invalid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('was used before it was defined'))
})

test('allows const used before definition at module scope', async (t) => {
  const result = await analyze({
    files: [fixturePath('shared-module-const-valid.js')],
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
    files: [fixturePath('shared-function-hoist-valid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exported class before usage', async (t) => {
  const result = await analyze({
    files: [fixturePath('shared-export-class-valid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows references inside deferred function bodies', async (t) => {
  const result = await analyzeSnippet(
    'const stream = new Readable({\n  read () {\n    stream.push(null)\n  }\n})\n'
  )
  t.is(result.diagnostics.length, 0)
})

test('allows rest destructuring bindings in the same scope', async (t) => {
  const result = await analyzeSnippet(
    "function wrap (err) {\n  const { ...info } = err\n  Object.defineProperty(info, 'err', { value: err })\n}\nwrap({})\n"
  )
  t.is(result.diagnostics.length, 0)
})

test('reports block-scoped usage before declaration within same function', async (t) => {
  const result = await analyzeSnippet(
    'function demo () {\n  foo()\n  const foo = () => {}\n}\ndemo()\n'
  )
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('was used before it was defined'))
})

test('reports function expressions referenced before declaration', async (t) => {
  const expression = await analyzeSnippet('call()\nconst call = function () {}\n')
  t.is(expression.diagnostics.length, 1)
  t.ok(expression.diagnostics[0].message.includes('was used before it was defined'))
})

test('reports identifier used in earlier destructuring default value', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-destructuring-default-invalid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 1)
  const [diag] = result.diagnostics
  t.ok(diag.message.includes('name'))
  t.ok(diag.message.includes('was used before it was defined'))
})

test('allows identifier used in later destructuring default value', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-destructuring-default-valid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('reports array destructuring used before definition', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-use-before-define-array-destructuring-invalid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.ok(result.diagnostics.length >= 1)
  t.ok(result.diagnostics.some((d) => d.message.includes('used before')))
})

test('reports nested destructuring used before definition', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-use-before-define-nested-destructuring-invalid.js')],
    ruleOverrides: [{ name: 'no-undef', severity: 'off' }]
  })
  t.ok(result.diagnostics.length >= 1)
  t.ok(result.diagnostics.some((d) => d.message.includes('used before')))
})
