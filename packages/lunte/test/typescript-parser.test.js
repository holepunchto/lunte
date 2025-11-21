import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = (...parts) => join(__dirname, 'fixtures', ...parts)

test('analyze TypeScript fixture when experimental parser enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'basic.ts')],
    enableTypeScriptParser: true
  })

  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})

test('analyze TSX fixture when experimental parser enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'basic.tsx')],
    enableTypeScriptParser: true
  })

  t.is(result.diagnostics.length, 0, result.diagnostics.map((d) => d.message).join('\n'))
})
