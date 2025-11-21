import { readFile } from 'fs/promises'
import { basename } from 'path'

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
  sourceText,
  onFileComplete,
  disableHolepunchGlobals = false,
  enableTypeScriptParser = false
}) {
  const diagnostics = []
  const { ruleConfig, globals: baseGlobals } = resolveConfig({
    ruleOverrides,
    envNames: envOverrides,
    globals: globalOverrides,
    disableHolepunchGlobals
  })

  const sourceOverrides = normalizeSourceOverrides(sourceText)

  for (const file of files) {
    const result = await analyzeFile(file, {
      ruleConfig,
      baseGlobals,
      sourceOverrides,
      enableTypeScriptParser
    })
    diagnostics.push(...result.diagnostics)

    if (typeof onFileComplete === 'function') {
      onFileComplete({
        filePath: file,
        diagnostics: result.diagnostics
      })
    }
  }

  return { diagnostics }
}

async function analyzeFile(
  filePath,
  { ruleConfig, baseGlobals, sourceOverrides, enableTypeScriptParser }
) {
  const diagnostics = []
  let source
  if (sourceOverrides?.has(filePath)) {
    source = String(sourceOverrides.get(filePath) ?? '')
  } else {
    try {
      source = await readFile(filePath, 'utf8')
    } catch (error) {
      diagnostics.push({
        filePath,
        message: error.code === 'ENOENT' ? 'File not found' : error.message,
        severity: 'error'
      })
      return { diagnostics }
    }
  }

  const filename = basename(filePath)
  if (filename === 'package.json') {
    try {
      // Validate it's valid JSON
      JSON.parse(source)

      // Create a minimal AST
      const ast = {
        type: 'Program',
        body: [],
        sourceType: 'module'
      }

      const ruleDiagnostics = runRules({
        ast,
        filePath,
        source,
        ruleConfig,
        globals: baseGlobals,
        inlineIgnores: { shouldIgnore: () => false }
      })
      diagnostics.push(...ruleDiagnostics)
    } catch (error) {
      diagnostics.push({
        filePath,
        message: `Invalid JSON: ${error.message}`,
        severity: 'error',
        line: 1
      })
    }
  } else {
    try {
      const directives = extractFileDirectives(source)
      const globals = mergeGlobals(baseGlobals, directives)
      const comments = []
      const ast = parse(source, {
        filePath,
        enableTypeScriptParser,
        sourceFile: filePath,
        onComment: comments
      })
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
  }

  return { diagnostics }
}

function normalizeSourceOverrides(value) {
  if (!value) {
    return undefined
  }
  if (value instanceof Map) {
    return value
  }
  if (typeof value === 'object') {
    return new Map(Object.entries(value))
  }
  return undefined
}

function buildParseErrorDiagnostic({ error, filePath, source }) {
  const { loc } = error
  return {
    filePath,
    message: error.message,
    severity: 'error',
    line: loc?.line ?? inferLineFromError(error, source),
    column: loc?.column !== null && loc?.column !== undefined ? loc.column + 1 : undefined
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
  if (directives.envs.size === 0 && directives.globals.size === 0) {
    return baseGlobals
  }

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
