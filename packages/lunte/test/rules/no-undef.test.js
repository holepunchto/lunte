import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, '..', 'fixtures', name)
}

test('reports use of undefined variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-invalid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 1)
  const [diag] = result.diagnostics
  t.ok(diag.message.includes('is not defined'))
})

test('does not report defined variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows node globals by default', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-node.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('respects eslint-env directive', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-browser-comment.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('respects global directive', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-custom-global.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exported class before usage', async (t) => {
  const result = await analyze({
    files: [fixturePath('export-class.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows class expression name inside its body', async (t) => {
  const result = await analyze({
    files: [fixturePath('class-expression-reference.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})
