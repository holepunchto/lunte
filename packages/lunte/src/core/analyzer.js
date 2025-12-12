import { readFile, writeFile } from 'fs/promises'
import { basename } from 'path'

import { parse } from './parser.js'
import { resolveConfig } from '../config/resolve.js'
import { ENV_GLOBALS } from '../config/envs.js'
import { extractFileDirectives } from './file-directives.js'
import { runRules } from './rule-runner.js'
import { buildInlineIgnoreMatcher } from './inline-ignores.js'
import { applyFixes } from './fixes.js'

export async function analyze({
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

  for (const file of files) {
    const result = await analyzeFile(file, {
      ruleConfig,
      baseGlobals,
      sourceOverrides,
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

  return { diagnostics, fixedEdits, fixedDiagnostics, fixedFiles, fixedOutputs }
}

async function analyzeFile(filePath, { ruleConfig, baseGlobals, sourceOverrides, fix, write }) {
  const diagnostics = []
  let source
  if (sourceOverrides?.has(filePath)) {
    source = sourceOverrides.get(filePath)
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
      return { diagnostics }
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
      const run = (currentSource) => {
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
        if (write) {
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
      diagnostics.push(buildParseErrorDiagnostic({ error, filePath, source }))
    }
  }

  return { diagnostics }
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
