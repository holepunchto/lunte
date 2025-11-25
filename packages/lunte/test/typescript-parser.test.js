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

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/lunte', ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
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

