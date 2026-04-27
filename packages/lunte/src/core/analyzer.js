import { readFile, writeFile } from 'fs/promises'
import { extname } from 'path'

import { parse } from './parser.js'
import { resolveConfig } from '../config/resolve.js'
import { ENV_GLOBALS } from '../config/envs.js'
import { extractFileDirectives } from './file-directives.js'
import { runRules } from './rule-runner.js'
import { buildInlineIgnoreMatcher } from './inline-ignores.js'
import { applyFixes } from './fixes.js'

const NO_INLINE_IGNORES = {
  shouldIgnore() {
    return false
  }
}

export async function analyze({
  source,
  sourceFile,
  files,
  ruleOverrides,
  envOverrides,
  globalOverrides,
  sourceOverrides,
  onFileComplete,
  disableHolepunchGlobals = false,
  fix = false,
  write = true
}) {
  const diagnostics = []
  const { ruleConfig, globals: baseGlobals } = resolveConfig({
    ruleOverrides,
    envNames: envOverrides,
    globals: globalOverrides,
    disableHolepunchGlobals
  })

  let fixedEdits = 0
  let fixedDiagnostics = 0
  let fixedFiles = 0
  const fixedOutputs = new Map()

  if (source !== undefined) {
    const result = await analyzeSource(String(source), {
      filePath: sourceFile,
      ruleConfig,
      baseGlobals,
      fix,
      write: false
    })
    diagnostics.push(...result.diagnostics)

    if (fix && result.fixes?.appliedEdits > 0) {
      fixedEdits += result.fixes.appliedEdits
      fixedDiagnostics += result.fixes.appliedDiagnostics
      fixedFiles += 1
      fixedOutputs.set(sourceFile ?? 'input', result.fixes.output)
    }
  } else {
    const normalizedSourceOverrides = normalizeSourceOverrides(sourceOverrides)

    for (const file of files) {
      const result = await analyzeFile(file, {
        ruleConfig,
        baseGlobals,
        sourceOverrides: normalizedSourceOverrides,
        fix,
        write
      })
      diagnostics.push(...result.diagnostics)

      if (fix && result.fixes?.appliedEdits > 0) {
        fixedEdits += result.fixes.appliedEdits
        fixedDiagnostics += result.fixes.appliedDiagnostics
        fixedFiles += 1
        fixedOutputs.set(file, result.fixes.output)
      }

      if (typeof onFileComplete === 'function') {
        onFileComplete({
          filePath: file,
          diagnostics: result.diagnostics
        })
      }
    }
  }

  return { diagnostics, fixedEdits, fixedDiagnostics, fixedFiles, fixedOutputs }
}

async function analyzeFile(filePath, { ruleConfig, baseGlobals, sourceOverrides, fix, write }) {
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

  return analyzeSource(source, { filePath, ruleConfig, baseGlobals, fix, write })
}

async function analyzeSource(
  source,
  { filePath, ruleConfig, baseGlobals, fix = false, write = true }
) {
  const diagnostics = []
  const run = createSourceRunner({ filePath, ruleConfig, baseGlobals })

  try {
    const initialDiagnostics = run(source)

    if (!fix) {
      diagnostics.push(...initialDiagnostics)
      return { diagnostics }
    }

    const applied = applyFixes({
      source,
      diagnostics: initialDiagnostics
    })

    if (applied.appliedEdits > 0) {
      if (write && filePath) {
        await writeFile(filePath, applied.output, 'utf8')
      }

      const afterFixDiagnostics = run(applied.output)
      diagnostics.push(...afterFixDiagnostics)

      return {
        diagnostics,
        fixes: {
          appliedEdits: applied.appliedEdits,
          appliedDiagnostics: applied.appliedDiagnostics,
          output: applied.output
        }
      }
    }

    diagnostics.push(...initialDiagnostics)
  } catch (error) {
    diagnostics.push(
      isJsonFile(filePath)
        ? buildJsonParseDiagnostic({ error, filePath, source })
        : buildParseErrorDiagnostic({ error, filePath, source })
    )
  }

  return { diagnostics }
}

function createSourceRunner({ filePath, ruleConfig, baseGlobals }) {
  if (isJsonFile(filePath)) {
    return (currentSource) => runJsonRules(currentSource, { filePath, ruleConfig, baseGlobals })
  }

  return (currentSource) => runJavaScriptRules(currentSource, {
    filePath,
    ruleConfig,
    baseGlobals
  })
}

