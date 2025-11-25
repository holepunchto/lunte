import process from 'process'
import test from 'brittle'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { analyze } from '../src/core/analyzer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)
const fixturePath = (...parts) => join(__dirname, 'fixtures', ...parts)

const formatDiagnostics = (diagnostics) => diagnostics.map((d) => d.message).join('\n')

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/lunte', ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    const settle = (code) => resolve({ code, stdout, stderr })
    child.on('close', settle)
    child.on('exit', settle)
  })
}

test('analyze TypeScript fixture when experimental parser enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'basic.ts')],
    enableTypeScriptParser: true
  })

  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('analyze TSX fixture when experimental parser enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'basic.tsx')],
    enableTypeScriptParser: true
  })

  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('JS with type annotations fails without JS toggle', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'typed-js.js')],
    enableTypeScriptParser: true
  })

  t.ok(result.diagnostics.length > 0, 'should report a parse error')
  t.ok(/unexpected/i.test(result.diagnostics[0].message))
})

test('JS with type annotations parses when JS toggle enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'typed-js.js')],
    enableTypeScriptParser: true,
    enableTypeScriptParserForJS: true
  })

  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('JSX parses with TypeScript parser when JS toggle enabled', async (t) => {
  const result = await analyze({
    files: [fixturePath('typescript', 'typed-jsx.jsx')],
    enableTypeScriptParser: true,
    enableTypeScriptParserForJS: true
  })

  t.is(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics))
})

test('CLI --force-ts-parser uses TypeScript parser for JS inputs', async (t) => {
  const result = await runCli(['--force-ts-parser', fixturePath('typescript', 'typed-js.js')])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout))
  t.is(result.stderr, '')
})
