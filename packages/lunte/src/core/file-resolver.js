import process from 'process'
import { stat, readdir } from 'fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'path'

import { hasMagic, globToRegExp, toPosix } from './glob.js'

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs'])
const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.cts', '.mts'])
const LINTABLE_FILES = new Set(['package.json'])

export async function resolveFileTargets(
  inputs,
  { ignore, cwd = process.cwd(), includeTypeScript = false } = {}
) {
  const files = new Set()
  const ignoreMatcher = ignore ?? { ignores: () => false }

  for (const input of inputs) {
    const normalized = toPosix(input)
    const absolutePattern = isAbsolute(input)
    if (hasMagic(normalized)) {
      const base = getGlobBase(normalized)
      const baseDir = resolvePath(cwd, base || '.')
      const regex = globToRegExp(normalized)
      await collectGlob({
        baseDir,
        matcher: { regex, absolute: absolutePattern },
        files,
        ignore: ignoreMatcher,
        cwd,
        includeTypeScript
      })
    } else {
      await collectPath(resolvePath(cwd, input), {
        files,
        ignore: ignoreMatcher,
        includeTypeScript
      })
    }
  }

  return Array.from(files)
}

async function collectPath(resolved, { files, ignore, includeTypeScript }) {
  let info
  try {
    info = await stat(resolved)
  } catch (error) {
    if (error.code === 'ENOENT') {
      files.add(resolved)
      return
    }
    throw error
  }

  const isDir = info.isDirectory()
  if (shouldIgnore(ignore, resolved, { isDir })) {
    return
  }

  if (isDir) {
    const nextIgnore = await extendIgnore(ignore, resolved)
    await collectDirectory(resolved, { files, ignore: nextIgnore, includeTypeScript })
    return
  }

  if (info.isFile()) {
    files.add(resolved)
  }
}

async function collectDirectory(dir, { files, ignore, includeTypeScript }) {
  if (shouldIgnore(ignore, dir, { isDir: true })) {
    return
  }
  const dirIgnore = await extendIgnore(ignore, dir)
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dir, entry.name)
    const isDir = entry.isDirectory()
    if (shouldIgnore(dirIgnore, fullPath, { isDir })) {
      continue
    }

    if (isDir) {
      await collectDirectory(fullPath, { files, ignore: dirIgnore, includeTypeScript })
    } else if (entry.isFile() && isLintableFile(fullPath, includeTypeScript)) {
      files.add(fullPath)
    }
  }
}

async function collectGlob({ baseDir, matcher, files, ignore, cwd, includeTypeScript }) {
  let info
  try {
    info = await stat(baseDir)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return
    }
    throw error
  }

  if (!info.isDirectory()) {
    const candidate = matcher.absolute ? toPosix(baseDir) : toPosix(relative(cwd, baseDir))
    if (
      !ignore.ignores?.(baseDir, { isDir: false }) &&
      matcher.regex.test(candidate) &&
      isLintableFile(baseDir, includeTypeScript)
    ) {
      files.add(baseDir)
    }
    return
  }

  await walkGlob(baseDir, { matcher, files, ignore, cwd, includeTypeScript })
}

async function walkGlob(dir, { matcher, files, ignore, cwd, includeTypeScript }) {
  if (shouldIgnore(ignore, dir, { isDir: true })) {
    return
  }

  const dirIgnore = await extendIgnore(ignore, dir)
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dir, entry.name)
    const isDir = entry.isDirectory()
    if (shouldIgnore(dirIgnore, fullPath, { isDir })) {
      continue
    }

    if (isDir) {
      await walkGlob(fullPath, { matcher, files, ignore: dirIgnore, cwd, includeTypeScript })
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const candidate = matcher.absolute ? toPosix(fullPath) : toPosix(relative(cwd, fullPath))
    if (!matcher.regex.test(candidate)) {
      continue
    }

    if (isLintableFile(fullPath, includeTypeScript)) {
      files.add(fullPath)
    }
  }
}

function isJavaScriptFile(filePath) {
  const extension = extname(filePath).toLowerCase()
  return JS_EXTENSIONS.has(extension)
}

function isTypeScriptFile(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.ts' && filePath.toLowerCase().endsWith('.d.ts')) {
    return true
  }
  return TS_EXTENSIONS.has(extension)
}

function isLintableFile(filePath, includeTypeScript) {
  const fileName = filePath.split('/').pop().split('\\').pop()
  if (LINTABLE_FILES.has(fileName)) {
    return true
  }
  if (isJavaScriptFile(filePath)) {
    return true
  }
  if (includeTypeScript) {
    return isTypeScriptFile(filePath)
  }
  return false
}

function resolvePath(base, target) {
  if (isAbsolute(target)) {
    return target
  }
  return resolve(base, target)
}

function getGlobBase(pattern) {
  const index = pattern.search(/[*?[]/)
  if (index === -1) {
    return pattern
  }
  const slashIndex = pattern.lastIndexOf('/', index)
  return slashIndex === -1 ? '' : pattern.slice(0, slashIndex)
}

function shouldIgnore(ignore, path, meta) {
  return Boolean(ignore?.ignores?.(path, meta))
}

async function extendIgnore(ignore, dir) {
  if (typeof ignore?.extend === 'function') {
    try {
      return await ignore.extend(dir)
    } catch (error) {
      // fall through to return original ignore if extension fails
    }
  }
  return ignore
}
