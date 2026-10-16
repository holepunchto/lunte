import process from 'process'
import { readFile } from 'fs/promises'
import { dirname, isAbsolute, join, relative } from 'path'

import { globToRegExp, toPosix } from './glob.js'

const DEFAULT_IGNORE_FILE = '.lunteignore'
const DEFAULT_PATTERNS = ['node_modules/']

export async function loadIgnore({ cwd = process.cwd(), ignorePath } = {}) {
  const absoluteIgnorePath = ignorePath
    ? isAbsolute(ignorePath)
      ? ignorePath
      : join(cwd, ignorePath)
    : join(cwd, DEFAULT_IGNORE_FILE)

  const basePatterns = []
  const cache = new Map()

  for (const pattern of DEFAULT_PATTERNS) {
    addPatternFromLine(pattern, basePatterns, { base: '' })
  }

  await appendIgnoreFile({ filePath: absoluteIgnorePath, cwd, patterns: basePatterns })

  const rootContext = new IgnoreContext({ cwd, patterns: basePatterns, cache })
  cache.set(toPosixPath(cwd), Promise.resolve(rootContext))
  return rootContext
}

function ensureLeadingDoubleStar(pattern) {
  if (pattern.startsWith('**/')) {
    return pattern
  }
  return `**/${pattern}`
}

function toPosixPath(path) {
  const converted = toPosix(path)
  if (converted === '.') return ''
  return converted
}

function addPatternFromLine(rawLine, patterns, { base }) {
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

  while (pattern.startsWith('./')) {
    pattern = pattern.slice(2)
  }

  if (!pattern) {
    return
  }

  const basePrefix = base ? `${base}/` : ''
  const normalized = anchored ? pattern : ensureLeadingDoubleStar(pattern)
  const globPattern = basePrefix ? `${basePrefix}${normalized}` : normalized
  const regexes = []
  regexes.push(globToRegExp(globPattern))
  if (directoryOnly) {
    regexes.push(globToRegExp(`${globPattern}/**`))
  }

  for (const regex of regexes) {
    patterns.push({ regex, negated })
  }
}

async function appendIgnoreFile({ filePath, cwd, patterns }) {
  const dir = dirname(filePath)
  let content
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      return
    }
    throw error
  }

  const base = toPosixPath(relative(cwd, dir))
  for (const rawLine of content.split(/\r?\n/)) {
    addPatternFromLine(rawLine, patterns, { base })
  }
}

class IgnoreContext {
  constructor({ cwd, patterns, cache }) {
    this.cwd = cwd
    this.patterns = patterns
    this.cache = cache
  }

  async extend(directory) {
    const key = toPosixPath(directory)
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const promise = this.#buildChild(directory)
    this.cache.set(key, promise)
    return promise
  }

  async #buildChild(directory) {
    const nextPatterns = this.patterns.slice()
    await appendIgnoreFile({
      filePath: join(directory, DEFAULT_IGNORE_FILE),
      cwd: this.cwd,
      patterns: nextPatterns
    })
    return new IgnoreContext({ cwd: this.cwd, patterns: nextPatterns, cache: this.cache })
  }

  ignores(targetPath, { isDir = false } = {}) {
    if (this.patterns.length === 0) {
      return false
    }

    const rel = toPosixPath(relative(this.cwd, targetPath))
    const abs = toPosixPath(targetPath)
    const relValue = rel === '' ? '.' : rel
    const withinCwd = rel !== '' && !rel.startsWith('..')
    const normalizedAbs = abs.endsWith('/') ? abs.replace(/\/+$/, '') : abs

    const candidates = []
    if (withinCwd || rel === '') {
      candidates.push(relValue)
      if (isDir) {
        candidates.push(`${relValue}/`)
      }
    } else {
      candidates.push(abs)
      if (isDir) {
        candidates.push(`${normalizedAbs}/`)
      }
    }

    let ignored = false
    for (const pattern of this.patterns) {
      const matched = candidates.some((candidate) => pattern.regex.test(candidate))
      if (!matched) continue
      ignored = !pattern.negated
    }
    return ignored
  }
}
