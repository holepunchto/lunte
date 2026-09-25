import process from 'process'
import test from 'brittle'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdtemp, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

async function createTempDir(prefix) {
  return mkdtemp(join(tmpdir(), `lunte-cli-${prefix}-`))
}

function runCli(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/lunte', ...args], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
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

    child.stdin.end(input)
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

test('CLI expands directory inputs to include json files', async (t) => {
  const dir = await createTempDir('json-dir')
  await writeFile(
    join(dir, 'data.json'),
    `{
  "foo": 1,
  "foo": 2
}
`
  )

  const result = await runCli([dir])

  t.is(result.code, 1)
  t.ok(result.stdout.includes('(no-dupe-keys)'))
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

test('CLI stdin preserves filename-based package.json rules', async (t) => {
  const source = `{
  "exports": {
    ".": {
      "default": "./index.js",
      "import": "./index.mjs"
    }
  }
}
`

  const result = await runCli(['--stdin', 'package.json'], { input: source })

  t.is(result.code, 1)
  t.ok(
    result.stdout.includes('(package-json/exports-order)'),
    'stdout should report the package.json exports order rule'
  )
  t.is(result.stderr, '')
})

test('CLI accepts empty stdin as empty input', async (t) => {
  const result = await runCli(['--stdin'], { input: '' })

  t.is(result.code, 0)
  t.ok(/No issues/.test(result.stdout), 'stdout should report no issues for empty input')
  t.is(result.stderr, '')
})

async function writeWarningsFile(prefix, count) {
  const dir = await createTempDir(prefix)
  const file = join(dir, 'warnings.js')
  const lines = Array.from({ length: count }, (_, i) => `const unused${i} = ${i}\n`)
  await writeFile(file, lines.join(''))
  return file
}

test('CLI max-warnings passes when warnings are within the limit', async (t) => {
  const file = await writeWarningsFile('max-warnings-under', 2)
  const result = await runCli(['--rule', 'no-unused-vars=warn', '--max-warnings', '2', file])

  t.is(result.code, 0)
  t.ok(result.stdout.includes('2 warnings'))
  t.absent(result.stdout.includes('Too many warnings'))
  t.is(result.stderr, '')
})

test('CLI max-warnings fails when warnings exceed the limit', async (t) => {
  const file = await writeWarningsFile('max-warnings-over', 3)
  const result = await runCli(['--rule', 'no-unused-vars=warn', '--max-warnings=2', file])

  t.is(result.code, 1)
  t.ok(result.stdout.includes('3 warnings'))
  t.ok(result.stdout.trimEnd().endsWith('Too many warnings (3, maximum: 2)'))
  t.is(result.stderr, '')
})

test('CLI max-warnings 0 fails on a single warning', async (t) => {
  const file = await writeWarningsFile('max-warnings-zero', 1)
  const result = await runCli(['--rule', 'no-unused-vars=warn', '--max-warnings', '0', file])

  t.is(result.code, 1)
  t.ok(result.stdout.includes('Too many warnings (1, maximum: 0)'))
  t.is(result.stderr, '')
})

test('CLI without max-warnings exits 0 on warnings', async (t) => {
  const file = await writeWarningsFile('max-warnings-absent', 3)
  const result = await runCli(['--rule', 'no-unused-vars=warn', file])

  t.is(result.code, 0)
  t.absent(result.stdout.includes('Too many warnings'))
  t.is(result.stderr, '')
})

test('CLI max-warnings does not hide errors', async (t) => {
  const dir = await createTempDir('max-warnings-errors')
  const file = join(dir, 'invalid.js')
  await writeFile(file, 'const answer =;\n')
  const result = await runCli(['--max-warnings', '100', file])

  t.is(result.code, 1)
  t.ok(/ERROR/.test(result.stdout))
  t.absent(result.stdout.includes('Too many warnings'))
  t.is(result.stderr, '')
})

test('CLI rejects invalid max-warnings values', async (t) => {
  const file = await writeWarningsFile('max-warnings-invalid', 1)

  for (const value of ['abc', '-1', '1.5', '']) {
    const result = await runCli([`--max-warnings=${value}`, file])
    t.is(result.code, 1, `exit 1 for "${value}"`)
    t.ok(
      result.stderr.includes('--max-warnings'),
      `stderr should mention --max-warnings for "${value}"`
    )
    t.is(result.stdout, '', `should not lint for "${value}"`)
  }

  const missing = await runCli(['--max-warnings'])
  t.is(missing.code, 1)
  t.ok(missing.stderr.includes('Invalid usage for option: --max-warnings'))
})
