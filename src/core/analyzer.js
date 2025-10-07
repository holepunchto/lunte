import { parse } from './parser.js'
import { runRules } from './rule-runner.js'
import { resolveConfig } from '../config/resolve.js'
import { ENV_GLOBALS } from '../config/envs.js'
import { extractFileDirectives } from './file-directives.js'

export async function analyze({ files, ruleOverrides, envOverrides, globalOverrides }) {
  const diagnostics = []
  const { ruleConfig, globals: baseGlobals } = resolveConfig({
    ruleOverrides,
    envNames: envOverrides,
    globals: globalOverrides
  })

  for (const file of files) {
    const result = await analyzeFile(file, { ruleConfig, baseGlobals })
    diagnostics.push(...result.diagnostics)
  }

  return { diagnostics }
}

async function analyzeFile(filePath, { ruleConfig, baseGlobals }) {
  const diagnostics = []
  let source

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

  try {
    const directives = extractFileDirectives(source)
    const globals = mergeGlobals(baseGlobals, directives)
    const ast = parse(source, { sourceFile: filePath })
    const ruleDiagnostics = runRules({ ast, filePath, source, ruleConfig, globals })
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
