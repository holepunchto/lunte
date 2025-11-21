import { readFile } from 'fs/promises'
import { basename } from 'path'

import { parse, isDeclarationFile } from './parser.js'
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
  const ambientGlobals = enableTypeScriptParser
    ? await collectAmbientGlobals(files, { sourceOverrides })
    : new Set()

  for (const file of files) {
    const result = await analyzeFile(file, {
      ruleConfig,
      baseGlobals,
      sourceOverrides,
      enableTypeScriptParser,
      ambientGlobals
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
  { ruleConfig, baseGlobals, sourceOverrides, enableTypeScriptParser, ambientGlobals }
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
      const globals = mergeGlobals(baseGlobals, directives, ambientGlobals)
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

function mergeGlobals(baseGlobals, directives, ambientGlobals) {
  if (
    directives.envs.size === 0 &&
    directives.globals.size === 0 &&
    (!ambientGlobals || ambientGlobals.size === 0)
  ) {
    return baseGlobals
  }

  const globals = new Set(baseGlobals)

  if (ambientGlobals) {
    for (const name of ambientGlobals) {
      globals.add(name)
    }
  }

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

async function collectAmbientGlobals(files, { sourceOverrides }) {
  const ambient = new Set()
  for (const filePath of files) {
    if (!isDeclarationFile(filePath)) continue

    let source
    if (sourceOverrides?.has(filePath)) {
      source = String(sourceOverrides.get(filePath) ?? '')
    } else {
      try {
        source = await readFile(filePath, 'utf8')
      } catch (error) {
        continue
      }
    }

    try {
      const ast = parse(source, {
        filePath,
        enableTypeScriptParser: true,
        sourceFile: filePath
      })
      collectAmbientFromAst(ast, ambient)
    } catch (error) {
      // Ignore parse errors here; the main analysis pass will report them.
    }
  }
  return ambient
}

function collectAmbientFromAst(ast, target) {
  if (!ast || !Array.isArray(ast.body)) {
    return
  }
  const allowScriptGlobals = !hasModuleSyntax(ast)
  const context = {
    allowScriptGlobals,
    inGlobalAugmentation: false
  }
  collectAmbientFromStatements(ast.body, context, target)
}

function collectAmbientFromStatements(statements, context, target) {
  if (!Array.isArray(statements)) return
  for (const statement of statements) {
    collectAmbientFromNode(statement, context, target)
  }
}

function collectAmbientFromNode(node, context, target) {
  if (!node || typeof node.type !== 'string') return
  const canRegister = context.inGlobalAugmentation || context.allowScriptGlobals

  switch (node.type) {
    case 'VariableDeclaration':
      if (!canRegister) break
      if (node.declare || context.inGlobalAugmentation) {
        for (const declarator of node.declarations ?? []) {
          addPatternIdentifiers(declarator.id, target)
        }
      }
      break
    case 'FunctionDeclaration':
      if ((node.declare || context.inGlobalAugmentation) && node.id) {
        target.add(node.id.name)
      }
      break
    case 'TSDeclareFunction':
      if ((canRegister || context.inGlobalAugmentation) && node.id) {
        target.add(node.id.name)
      }
      break
    case 'ClassDeclaration':
      if ((node.declare || context.inGlobalAugmentation) && node.id) {
        target.add(node.id.name)
      }
      break
    case 'TSEnumDeclaration':
      if ((node.declare || context.inGlobalAugmentation) && node.id) {
        target.add(node.id.name)
      }
      break
    case 'TSModuleDeclaration': {
      const moduleName = getModuleName(node.id)
      const isGlobalAugmentation = Boolean(node.global) || moduleName === 'global'
      if (isGlobalAugmentation) {
        const statements = getModuleBlockStatements(node.body)
        collectAmbientFromStatements(statements, { ...context, inGlobalAugmentation: true }, target)
        break
      }
      if (!canRegister || !node.declare) {
        break
      }
      if (moduleName && node.id.type === 'Identifier' && moduleHasRuntimeValue(node)) {
        target.add(moduleName)
      }
      break
    }
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
      if (node.declaration) {
        collectAmbientFromNode(node.declaration, context, target)
      }
      break
    default:
      break
  }
}

function addPatternIdentifiers(pattern, target) {
  if (!pattern) return
  switch (pattern.type) {
    case 'Identifier':
      target.add(pattern.name)
      break
    case 'ObjectPattern':
      for (const prop of pattern.properties ?? []) {
        if (prop.type === 'RestElement') {
          addPatternIdentifiers(prop.argument, target)
        } else {
          addPatternIdentifiers(prop.value, target)
        }
      }
      break
    case 'ArrayPattern':
      for (const element of pattern.elements ?? []) {
        addPatternIdentifiers(element, target)
      }
      break
    case 'RestElement':
      addPatternIdentifiers(pattern.argument, target)
      break
    case 'AssignmentPattern':
      addPatternIdentifiers(pattern.left, target)
      break
    default:
      break
  }
}

function getModuleName(id) {
  if (!id) return null
  if (id.type === 'Identifier') {
    return id.name
  }
  if (id.type === 'Literal' && typeof id.value === 'string') {
    return id.value
  }
  return null
}

function getModuleBlockStatements(body) {
  if (!body) return []
  if (body.type === 'TSModuleBlock') {
    return body.body ?? []
  }
  if (body.type === 'TSModuleDeclaration') {
    return getModuleBlockStatements(body.body)
  }
  return []
}

function moduleHasRuntimeValue(moduleNode) {
  const statements = getModuleBlockStatements(moduleNode.body)
  for (const statement of statements) {
    if (isValueLikeStatement(statement)) {
      return true
    }
    if (statement.type === 'TSModuleDeclaration' && moduleHasRuntimeValue(statement)) {
      return true
    }
  }
  return false
}

function isValueLikeStatement(node) {
  if (!node || typeof node.type !== 'string') {
    return false
  }
  switch (node.type) {
    case 'VariableDeclaration':
    case 'FunctionDeclaration':
    case 'TSDeclareFunction':
    case 'ClassDeclaration':
    case 'TSEnumDeclaration':
      return true
    default:
      return false
  }
}

function hasModuleSyntax(ast) {
  return Array.isArray(ast?.body) && ast.body.some(isModuleSyntaxNode)
}

function isModuleSyntaxNode(node) {
  if (!node) return false
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExportDefaultDeclaration':
    case 'ExportNamedDeclaration':
    case 'TSExportAssignment':
      return true
    default:
      return false
  }
}
