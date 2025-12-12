import test from 'brittle'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../../src/core/analyzer.js'
import { builtInRules } from '../../src/rules/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return join(__dirname, '..', 'fixtures', name)
}

let virtualId = 0

const RULE_ID = 'import/no-duplicates'
const BASE_OVERRIDES = Array.from(builtInRules.keys()).map((name) => ({
  name,
  severity: name === RULE_ID ? 'error' : 'off'
}))

async function analyzeSnippet(source, { ext = 'js', enableTypeScriptParser = false } = {}) {
  const filePath = join(
    __dirname,
    `__virtual__/${RULE_ID.replace('/', '-')}-${(virtualId += 1)}.${ext}`
  )
  return analyze({
    files: [filePath],
    ruleOverrides: BASE_OVERRIDES,
    sourceOverrides: new Map([[filePath, source]]),
    enableTypeScriptParser
  })
}

test('flags duplicate default imports', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-duplicate-default-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
  t.ok(result.diagnostics[0].message.includes('./module'))
})

test('flags duplicate named imports', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-duplicate-named-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
  t.ok(result.diagnostics[0].message.includes('./module'))
})

test('flags duplicate mixed imports', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-duplicate-mixed-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
})

test('flags multiple duplicate imports', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-multiple-duplicates-invalid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 2)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
  t.is(result.diagnostics[1].ruleId, 'import/no-duplicates')
})

test('allows single import from module', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-single-import-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows imports from different modules', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-different-modules-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('allows combined imports in single statement', async (t) => {
  const result = await analyze({
    files: [fixture('import-no-duplicates-combined-valid.js')],
    ruleOverrides: BASE_OVERRIDES
  })
  t.is(result.diagnostics.length, 0)
})

test('flags duplicate imports from npm packages', async (t) => {
  const result = await analyzeSnippet(`
import { foo } from 'lodash'
import { bar } from 'lodash'

console.log(foo, bar)
`)
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
  t.ok(result.diagnostics[0].message.includes('lodash'))
})

test('allows different specifier paths', async (t) => {
  const result = await analyzeSnippet(`
import { foo } from './module'
import { bar } from './module/subpath'

console.log(foo, bar)
`)
  t.is(result.diagnostics.length, 0)
})

test('flags side-effect duplicates', async (t) => {
  const result = await analyzeSnippet(`
import './module'
import './module'
`)
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
})

test('flags namespace import duplicates', async (t) => {
  const result = await analyzeSnippet(`
import * as foo from './module'
import * as bar from './module'

console.log(foo, bar)
`)
  t.is(result.diagnostics.length, 1)
  t.is(result.diagnostics[0].ruleId, 'import/no-duplicates')
})

test('allows separate type and value imports from the same module', async (t) => {
  const result = await analyzeSnippet(
    `
import type { FC } from 'react'
import React, { useState } from 'react'

const Button: FC<{ label: string }> = ({ label }) => {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{label}</button>
}

export default Button
`,
    { ext: 'tsx', enableTypeScriptParser: true }
  )

  t.is(result.diagnostics.length, 0)
})
