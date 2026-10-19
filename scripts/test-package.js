import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'lunte-package-test-')))

try {
  const [packed] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: root,
      encoding: 'utf8'
    })
  )
  const consumer = join(temporary, 'consumer')
  await mkdir(consumer)
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { lunte: `file:${join(temporary, packed.filename)}` }
    })
  )
  execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: consumer,
    stdio: 'inherit'
  })
  const installed = await realpath(join(consumer, 'node_modules/lunte'))
  assert.equal(installed, join(consumer, 'node_modules/lunte'), 'must not use a source symlink')

  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import assert from 'node:assert/strict'
       import { analyze } from 'lunte'
       const invalid = await analyze({ source: 'missingGlobal\\n', sourceFile: 'bad.js' })
       assert.ok(invalid.diagnostics.some(d => d.ruleId === 'no-undef'))
       const valid = await analyze({ source: 'console.log(1)\\n', sourceFile: 'good.js' })
       assert.equal(valid.diagnostics.length, 0)
       const ts = await analyze({ source: 'export const value: number = 1\\n', sourceFile: 'good.ts' })
       assert.equal(ts.diagnostics.length, 0)
       const json = await analyze({ source: '{"value":1}\\n', sourceFile: 'good.json' })
       assert.equal(json.diagnostics.length, 0)`
    ],
    { cwd: consumer, stdio: 'inherit' }
  )
  console.log('ok - installed API and bundled parsers')

  const cli = join(consumer, 'node_modules/.bin/lunte')
  function lint(args, expected) {
    const result = spawnSync(cli, args, { cwd: consumer, encoding: 'utf8', timeout: 30000 })
    if (result.error) throw result.error
    assert.equal(result.status, expected, result.stdout + result.stderr)
    assert.equal(result.stderr, '')
    return result.stdout
  }

  await writeFile(join(consumer, 'good.js'), 'console.log(1)\n')
  await writeFile(join(consumer, 'bad.js'), 'missingGlobal\n')
  lint(['good.js'], 0)
  assert.match(lint(['bad.js'], 1), /no-undef/)
  console.log('ok - installed executable and exit codes')

  await writeFile(join(consumer, '.lunterc.json'), JSON.stringify({ rules: { 'no-undef': 'off' } }))
  lint(['bad.js'], 0)
  await rm(join(consumer, '.lunterc.json'))
  console.log('ok - consumer configuration')

  await writeFile(join(consumer, '.lunteignore'), 'bad.js\n')
  assert.doesNotMatch(lint(['.'], 0), /no-undef/)
  await rm(join(consumer, '.lunteignore'))
  console.log('ok - consumer ignore patterns')

  await writeFile(
    join(consumer, 'plugin.mjs'),
    `export default { rules: [{
      meta: { name: 'smoke/plugin' },
      create(context) {
        return { Program(node) { context.report({ node, message: 'package smoke plugin' }) } }
      }
    }] }\n`
  )
  await writeFile(
    join(consumer, '.lunterc.json'),
    JSON.stringify({ plugins: ['./plugin.mjs'], rules: { 'smoke/plugin': 'error' } })
  )
  assert.match(lint(['good.js'], 1), /package smoke plugin/)
  await rm(join(consumer, '.lunterc.json'))
  console.log('ok - consumer plugin loading')

  await writeFile(join(consumer, 'fix.js'), "if (true)\n  console.log('test')\n")
  lint(['--fix', 'fix.js'], 0)
  assert.equal(
    await readFile(join(consumer, 'fix.js'), 'utf8'),
    "if (true) {\n  console.log('test')\n}\n"
  )
  console.log('ok - fixes written by installed executable')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
