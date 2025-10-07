import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { analyze } from '../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixturePath(name) {
  return join(__dirname, 'fixtures', name)
}

test('flags unused variable', async (t) => {
  const result = await analyze({ files: [fixturePath('no-unused-vars-invalid.js')] })
  t.is(result.diagnostics.length, 1)
  const [diag] = result.diagnostics
  t.ok(diag.message.includes('never used'))
  t.is(diag.severity, 'warning')
})

test('does not flag used variable', async (t) => {
  const result = await analyze({ files: [fixturePath('no-unused-vars-valid.js')] })
  t.is(result.diagnostics.length, 0)
})
