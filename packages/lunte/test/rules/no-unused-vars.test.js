import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'no-unused-vars'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function runSnippet(source, overrides = BASE_OVERRIDES) {
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${(virtualId += 1)}.js`)
  return analyze({
    files: [filePath],
    ruleOverrides: overrides,
    sourceText: new Map([[filePath, source]])
  })
}

test('flags unused variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  const [diag] = result.diagnostics
  t.ok(diag.message.includes('never used'))
  t.is(diag.severity, 'error')
})

test('does not flag used variable', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('does not flag unused parameters by default', async (t) => {
  const result = await runSnippet('function demo(foo) { return 42 }\ndemo()\n')
  t.is(result.diagnostics.length, 0)
})

test('allows named function expressions used as arguments', async (t) => {
  const result = await runSnippet('const w = new Wakeup(function onwakeup () {})\nconsole.log(w)\n')
  t.is(result.diagnostics.length, 0)
})

test('still flags unused named function expressions outside arguments', async (t) => {
  const result = await runSnippet('const fn = function named () {}\nconsole.log(fn)\n')
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('named'))
})

test('allows CommonJS exported generator functions', async (t) => {
  const result = await runSnippet(
    'module.exports = async function * audit (store) {\n  yield store\n}\n'
  )
  t.is(result.diagnostics.length, 0)
})

test('allows CommonJS property exports', async (t) => {
  const result = await runSnippet('exports.audit = function audit () {}\n')
  t.is(result.diagnostics.length, 0)
})

test('flags unused bindings while allowing used destructured params', async (t) => {
  const unusedLocal = await runSnippet('function demo () { const unused = 1; }\ndemo()\n')
  t.is(unusedLocal.diagnostics.length, 1)
  t.ok(unusedLocal.diagnostics[0].message.includes('unused'))

  const destructuredParams = await runSnippet(
    'function demo({a, ...rest}) { console.log(a); return rest.length }\ndemo({ a: 1 })\n'
  )
  t.is(destructuredParams.diagnostics.length, 0)
})

test('treats computed class keys as references', async (t) => {
  const methodKey = await runSnippet(
    "const foo = Symbol.for('test')\nclass Bar { [foo] () {} }\nexport default Bar\n"
  )
  t.is(methodKey.diagnostics.length, 0)

  const fieldKey = await runSnippet(
    "const foo = Symbol('static')\nclass Baz { static [foo] = true }\n"
  )
  t.is(fieldKey.diagnostics.length, 0)
})

test('ignores underscore-prefixed variables', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-underscore-prefix-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows rest destructuring parameters', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-rest-destructuring-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows unused catch parameters', async (t) => {
  // Catch parameters are often unused (just catching to suppress error)
  const result = await analyze({
    files: [fixturePath('no-unused-vars-catch-param-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows unused function parameters by default', async (t) => {
  // Function parameters are often unused (positional arguments, interface compliance)
  const result = await analyze({
    files: [fixturePath('no-unused-vars-function-params-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('ignores rest siblings (ignoreRestSiblings)', async (t) => {
  // Variables that are siblings of rest elements should be ignored (used for property omission)
  const result = await analyze({
    files: [fixturePath('no-unused-vars-ignore-rest-siblings-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('ignores type-only imports in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-valid.ts')],
    ruleOverrides: BASE_OVERRIDES,
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})

test('flags unused enums in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-invalid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.ok(result.diagnostics.some((d) => d.ruleId === 'no-unused-vars'), 'should report unused enum')
})

test('handles namespaces and import equals in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-namespace-valid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})

test('flags unused namespaces and import equals in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-namespace-invalid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.ok(
    result.diagnostics.some((d) => d.message.includes('Internal')),
    'should report unused namespace'
  )
  t.ok(
    result.diagnostics.some((d) => d.message.includes('Logger')),
    'should report unused import equals'
  )
})

test('deduplicates diagnostics for reopened TypeScript namespaces', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-namespace-reopen-invalid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  const namespaceDiagnostics = result.diagnostics.filter((d) => d.message.includes('Internal'))
  t.is(namespaceDiagnostics.length, 1, 'should report namespace only once')
})

test('ignores type-only import equals in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-import-equals-type-valid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})
