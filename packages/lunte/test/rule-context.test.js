import test from 'brittle'

import { RuleContext } from '../src/core/rule-context.js'

const NO_IGNORES = { shouldIgnore: () => false }

function createContext(source, ignoreMatcher = NO_IGNORES) {
  const diagnostics = []
  const context = new RuleContext({
    filePath: 'file.js',
    source,
    diagnostics,
    ruleId: 'test/rule',
    ignoreMatcher
  })
  return { context, diagnostics }
}

test('report derives line and column from offsets when loc is missing', (t) => {
  const source = 'const a = 1\r\nconst b = 2\n  target()\n'
  const { context, diagnostics } = createContext(source)
  const start = source.indexOf('target')

  context.report({ node: { type: 'Identifier', start, end: start + 6 }, message: 'm' })

  t.is(diagnostics.length, 1)
  t.is(diagnostics[0].line, 3)
  t.is(diagnostics[0].column, 3)
})

test('report derives line from offsets when loc.start is malformed', (t) => {
  const source = 'first()\nsecond(x = () =>\n  1)\n'
  const start = source.indexOf('x =')
  const end = source.indexOf('1)') + 1
  const shouldIgnore = ({ line }) => line === 2
  const { context, diagnostics } = createContext(source, { shouldIgnore })

  const loc = { start: { start: {}, end: {} }, end: { line: 3, column: 3 } }
  context.report({ node: { type: 'AssignmentPattern', start, end, loc }, message: 'm' })

  t.is(diagnostics.length, 0, 'recovered line is matched by inline ignores')
})

test('report prefers parser locations over offsets', (t) => {
  const { context, diagnostics } = createContext('abc')
  const loc = { start: { line: 7, column: 4 }, end: { line: 7, column: 5 } }

  context.report({ node: { type: 'Identifier', start: 0, end: 1, loc }, message: 'm' })

  t.is(diagnostics[0].line, 7)
  t.is(diagnostics[0].column, 5)
})