function runJavaScriptRules(currentSource, { filePath, ruleConfig, baseGlobals }) {
  const directives = extractFileDirectives(currentSource)
  const globals = mergeGlobals(baseGlobals, directives)
  const comments = []
  const ast = parse(currentSource, {
    filePath,
    sourceFile: filePath,
    onComment: comments
  })
  const inlineIgnores = buildInlineIgnoreMatcher(comments)
  return runRules({
    ast,
    filePath,
    source: currentSource,
    ruleConfig,
    globals,
    inlineIgnores
  })
}

function runJsonRules(currentSource, { filePath, ruleConfig, baseGlobals }) {
  JSON.parse(currentSource)

  const ast = parseJsonAst(currentSource, { filePath })
  return runRules({
    ast,
    filePath,
    source: currentSource,
    ruleConfig,
    globals: baseGlobals,
    inlineIgnores: NO_INLINE_IGNORES
  })
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
    column: loc?.column !== undefined ? loc.column + 1 : undefined
  }
}

function buildJsonParseDiagnostic({ error, filePath, source }) {
  const location = inferJsonErrorLocation(error, source)
  return {
    filePath,
    message: `Invalid JSON: ${error.message}`,
    severity: 'error',
    line: location.line,
    column: location.column
  }
}

function inferLineFromError(error, source) {
  if (typeof error.pos !== 'number') {
    return undefined
  }

  const upToPos = source.slice(0, error.pos)
  return upToPos.split(/\r?\n/).length
}

function inferJsonErrorLocation(error, source) {
  const lineColumnMatch = /\(line (\d+) column (\d+)\)/.exec(error.message)
  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2])
    }
  }

  const positionMatch = /at position (\d+)/.exec(error.message)
  if (positionMatch) {
    return offsetToLineColumn(source, Number(positionMatch[1]))
  }

  return { line: 1, column: 1 }
}

function parseJsonAst(source, { filePath } = {}) {
  const wrapped = `(${source})`
  const wrappedAst = parse(wrapped, {
    filePath,
    sourceFile: filePath
  })
  const expression = wrappedAst.body[0]?.expression

  if (!expression) {
    throw new Error('Failed to parse JSON source.')
  }

  shiftNodeOffsets(expression, -1)

  const expressionStatement = {
    type: 'ExpressionStatement',
    start: expression.start,
    end: expression.end,
    range: [expression.start, expression.end],
    loc: cloneLoc(expression.loc),
    expression
  }

  return {
    type: 'Program',
    start: 0,
    end: source.length,
    range: [0, source.length],
    loc: {
      start: { line: 1, column: 0 },
      end: offsetToLoc(source, source.length)
    },
    body: [expressionStatement],
    sourceType: 'module'
  }
}

function shiftNodeOffsets(node, offset) {
  if (!node || typeof node !== 'object') {
    return
  }

  if (typeof node.start === 'number') {
    node.start += offset
  }
  if (typeof node.end === 'number') {
    node.end += offset
  }
  if (Array.isArray(node.range)) {
    node.range = node.range.map((value) => (typeof value === 'number' ? value + offset : value))
  }
  if (node.loc) {
    shiftLoc(node.loc.start)
    shiftLoc(node.loc.end)
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') {
      continue
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === 'string') {
          shiftNodeOffsets(child, offset)
        }
      }
      continue
    }
    if (typeof value.type === 'string') {
      shiftNodeOffsets(value, offset)
    }
  }
}

function shiftLoc(position) {
  if (position?.line === 1 && typeof position.column === 'number') {
    position.column -= 1
  }
}

function offsetToLineColumn(source, offset) {
  const loc = offsetToLoc(source, offset)
  return {
    line: loc.line,
    column: loc.column + 1
  }
}

function offsetToLoc(source, offset) {
  const safeOffset = Math.max(0, Math.min(offset, source.length))
  const upToOffset = source.slice(0, safeOffset)
  const lines = upToOffset.split(/\r?\n/)
  return {
    line: lines.length,
    column: lines[lines.length - 1].length
  }
}

function cloneLoc(loc) {
  if (!loc) {
    return undefined
  }

  return {
    start: { ...loc.start },
    end: { ...loc.end }
  }
}

function isJsonFile(filePath) {
  if (!filePath) {
    return false
  }

  return extname(filePath).toLowerCase() === '.json'
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
