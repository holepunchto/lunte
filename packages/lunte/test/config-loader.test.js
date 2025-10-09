import test from 'brittle'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { loadConfig } from '../src/config/loader.js'

async function createTempDir(prefix) {
  return mkdtemp(join(tmpdir(), `lunte-${prefix}-`))
}

test('loadConfig supports .lunterc', async (t) => {
  const dir = await createTempDir('dot')
  await writeFile(
    join(dir, '.lunterc'),
    JSON.stringify({ env: ['browser'], globals: ['MY_APP'], rules: { 'no-undef': 'off' } })
  )

  const { config, path } = await loadConfig({ cwd: dir })
  t.is(path, join(dir, '.lunterc'))
  t.alike(config.env, ['browser'])
  t.alike(config.globals, ['MY_APP'])
  t.is(config.rules['no-undef'], 'off')
})

test('loadConfig prefers .lunterc when both exist', async (t) => {
  const dir = await createTempDir('json')
  await writeFile(join(dir, '.lunterc'), JSON.stringify({ env: ['node'] }))
  await writeFile(
    join(dir, '.lunterc.json'),
    JSON.stringify({ env: ['browser'], rules: { 'no-unused-vars': 'warn' } })
  )

  const { config, path } = await loadConfig({ cwd: dir })
  t.is(path, join(dir, '.lunterc'))
  t.alike(config.env, ['node'])
})

test('loadConfig walks parent directories', async (t) => {
  const dir = await createTempDir('walk')
  const child = join(dir, 'nested', 'deeper')
  await writeFile(join(dir, '.lunterc.json'), JSON.stringify({ globals: ['MY_GLOBAL'] }))
  await mkdir(child, { recursive: true })

  const { config } = await loadConfig({ cwd: child })
  t.alike(config.globals, ['MY_GLOBAL'])
})
