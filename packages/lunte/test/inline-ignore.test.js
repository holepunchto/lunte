import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, 'fixtures', name)
}

test('inline disable directives suppress targeted diagnostics', async (t) => {
  const result = await analyze({ files: [fixturePath('inline-ignore.js')] })
  const noUndefDiagnostics = result.diagnostics.filter((d) => d.ruleId === 'no-undef')
  const noUnusedDiagnostics = result.diagnostics.filter((d) => d.ruleId === 'no-unused-vars')

  t.is(noUndefDiagnostics.length, 1, 'should only report unsuppressed undef issues')
  t.is(noUndefDiagnostics[0].line, 9)

  t.is(noUnusedDiagnostics.length, 1, 'should not suppress other rules by default')
  t.is(noUnusedDiagnostics[0].line, 1)
})

test('eslint-style disable directives are respected', async (t) => {
  const result = await analyze({ files: [fixturePath('inline-ignore-eslint.js')] })
  t.is(result.diagnostics.length, 0)
})
