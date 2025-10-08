import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ALL_RULES = [
  'no-use-before-define',
  'no-undef',
  'no-unused-vars',
  'no-debugger',
  'no-var',
  'no-case-declarations',
  'no-return-assign',
  'no-multi-str',
  'no-empty',
  'no-extra-boolean-cast'
]

function fixture(name) {
  return join(__dirname, 'fixtures', name)
}

function overridesFor(target, severity = 'error') {
  return ALL_RULES.map((name) => ({ name, severity: name === target ? severity : 'off' }))
}

test('no-debugger flags debugger statements', async (t) => {
  const result = await analyze({
    files: [fixture('has-debugger.js')],
    ruleOverrides: overridesFor('no-debugger')
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-debugger')
})

test('no-var flags var declarations', async (t) => {
  const result = await analyze({
    files: [fixture('var-declaration.js')],
    ruleOverrides: overridesFor('no-var', 'error')
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-var')
})

test('no-case-declarations flags lexical declarations', async (t) => {
  const result = await analyze({
    files: [fixture('case-declaration.js')],
    ruleOverrides: overridesFor('no-case-declarations')
  })
  t.is(result.diagnostics.length, 2)
  t.ok(result.diagnostics.every((d) => d.ruleId === 'no-case-declarations'))
})

test('no-return-assign disallows assignment in return', async (t) => {
  const bad = await analyze({
    files: [fixture('return-assign-bad.js')],
    ruleOverrides: overridesFor('no-return-assign')
  })
  t.is(bad.diagnostics.length, 1)
  t.is(bad.diagnostics[0].ruleId, 'no-return-assign')

  const good = await analyze({
    files: [fixture('return-assign-good.js')],
    ruleOverrides: overridesFor('no-return-assign')
  })
  t.is(good.diagnostics.length, 0)
})

test('no-multi-str flags multiline string', async (t) => {
  const result = await analyze({
    files: [fixture('multiline-string.js')],
    ruleOverrides: overridesFor('no-multi-str')
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-multi-str')
})

test('no-empty flags empty blocks (except catch)', async (t) => {
  const result = await analyze({
    files: [fixture('empty-block.js')],
    ruleOverrides: overridesFor('no-empty')
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-empty')

  const allowed = await analyze({
    files: [fixture('empty-catch.js')],
    ruleOverrides: overridesFor('no-empty')
  })
  t.is(allowed.diagnostics.length, 0)

  const functions = await analyze({
    files: [fixture('empty-function.js')],
    ruleOverrides: overridesFor('no-empty')
  })
  t.is(functions.diagnostics.length, 0)
})

test('no-extra-boolean-cast flags double negation', async (t) => {
  const result = await analyze({
    files: [fixture('double-negation.js')],
    ruleOverrides: overridesFor('no-extra-boolean-cast')
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'no-extra-boolean-cast')
})
