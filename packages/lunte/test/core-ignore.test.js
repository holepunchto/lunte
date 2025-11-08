import test from 'brittle'
import { writeFile, rm, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname, relative } from 'path'

import { loadIgnore } from '../src/core/ignore.js'
import { resolveFileTargets } from '../src/core/file-resolver.js'
import { mkdtemp } from './helpers/mkdtemp.js'

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

test('loadIgnore does not ignore workspace root inside node_modules', async (t) => {
  const dir = await withTempDir(t, {
    'node_modules/my_project/index.js': '',
    'node_modules/my_project/node_modules/ignored.js': ''
  })
  const projectDir = join(dir, 'node_modules/my_project')
  const matcher = await loadIgnore({ cwd: projectDir })

  t.is(
    matcher.ignores(join(projectDir, 'index.js')),
    false,
    'project files should not be ignored just because cwd contains node_modules'
  )
  t.ok(
    matcher.ignores(join(projectDir, 'node_modules/ignored.js')),
    'nested node_modules still ignored'
  )
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

test('nested .lunteignore files only affect their subtree', async (t) => {
  const dir = await withTempDir(t, {
    'packages/foo/.lunteignore': 'dist/\n./coverage/\n',
    'packages/foo/dist/ignored.js': '',
    'packages/foo/coverage/report.txt': '',
    'packages/foo/lib/kept.js': '',
    'packages/bar/dist/kept.js': ''
  })

  const matcher = await loadIgnore({ cwd: dir })
  const fooMatcher = await matcher.extend(join(dir, 'packages/foo'))
  const barMatcher = await matcher.extend(join(dir, 'packages/bar'))

  t.ok(
    fooMatcher.ignores(join(dir, 'packages/foo/dist'), { isDir: true }),
    'nested ignore should hide dist directory inside the owner'
  )
  t.ok(
    fooMatcher.ignores(join(dir, 'packages/foo/dist/ignored.js')),
    'nested ignore should hide files inside ignored directory'
  )
  t.ok(
    fooMatcher.ignores(join(dir, 'packages/foo/coverage'), { isDir: true }),
    'relative path with ./ should treat directory as basedir'
  )
  t.is(
    barMatcher.ignores(join(dir, 'packages/bar/dist/kept.js')),
    false,
    'nested ignore should not leak into sibling directories'
  )

  const files = await resolveFileTargets(['.'], { cwd: dir, ignore: matcher })
  const relativeFiles = files.map((file) => relative(dir, file)).sort()

  t.alike(relativeFiles.includes('packages/foo/dist/ignored.js'), false)
  t.alike(relativeFiles.includes('packages/foo/coverage/report.txt'), false)
  t.ok(relativeFiles.includes('packages/foo/lib/kept.js'), 'non-ignored files should remain')
  t.ok(
    relativeFiles.includes('packages/bar/dist/kept.js'),
    'sibling directories without ignore should be scanned'
  )
})
