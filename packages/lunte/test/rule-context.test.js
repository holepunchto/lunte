import test from 'brittle'

import { parse } from '../src/core/parser.js'
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

test('report derives the column from offsets when loc.start has no column', (t) => {
  const source = 'first()\nsecond(x)\n'
  const start = source.indexOf('x')
  const { context, diagnostics } = createContext(source)
  const loc = { start: { line: 2 }, end: { line: 2 } }

  context.report({ node: { type: 'Identifier', start, end: start + 1, loc }, message: 'm' })

  t.is(diagnostics[0].line, 2)
  t.is(diagnostics[0].column, 8)
})

test('report keeps a partial loc when there is no usable offset', (t) => {
  const shouldIgnore = ({ line }) => line === 2
  const { context, diagnostics } = createContext('first()\nsecond(x)\n', { shouldIgnore })
  const loc = { start: { line: 2 }, end: { line: 2 } }

  context.report({ node: { type: 'Identifier', start: NaN, loc }, message: 'm' })

  t.is(diagnostics.length, 0, 'partial line is still matched by inline ignores')
})

test('report ignores non-integer offsets', (t) => {
  const { context, diagnostics } = createContext('first()\nsecond(x)\n')

  for (const start of [NaN, Infinity, -Infinity, 1.5, '3']) {
    context.report({ node: { type: 'Identifier', start, end: start }, message: 'm' })
  }

  t.is(diagnostics.length, 5)
  for (const diagnostic of diagnostics) {
    t.is(diagnostic.line, undefined)
    t.is(diagnostic.column, undefined)
  }
})

test('report offsets match parser locations in unicode sources', (t) => {
  const source = 'const s = "😀é\\u2028"; /* ✓ */ const v = `a\n😀${s}`\r\nlet u = { "ü": v } u\n'
  const { context, diagnostics } = createContext(source)
  const nodes = []
  collectNodes(parse(source, { filePath: 'unicode.js' }), nodes)

  for (const node of nodes) {
    context.report({ node: { type: node.type, start: node.start, end: node.end }, message: 'm' })
  }

  t.ok(nodes.length > 10)
  t.alike(
    diagnostics.map((d) => [d.line, d.column]),
    nodes.map((node) => [node.loc.start.line, node.loc.start.column + 1])
  )
})

test('report prefers parser locations over offsets', (t) => {
  const { context, diagnostics } = createContext('abc')
  const loc = { start: { line: 7, column: 4 }, end: { line: 7, column: 5 } }

  context.report({ node: { type: 'Identifier', start: 0, end: 1, loc }, message: 'm' })

  t.is(diagnostics[0].line, 7)
  t.is(diagnostics[0].column, 5)
})

function collectNodes(node, nodes) {
  nodes.push(node)
  for (const value of Object.values(node)) {
    for (const child of [value].flat()) {
      if (child && typeof child.type === 'string') collectNodes(child, nodes)
    }
  }
}
