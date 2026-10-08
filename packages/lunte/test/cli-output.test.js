import process from 'process'
import test from 'brittle'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

function runCli(args, { timeout = 10000 } = {}) {
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

    const timer = setTimeout(() => child.kill(), timeout)

    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

test('CLI writes the full report when stdout is a pipe', async (t) => {
  const count = 5000
  const dir = await mkdtemp(join(tmpdir(), 'lunte-cli-output-'))
  const file = join(dir, 'many-errors.js')
  let source = ''
  for (let i = 0; i < count; i++) source += `undefinedGlobal${i}\n`
  await writeFile(file, source)

  const result = await runCli([file])

  t.is(result.code, 1)
  t.is(result.stderr, '')
  t.ok(result.stdout.length > 256 * 1024, 'report should be well over the 64 KB pipe buffer')

  const lines = result.stdout.trimEnd().split('\n')
  t.is(lines.length, count + 1, 'one line per diagnostic plus the summary')
  t.ok(lines[count - 1].includes(`'undefinedGlobal${count - 1}' is not defined.`))
  t.is(lines[count], `${count} errors`, 'summary line should be the last line')
})

test('CLI exits after writing the report even if a plugin keeps the event loop alive', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lunte-cli-output-'))
  const plugin = join(dir, 'plugin.mjs')
  const file = join(dir, 'valid.js')
  await writeFile(
    plugin,
    `setInterval(() => {}, 1000)
export default { rules: [{ meta: { name: 'test/cli-output-noop' }, create: () => ({}) }] }
`
  )
  await writeFile(file, 'export const answer = 42\n')

  const result = await runCli(['--plugin', plugin, file], { timeout: 5000 })

  t.is(result.code, 0, 'CLI should exit on its own with code 0')
  t.ok(result.stdout.includes('No issues found'))
  t.is(result.stderr, '')
})
