import { parse } from './parser.js'
import { resolveConfig } from '../config/resolve.js'
import { ENV_GLOBALS } from '../config/envs.js'
import { extractFileDirectives } from './file-directives.js'
import { runRules } from './rule-runner.js'
import { buildInlineIgnoreMatcher } from './inline-ignores.js'

export async function analyze({
  files,
  ruleOverrides,
  envOverrides,
  globalOverrides,
  sourceText
}) {
  const diagnostics = []
  const { ruleConfig, globals: baseGlobals } = resolveConfig({
    ruleOverrides,
    envNames: envOverrides,
    globals: globalOverrides
  })

  const sourceOverrides = normalizeSourceOverrides(sourceText)

  for (const file of files) {
    const result = await analyzeFile(file, {
      ruleConfig,
      baseGlobals,
      sourceOverrides
    })
    diagnostics.push(...result.diagnostics)
  }

  return { diagnostics }
}

async function analyzeFile(filePath, { ruleConfig, baseGlobals, sourceOverrides }) {
  const diagnostics = []
  let source
  const hasOverride = sourceOverrides?.has(filePath)

  if (hasOverride) {
    source = String(sourceOverrides.get(filePath) ?? '')
  } else {
    try {
      source = await readFileText(filePath)
    } catch (error) {
      diagnostics.push({
        filePath,
        message: error.code === 'ENOENT' ? 'File not found' : error.message,
        severity: 'error'
      })
      return { diagnostics }
    }
  }

  try {
    const directives = extractFileDirectives(source)
    const globals = mergeGlobals(baseGlobals, directives)
    const comments = []
    const ast = parse(source, { sourceFile: filePath, onComment: comments })
    const inlineIgnores = buildInlineIgnoreMatcher(comments)
    const ruleDiagnostics = runRules({
      ast,
      filePath,
      source,
      ruleConfig,
      globals,
      inlineIgnores
    })
    diagnostics.push(...ruleDiagnostics)
  } catch (error) {
    diagnostics.push(buildParseErrorDiagnostic({ error, filePath, source }))
  }

  return { diagnostics }
}

async function readFileText(filePath) {
  const { readFile } = await import('node:fs/promises')
  return readFile(filePath, 'utf8')
}

function normalizeSourceOverrides(value) {
  if (!value) {
    return new Map()
  }
  if (value instanceof Map) {
    return value
  }
  if (typeof value === 'object') {
    return new Map(Object.entries(value))
  }
  return new Map()
}

function buildParseErrorDiagnostic({ error, filePath, source }) {
  const { loc } = error
  return {
    filePath,
    message: error.message,
    severity: 'error',
    line: loc?.line ?? inferLineFromError(error, source),
    column: loc?.column != null ? loc.column + 1 : undefined
  }
}

function inferLineFromError(error, source) {
  if (typeof error.pos !== 'number') {
    return undefined
  }

  const upToPos = source.slice(0, error.pos)
  return upToPos.split(/\r?\n/).length
}

function mergeGlobals(baseGlobals, directives) {
  const globals = new Set(baseGlobals)

  for (const envName of directives.envs) {
    const envGlobals = ENV_GLOBALS[envName]
    if (!envGlobals) continue
    for (const name of envGlobals) {
      globals.add(name)
    }
  }

  for (const name of directives.globals) {
    globals.add(name)
  }

  return globals
}
