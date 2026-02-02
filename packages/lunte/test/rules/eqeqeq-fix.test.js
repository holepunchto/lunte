import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile } from 'fs/promises'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = (...parts) => join(__dirname, '..', 'fixtures', ...parts)

const RULE_ID = 'eqeqeq'
const ONLY_EQEQEQ = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('applies fix for == operator', async (t) => {
  const file = '/virtual/eqeqeq-double-equals-invalid.js'
  const source = await readFile(fixtures('eqeqeq-double-equals-invalid.js'), 'utf8')
  const expected = await readFile(fixtures('eqeqeq-double-equals-invalid.fixed.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_EQEQEQ,
    fix: true,
    write: false,
    sourceOverrides: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 1)
  t.is(result.fixedDiagnostics, 1)
  t.is(result.fixedFiles, 1)
  t.is(result.diagnostics.length, 0, 'should clear diagnostics after fixing')

  const output = result.fixedOutputs.get(file)
  t.is(output, expected)
})

test('applies fix for != operator', async (t) => {
  const file = '/virtual/eqeqeq-not-equals-invalid.js'
  const source = await readFile(fixtures('eqeqeq-not-equals-invalid.js'), 'utf8')
  const expected = await readFile(fixtures('eqeqeq-not-equals-invalid.fixed.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_EQEQEQ,
    fix: true,
    write: false,
    sourceOverrides: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 1)
  t.is(result.fixedDiagnostics, 1)
  t.is(result.fixedFiles, 1)
  t.is(result.diagnostics.length, 0, 'should clear diagnostics after fixing')

  const output = result.fixedOutputs.get(file)
  t.is(output, expected)
})

test('applies fix for multiple violations', async (t) => {
  const file = '/virtual/eqeqeq-multiple-invalid.js'
  const source = await readFile(fixtures('eqeqeq-multiple-invalid.js'), 'utf8')
  const expected = await readFile(fixtures('eqeqeq-multiple-invalid.fixed.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_EQEQEQ,
    fix: true,
    write: false,
    sourceOverrides: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 3)
  t.is(result.fixedDiagnostics, 3)
  t.is(result.fixedFiles, 1)
  t.is(result.diagnostics.length, 0, 'should clear diagnostics after fixing')

  const output = result.fixedOutputs.get(file)
  t.is(output, expected)
})
