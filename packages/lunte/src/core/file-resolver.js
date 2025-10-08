import { stat, readdir } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'

import { hasMagic, globToRegExp, toPosix } from './glob.js'

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs'])

export async function resolveFileTargets(inputs, { ignore, cwd = process.cwd() } = {}) {
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
        cwd
      })
    } else {
      await collectPath(resolvePath(cwd, input), { files, ignore: ignoreMatcher, cwd })
    }
  }

  return Array.from(files)
}

async function collectPath(target, { files, ignore, cwd }) {
  const resolved = resolvePath(cwd, target)
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

  if (ignore.ignores?.(resolved, { isDir: info.isDirectory() })) {
    return
  }

  if (info.isDirectory()) {
    await collectDirectory(resolved, { files, ignore, cwd })
    return
  }

  if (info.isFile()) {
    files.add(resolved)
  }
}

async function collectDirectory(dir, { files, ignore, cwd }) {
  if (ignore.ignores?.(dir, { isDir: true })) {
    return
  }

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dir, entry.name)
    const isDir = entry.isDirectory()
    if (ignore.ignores?.(fullPath, { isDir })) {
      if (entry.isDirectory()) {
        continue
      }
      if (entry.isFile()) {
        continue
      }
    }

    if (entry.isDirectory()) {
      await collectDirectory(fullPath, { files, ignore, cwd })
    } else if (entry.isFile() && isJavaScriptFile(fullPath)) {
      files.add(fullPath)
    }
  }
}

async function collectGlob({ baseDir, matcher, files, ignore, cwd }) {
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
    if (!ignore.ignores?.(baseDir, { isDir: false }) && matcher.regex.test(candidate)) {
      files.add(baseDir)
    }
    return
  }

  await walkGlob(baseDir, { matcher, files, ignore, cwd })
}

async function walkGlob(dir, { matcher, files, ignore, cwd }) {
  if (ignore.ignores?.(dir, { isDir: true })) {
    return
  }

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dir, entry.name)
    const isDir = entry.isDirectory()
    if (ignore.ignores?.(fullPath, { isDir })) {
      if (entry.isDirectory()) {
        continue
      }
      if (entry.isFile()) {
        continue
      }
    }

    if (entry.isDirectory()) {
      await walkGlob(fullPath, { matcher, files, ignore, cwd })
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const candidate = matcher.absolute ? toPosix(fullPath) : toPosix(relative(cwd, fullPath))
    if (!matcher.regex.test(candidate)) {
      continue
    }

    if (isJavaScriptFile(fullPath)) {
      files.add(fullPath)
    }
  }
}

function isJavaScriptFile(filePath) {
  const extension = extname(filePath).toLowerCase()
  return JS_EXTENSIONS.has(extension)
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
