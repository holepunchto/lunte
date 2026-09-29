import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../src/core/analyzer.js'
import { parse } from '../src/core/parser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = (...parts) => join(__dirname, 'fixtures', ...parts)
const formatDiagnostics = (diagnostics) => diagnostics.map((d) => d.message).join('\n')

test('analyzes TypeScript fixture automatically', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'basic.ts')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('analyzes TSX fixture automatically', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'basic.tsx')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('JS with type annotations still fails (parsed as JS)', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'typed-js.js')] })
  t.ok(result.diagnostics.length > 0, 'should report a parse error')
  t.ok(/unexpected/i.test(result.diagnostics[0].message))
})

test('allows exporting ambient classes after declared constructors', async (t) => {
  const filePath = fixturePath('typescript', '__virtual__ambient-exports.ts')
  const source = `declare class A {
  constructor();
}

declare class B {}

export { A, B };
`
  const result = await analyze({
    files: [filePath],
    sourceOverrides: new Map([[filePath, source]])
  })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('JSX parses automatically with TS parser', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'typed-jsx.jsx')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('declaration files allow exporting declared ambient functions', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'ambient-export.d.ts')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('allows TypeScript function overload signatures before implementation', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'overload.ts')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('typed parameters with defaults keep their source location', (t) => {
  const source = `export function f(
  a: number,
  b: string,
  c: boolean,
  fetchImpl: Fetch = globalThis.fetch
) {}

export class A {
  constructor(private readonly y: number = 2) {}
}
`
  const ast = parse(source, { filePath: 'x.ts' })

  const param = ast.body[0].declaration.params[3]
  t.is(param.type, 'AssignmentPattern')
  assertLoc(t, param, source, 'fetchImpl: Fetch = globalThis.fetch', { line: 5, column: 2 })
  assertLoc(t, param.left, source, 'fetchImpl: Fetch', { line: 5, column: 2 })

  const ctor = ast.body[1].declaration.body.body[0]
  const property = ctor.value.params[0]
  t.is(property.type, 'TSParameterProperty')
  assertLoc(t, property, source, 'private readonly y: number = 2', { line: 9, column: 14 })
  assertLoc(t, property.parameter, source, 'y: number = 2', { line: 9, column: 31 })
})

function assertLoc(t, node, source, text, start) {
  t.is(source.slice(node.start, node.end), text)
  t.alike(node.range, [node.start, node.end])
  t.alike({ ...node.loc.start }, start, `${text} starts at ${start.line}:${start.column}`)
  t.is(node.loc.end.line, start.line)
  t.is(node.loc.end.column, start.column + text.length)
}
