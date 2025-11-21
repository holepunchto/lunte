import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
    files: [fixturePath('no-undef-node-globals-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('respects eslint-env directive', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-browser-env-comment-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('respects global directive', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-custom-global-directive-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows exported class before usage', async (t) => {
  const result = await analyze({
    files: [fixturePath('shared-export-class-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows class expression name inside its body', async (t) => {
  const result = await analyze({
    files: [fixturePath('shared-class-expression-reference-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows typeof with undeclared variables', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-typeof-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('allows modern ES2021+ and Node.js globals', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-modern-globals-valid.js')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }]
  })
  t.is(result.diagnostics.length, 0)
})

test('ignores type-only identifiers in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-typescript-valid.ts')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})

test('handles enums, namespaces, and import equals in TypeScript', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-undef-typescript-declarations.ts')],
    ruleOverrides: [{ name: 'no-use-before-define', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})
