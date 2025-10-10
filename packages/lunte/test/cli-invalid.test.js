import test from 'brittle'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

async function createTempDir(prefix) {
  return mkdtemp(join(tmpdir(), `lunte-cli-${prefix}-`))
}

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
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

test('CLI reports parse errors', async (t) => {
  const dir = await createTempDir('parse')
  const file = join(dir, 'invalid.js')
  await writeFile(file, 'const answer =;\n')
  const result = await runCli([file])

  t.is(result.code, 1)
  t.ok(/ERROR/.test(result.stdout), 'stdout should contain ERROR')
  t.is(result.stderr, '')
})

test('CLI exits 0 for valid input', async (t) => {
  const dir = await createTempDir('valid')
  const file = join(dir, 'valid.js')
  await writeFile(file, 'const answer = 42\nconsole.log(answer)\n')
  const result = await runCli([file])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout), 'stdout should report no issues')
  t.is(result.stderr, '')
})

test('CLI respects rule overrides', async (t) => {
  const dir = await createTempDir('unused')
  const file = join(dir, 'unused.js')
  await writeFile(file, 'const unused = 1\n')
  const result = await runCli(['--rule', 'no-unused-vars=off', file])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout), 'warnings should be suppressed when rule disabled')
  t.is(result.stderr, '')
})

test('CLI env flag enables browser globals', async (t) => {
  const dir = await createTempDir('env')
  const file = join(dir, 'browser.js')
  await writeFile(file, 'document.body; window.alert;\n')
  const result = await runCli(['--env', 'browser', file])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout))
  t.is(result.stderr, '')
})

test('CLI expands directory inputs', async (t) => {
  const dir = await createTempDir('dir')
  await writeFile(join(dir, 'a.js'), 'console.log(1)\n')
  await mkdir(join(dir, 'sub'))
  await writeFile(join(dir, 'sub', 'b.js'), 'console.log(2)\n')
  const result = await runCli([dir])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout))
  t.is(result.stderr, '')
})

test('CLI expands glob patterns', async (t) => {
  const dir = await createTempDir('glob')
  await writeFile(join(dir, 'a.js'), 'console.log(1)\n')
  await mkdir(join(dir, 'nested'))
  await writeFile(join(dir, 'nested', 'b.js'), 'console.log(2)\n')
  const pattern = join(dir, '**/*.js')
  const result = await runCli([pattern])

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout))
  t.is(result.stderr, '')
})

test('CLI verbose flag lists files', async (t) => {
  const dir = await createTempDir('verbose')
  const file = join(dir, 'file.js')
  await writeFile(file, 'console.log(1)\n')

  const result = await runCli(['--verbose', file])

  t.is(result.code, 0)
  t.ok(result.stdout.includes('Analyzing 1 file'))
  t.ok(result.stdout.includes('✓'), 'should mark success with a check')
  t.ok(result.stdout.includes(file))
  t.is(result.stderr, '')
})

test('CLI short verbose flag lists files', async (t) => {
  const dir = await createTempDir('verbose-short')
  const file = join(dir, 'file.js')
  await writeFile(file, 'console.log(1)\n')

  const result = await runCli(['-v', file])

  t.is(result.code, 0)
  t.ok(result.stdout.includes('Analyzing 1 file'))
  t.ok(result.stdout.includes('✓'), 'should mark success with a check')
  t.ok(result.stdout.includes(file))
  t.is(result.stderr, '')
})

test('CLI verbose flag marks errors per file', async (t) => {
  const dir = await createTempDir('verbose-error')
  const file = join(dir, 'invalid.js')
  await writeFile(file, 'const answer =;\n')

  const result = await runCli(['--verbose', file])

  t.is(result.code, 1)
  t.ok(result.stdout.includes('Analyzing 1 file'))
  t.ok(result.stdout.includes('✕'), 'should mark error with a cross')
  t.ok(result.stdout.includes(file))
  t.is(result.stderr, '')
})
