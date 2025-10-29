import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

const RULE_ID = 'constructor-super'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

// Invalid cases

test('flags derived class constructor without super()', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-missing-super.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'constructor-super')
  t.ok(
    result.diagnostics[0].message.includes(
      "Constructors of derived classes must call 'super()'"
    )
  )
})

test('flags non-derived class constructor with super() (caught by parser)', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-unnecessary-super.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  // Note: oxc-parser catches this at parse time with error:
  // "super() call outside constructor of a subclass"
  // This is still a valid diagnostic, just not from our rule
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('super()'))
})

test('flags this before super() in derived class', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-this-before-super.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'constructor-super')
  t.ok(
    result.diagnostics[0].message.includes(
      "'this' is not allowed before 'super()'"
    )
  )
})

// Valid cases

test('allows derived class with super() call', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-derived-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows non-derived class without super()', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-non-derived-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows this after super() in derived class', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-this-after-super.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows class without constructor', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-no-constructor.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows class expression with proper super() usage', async (t) => {
  const result = await analyze({
    files: [fixture('constructor-super-class-expression-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})
