import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile } from 'fs/promises'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = (...parts) => join(__dirname, '..', 'fixtures', ...parts)

const RULE_ID = 'curly'
const ONLY_CURLY = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

test('applies fix for multi-line if without braces', async (t) => {
  const file = '/virtual/curly-if-invalid.js'
  const source = await readFile(fixtures('curly-if-invalid.js'), 'utf8')
  const expected = await readFile(fixtures('curly-if-invalid.fixed.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_CURLY,
    fix: true,
    write: false,
    sourceText: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 2)
  t.is(result.fixedDiagnostics, 1)
  t.is(result.fixedFiles, 1)
  t.is(result.diagnostics.length, 0, 'should clear diagnostics after fixing')

  const output = result.fixedOutputs.get(file)
  t.is(output, expected)
})

test('does not change already valid single-line if', async (t) => {
  const file = '/virtual/curly-if-valid.js'
  const source = await readFile(fixtures('curly-if-valid.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_CURLY,
    fix: true,
    write: false,
    sourceText: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 0)
  t.is(result.diagnostics.length, 0)
  t.is(result.fixedOutputs.get(file), undefined, 'no output when nothing changed')
})

test('leaves else violation unfixed and still reported', async (t) => {
  const file = '/virtual/curly-else-invalid.js'
  const source = await readFile(fixtures('curly-else-invalid.js'), 'utf8')

  const result = await analyze({
    files: [file],
    ruleOverrides: ONLY_CURLY,
    fix: true,
    write: false,
    sourceText: new Map([[file, source]])
  })

  t.is(result.fixedEdits, 0)
  t.is(result.fixedDiagnostics, 0)
  t.is(result.fixedFiles, 0)
  t.is(result.diagnostics.length, 1, 'still reports unfixed else diagnostic')
  t.is(result.fixedOutputs.get(file), undefined, 'output should be untouched')
})
