import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../src/core/analyzer.js'
import { builtInRules } from '../src/rules/index.js'

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

test('inline directives suppress reports on typed default parameters', async (t) => {
  t.teardown(registerRule('test/no-fourth-param', {
    FunctionDeclaration(node, context) {
      const param = node.params[3]
      if (param) context.report({ node: param, message: 'Too many parameters.' })
    }
  }))

  const source = `export function reported(a: number, b: string, c: boolean, fetchImpl: Fetch = globalThis.fetch) {}

// lunte-disable-next-line test/no-fourth-param
export function suppressed(a: number, b: string, c: boolean, fetchImpl: Fetch = (input) =>
  globalThis.fetch(input)) {}
`
  const result = await analyze({ source, sourceFile: 'typed-default-param.ts' })
  const diagnostics = result.diagnostics.filter((d) => d.ruleId === 'test/no-fourth-param')

  t.is(diagnostics.length, 1, 'only the unsuppressed parameter is reported')
  t.is(diagnostics[0].line, 1)
  t.is(diagnostics[0].column, source.indexOf('fetchImpl') + 1)
})

function registerRule(name, listeners) {
  builtInRules.set(name, {
    meta: { name },
    create(context) {
      return Object.fromEntries(
        Object.entries(listeners).map(([type, fn]) => [type, (node) => fn(node, context)])
      )
    }
  })
  return () => builtInRules.delete(name)
}
