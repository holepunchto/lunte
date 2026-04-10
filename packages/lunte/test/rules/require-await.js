import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

test('flags async function without await', async (t) => {
  const result = await analyze({ files: [fixture('require-await-basic-invalid.js')] })

  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'require-await')
})

test('flags async arrow function without await', async (t) => {
  const result = await analyze({ files: [fixture('require-await-arrow-function-invalid.js')] })

  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'require-await')
})

test('allows valid cases', async (t) => {
  const result = await analyze({ files: [fixture('require-await-valid-cases.js')] })

  t.is(result.diagnostics.length, 0)
})
