import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'

import { globToRegExp, toPosix } from './glob.js'

const DEFAULT_IGNORE_FILE = '.lunteignore'
const DEFAULT_PATTERNS = ['node_modules/']

export async function loadIgnore({ cwd = process.cwd(), ignorePath } = {}) {
  const patterns = []
  const files = []

  if (ignorePath) {
    files.push(isAbsolute(ignorePath) ? ignorePath : join(cwd, ignorePath))
  } else {
    files.push(join(cwd, DEFAULT_IGNORE_FILE))
  }

  for (const pattern of DEFAULT_PATTERNS) {
    addPatternFromLine(pattern, patterns)
  }

  for (const filePath of files) {
    let content
    try {
      content = await readFile(filePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue
      }
      throw error
    }

    for (const rawLine of content.split(/\r?\n/)) {
      addPatternFromLine(rawLine, patterns)
    }
  }

  return {
    ignores(targetPath, { isDir = false } = {}) {
      if (patterns.length === 0) {
        return false
      }

      const rel = toPosixPath(relative(cwd, targetPath))
      const abs = toPosixPath(targetPath)
      const relValue = rel === '' ? '.' : rel

      const candidates = []
      if (!rel.startsWith('..')) {
        candidates.push(relValue)
      }
      candidates.push(abs)
      if (isDir) {
        if (!rel.startsWith('..')) {
          candidates.push(`${relValue}/`)
        }
        candidates.push(`${abs.replace(/\/+$/, '')}/`)
      }

      let ignored = false
      for (const pattern of patterns) {
        const matched = candidates.some((candidate) => pattern.regex.test(candidate))
        if (!matched) continue
        ignored = !pattern.negated
      }
      return ignored
    }
  }
}

function ensureLeadingDoubleStar(pattern) {
  if (pattern.startsWith('**/')) {
    return pattern
  }
  return `**/${pattern}`
}

function toPosixPath(path) {
  return toPosix(path.split(sep).join('/'))
}

function addPatternFromLine(rawLine, patterns) {
  let pattern = rawLine.trim()
  if (!pattern || pattern.startsWith('#')) {
    return
  }

  let negated = false
  if (pattern.startsWith('!')) {
    negated = true
    pattern = pattern.slice(1)
  }

  let directoryOnly = false
  if (pattern.endsWith('/')) {
    directoryOnly = true
    pattern = pattern.slice(0, -1)
  }

  const anchored = pattern.startsWith('/')
  if (anchored) {
    pattern = pattern.slice(1)
  }

  if (!pattern) {
    return
  }

  const globPattern = anchored ? pattern : ensureLeadingDoubleStar(pattern)
  const regexes = []
  regexes.push(globToRegExp(globPattern))
  if (directoryOnly) {
    regexes.push(globToRegExp(`${globPattern}/**`))
  }

  for (const regex of regexes) {
    patterns.push({ regex, negated })
  }
}
