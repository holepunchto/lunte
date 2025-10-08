import test from 'brittle'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import { loadIgnore } from '../src/core/ignore.js'

async function withTempDir(t, entries) {
  const dir = await mkdtemp(join(tmpdir(), 'lunte-ignore-'))
  t.teardown(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  if (entries) {
    for (const [relativePath, content] of Object.entries(entries)) {
      const filePath = join(dir, relativePath)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, content)
    }
  }

  return dir
}

test('loadIgnore ignores node_modules by default', async (t) => {
  const dir = await withTempDir(t)
  const matcher = await loadIgnore({ cwd: dir })
  t.ok(matcher.ignores(join(dir, 'node_modules/foo.js')), 'node_modules should be ignored')
})

test('loadIgnore supports negated patterns', async (t) => {
  const dir = await withTempDir(t, {
    '.lunteignore': 'dist/\n!dist/keep.js\n'
  })
  const matcher = await loadIgnore({ cwd: dir })
  t.ok(matcher.ignores(join(dir, 'dist'), { isDir: true }), 'directory match should be ignored')
  t.is(
    matcher.ignores(join(dir, 'dist/keep.js')),
    false,
    'negated file pattern should be respected'
  )
})

test('loadIgnore treats anchored patterns as workspace-relative', async (t) => {
  const dir = await withTempDir(t, {
    '.lunteignore': '/build/output.js\nsubdir/temp.js\n'
  })
  const matcher = await loadIgnore({ cwd: dir })

  t.ok(matcher.ignores(join(dir, 'build/output.js')), 'anchored pattern should match root file')
  t.is(
    matcher.ignores(join(dir, 'nested/build/output.js')),
    false,
    'anchored pattern should not match nested path'
  )
  t.ok(matcher.ignores(join(dir, 'subdir/temp.js')), 'unanchored pattern matches anywhere')
})
