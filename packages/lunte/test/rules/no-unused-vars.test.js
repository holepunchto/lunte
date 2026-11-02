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

async function runSnippet(source, overrides = BASE_OVERRIDES, options = {}) {
  const extension = options.extension ?? (options.typescript ? 'ts' : 'js')
  const filePath = join(__dirname, `__virtual__/${RULE_ID}-${(virtualId += 1)}.${extension}`)
  return analyze({
    files: [filePath],
    ruleOverrides: overrides,
    sourceOverrides: new Map([[filePath, source]]),
    enableTypeScriptParser: options.typescript
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

function messages(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.message)
}

function runTypeScript(source, extension = 'ts') {
  return runSnippet(source, [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }], {
    typescript: true,
    extension
  })
}

test('flags unused imports', async (t) => {
  const result = await runSnippet(
    "import os from 'bare-os'\nimport * as path from 'bare-path'\nimport { readFile } from 'bare-fs'\nimport { stat as statFile } from 'bare-fs'\n"
  )

  t.alike(messages(result), [
    "'os' is defined but never used.",
    "'path' is defined but never used.",
    "'readFile' is defined but never used.",
    "'statFile' is defined but never used."
  ])
})

test('reports the local name of aliased imports', async (t) => {
  const result = await runSnippet(
    "import { readFile as read, stat as stat2 } from 'bare-fs'\nread()\n"
  )
  t.alike(messages(result), ["'stat2' is defined but never used."])
})

test('does not flag used imports or side-effect imports', async (t) => {
  const result = await runSnippet(
    "import os, { platform as getPlatform } from 'bare-os'\nimport * as path from 'bare-path'\nimport { readFile } from 'bare-fs'\nimport 'configure-runtime'\nconsole.log(os.arch(), getPlatform(), path.join('a'), readFile)\n"
  )
  t.alike(messages(result), [])
})

test('counts exported and re-exported imports as used', async (t) => {
  const result = await runSnippet(
    "import a from 'a'\nimport { b } from 'b'\nimport * as c from 'c'\nexport { a, b as bee }\nexport default c\nexport { d } from 'd'\nexport * from 'e'\nexport * as f from 'f'\n"
  )
  t.alike(messages(result), [])
})

test('ignores underscore-prefixed imports', async (t) => {
  const result = await runSnippet("import _unused from 'a'\nimport { b as _b } from 'b'\n")
  t.alike(messages(result), [])
})

test('ignores explicit type-only imports', async (t) => {
  const result = await runTypeScript(
    "import type Default from 'a'\nimport type { Named } from 'b'\nimport type * as Ns from 'c'\nimport { type Spec, value } from 'd'\nvalue()\n"
  )
  t.alike(messages(result), [])
})

test('flags unused value specifiers next to type specifiers', async (t) => {
  const result = await runTypeScript("import { type Spec, value } from 'd'\n")
  t.alike(messages(result), ["'value' is defined but never used."])
})

test('counts imports referenced only in TypeScript types as used', async (t) => {
  const result = await runTypeScript(
    [
      "import { Foo } from 'pkg'",
      "import Default from 'default-pkg'",
      "import { Bar as Baz } from 'alias-pkg'",
      "import { Elem } from 'elem-pkg'",
      "import { Arg } from 'arg-pkg'",
      "import { Ret } from 'ret-pkg'",
      'export interface Public { value: Foo }',
      'export type Alias = Default | Baz[]',
      'export type List = Array<Elem>',
      'export function run (arg: Arg): Ret { return arg as unknown as Ret }',
      ''
    ].join('\n')
  )
  t.alike(messages(result), [])
})

test('counts imports used in qualified types, type queries, generics and heritage', async (t) => {
  const result = await runTypeScript(
    [
      "import * as ns from 'ns'",
      "import * as deep from 'deep'",
      "import { config } from 'config'",
      "import * as queried from 'queried'",
      "import { Generic } from 'generic'",
      "import { create } from 'create'",
      "import * as base from 'base'",
      "import * as contracts from 'contracts'",
      "import * as aliased from 'aliased'",
      'export type A = ns.Type',
      'export type B = deep.a.b.C<string>',
      'export type C = typeof config',
      'export type D = typeof queried.value.nested',
      'export type E = Map<string, Generic<number>>',
      'export const e = create<string>()',
      'export interface F extends base.Base {}',
      'export class G implements contracts.Contract {}',
      'import H = aliased.Member',
      'export const h = H',
      ''
    ].join('\n')
  )
  t.alike(messages(result), [])
})

test('does not count type labels as references to imports', async (t) => {
  const result = await runTypeScript(
    [
      "import { key } from 'a'",
      "import { method } from 'b'",
      "import { member } from 'c'",
      "import { right } from 'd'",
      "import { param } from 'e'",
      'export interface I { key: string; method(): void }',
      'export enum E { member }',
      'export type T = Other.right',
      'export type Fn = (param: string) => void',
      ''
    ].join('\n')
  )
  t.alike(messages(result), [
    "'key' is defined but never used.",
    "'method' is defined but never used.",
    "'member' is defined but never used.",
    "'right' is defined but never used.",
    "'param' is defined but never used."
  ])
})

test('does not count type references shadowed by type parameters', async (t) => {
  const result = await runTypeScript(
    [
      "import { T } from 'a'",
      "import { K } from 'b'",
      "import { U } from 'c'",
      "import { Used } from 'd'",
      'export function id<T>(value: T): T { return value }',
      'export type Keys<O> = { [K in keyof O]: K }',
      'export type Unwrap<P> = P extends Promise<infer U> ? U : Used',
      ''
    ].join('\n')
  )
  t.alike(messages(result), [
    "'T' is defined but never used.",
    "'K' is defined but never used.",
    "'U' is defined but never used."
  ])
})

test('counts type-only exports of ordinary imports as used', async (t) => {
  const result = await runTypeScript(
    "import { A } from 'a'\nimport { B } from 'b'\nexport type { A }\nexport { type B }\n"
  )
  t.alike(messages(result), [])
})

test('shadowing local bindings does not cause import false positives', async (t) => {
  const result = await runSnippet(
    "import { value } from 'a'\nexport function f () {\n  const value = 1\n  return value\n}\nexport const g = value\n"
  )
  t.alike(messages(result), [])
})

test('type references do not count as uses of ordinary variables', async (t) => {
  const result = await runTypeScript('const Shape = 1\nexport type T = Shape\n')
  t.alike(messages(result), ["'Shape' is defined but never used."])
})

test('counts imported JSX components as used', async (t) => {
  const result = await runTypeScript(
    [
      "import React from 'react'",
      "import Button from './button'",
      "import * as ui from './ui'",
      "import { Unused } from './unused'",
      'export const view = <><Button /><ui.Panel /></>',
      ''
    ].join('\n'),
    'tsx'
  )
  t.alike(messages(result), ["'Unused' is defined but never used."])
})

test('counts JSX pragma factories as used', async (t) => {
  const result = await runTypeScript(
    [
      '/** @jsx h */',
      '/** @jsxFrag Fragment */',
      "import { h, Fragment } from 'preact'",
      'export const view = <><div /></>',
      ''
    ].join('\n'),
    'tsx'
  )
  t.alike(messages(result), [])
})

test('counts typeof as a variable use', async (t) => {
  const result = await runSnippet('const x = 10\nconst y = typeof x\nconsole.log(y)\n')
  t.is(result.diagnostics.length, 0)
})

test('counts TypeScript typeof queries as variable use', async (t) => {
  const result = await runSnippet(
    'const config = { a: 1 }\ntype T = typeof config\n',
    BASE_OVERRIDES,
    {
      typescript: true
    }
  )
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

test('allows named function expressions used in assignments', async (t) => {
  const result = await runSnippet(
    'const obj = {}\nobj.run = function run () {}\nconsole.log(obj)\n'
  )
  t.is(result.diagnostics.length, 0)
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

test('marks JSX components as used when rendered', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-jsx-valid.tsx')],
    ruleOverrides: BASE_OVERRIDES,
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0)
})

test('flags unused JSX components', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-jsx-invalid.tsx')],
    ruleOverrides: BASE_OVERRIDES,
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 1)
  t.ok(result.diagnostics[0].message.includes('UnusedComponent'))
})

test('counts TypeScript parameter properties as used through this', async (t) => {
  const valid = await runSnippet(
    'export class C {\n  constructor(private resources: number) {}\n  read() { return this.resources }\n}\n',
    BASE_OVERRIDES,
    { typescript: true }
  )
  t.is(valid.diagnostics.length, 0)

  const invalid = await runSnippet(
    'export class C {\n  constructor(private resources: number) {}\n  read() { return 1 }\n}\n',
    BASE_OVERRIDES,
    { typescript: true }
  )
  t.is(invalid.diagnostics.length, 1)
  t.ok(invalid.diagnostics[0].message.includes('resources'))
})

test('treats TSX type-only imports as used when referenced', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-tsx-valid.tsx')],
    ruleOverrides: BASE_OVERRIDES,
    enableTypeScriptParser: true
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
  t.ok(
    result.diagnostics.some((d) => d.ruleId === 'no-unused-vars'),
    'should report unused enum'
  )
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

test('counts decorator usages as references in TypeScript files', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-decorators.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})

test('still reports unused decorator definitions', async (t) => {
  const result = await analyze({
    files: [fixturePath('no-unused-vars-typescript-decorators-invalid.ts')],
    ruleOverrides: [...BASE_OVERRIDES, { name: 'no-undef', severity: 'off' }],
    enableTypeScriptParser: true
  })
  t.ok(result.diagnostics.some((d) => d.message.includes('unused')))
})
