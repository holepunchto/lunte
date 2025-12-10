import process from 'process'
import test from 'brittle'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'

import { mkdtemp } from './helpers/mkdtemp.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

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
    let finished = false
    const settle = (code) => {
      if (finished) return
      finished = true
      resolve({ code, stdout, stderr })
    }

    child.on('close', settle)
    child.on('exit', settle)
  })
}

test('cli --fix wraps multi-line if with braces', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lunte-fix-'))
  const file = join(dir, 'curly.js')
  await writeFile(file, "if (true)\n  console.log('test')\n")

  const result = await runCli(['--fix', file])

  t.is(result.code, 0)
  t.is(result.stderr, '')
  t.ok(result.stdout.includes('Applied'), 'should report applied fixes')

  const output = await readFile(file, 'utf8')
  t.is(output, "if (true) {\n  console.log('test')\n}\n")
})
