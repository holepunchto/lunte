import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../src/core/analyzer.js'

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

test('JSX parses automatically with TS parser', async (t) => {
  const result = await analyze({ files: [fixturePath('typescript', 'typed-jsx.jsx')] })
  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})
