import process from 'process'
import { readFile, readdir, stat } from 'fs/promises'
import { basename, dirname, join } from 'path'

import { parse, isDeclarationFile, isTypeScriptLike, isJsxFile } from './parser.js'
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
  disableHolepunchGlobals = false
}) {
  const diagnostics = []
  const { ruleConfig, globals: baseGlobals } = resolveConfig({
    ruleOverrides,
    envNames: envOverrides,
    globals: globalOverrides,
    disableHolepunchGlobals
  })

  const sourceOverrides = normalizeSourceOverrides(sourceText)
  const needsTypeScript = files.some((file) => isTypeScriptLike(file) || isJsxFile(file))
  const ambientGlobals = needsTypeScript
    ? await collectAmbientGlobals(files, { sourceOverrides, includeDependencies: needsTypeScript })
    : new Set()

  for (const file of files) {
    const result = await analyzeFile(file, {
      ruleConfig,
      baseGlobals,
      sourceOverrides,
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
  { ruleConfig, baseGlobals, sourceOverrides, ambientGlobals }
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

async function collectAmbientGlobals(files, { sourceOverrides, includeDependencies = false }) {
  const ambient = new Set()

  await collectAmbientFromDeclarationFiles(files, ambient, { sourceOverrides })

  if (includeDependencies) {
    const dependencyGlobals = await collectDependencyAmbientGlobals(files, { sourceOverrides })
    for (const name of dependencyGlobals) {
      ambient.add(name)
    }
  }

  return ambient
}

async function collectAmbientFromDeclarationFiles(files, target, { sourceOverrides }) {
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
      collectAmbientFromAst(ast, target)
    } catch (error) {
      // Ignore parse errors here; the main analysis pass will report them.
    }
  }
}

async function collectDependencyAmbientGlobals(files, { sourceOverrides }) {
  const ambient = new Set()
  const processedFiles = new Set()
  const nodeModulesRoots = await findNodeModulesRoots(files)

  for (const nodeModulesDir of nodeModulesRoots) {
    await collectAmbientFromNodeModulesDir(nodeModulesDir, ambient, processedFiles, { sourceOverrides })
  }

  return ambient
}

async function findNodeModulesRoots(files) {
  const roots = new Set()
  const startingPoints = new Set()
  for (const file of files) {
    startingPoints.add(dirname(file))
  }
  startingPoints.add(process.cwd())

  for (const start of startingPoints) {
    let dir = start
    while (true) {
      const candidate = join(dir, 'node_modules')
      try {
        const stats = await stat(candidate)
        if (stats.isDirectory()) {
          roots.add(candidate)
        }
      } catch (error) {
        // ignore
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }

  return roots
}

async function collectAmbientFromNodeModulesDir(nodeModulesDir, target, processedFiles, { sourceOverrides }) {
  let entries
  try {
    entries = await readdir(nodeModulesDir, { withFileTypes: true })
  } catch (error) {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    if (entry.name.startsWith('@')) {
      const scopeDir = join(nodeModulesDir, entry.name)
      let scopedEntries
      try {
        scopedEntries = await readdir(scopeDir, { withFileTypes: true })
      } catch (error) {
        continue
      }

      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory()) continue
        await collectAmbientFromPackage(join(scopeDir, scopedEntry.name), target, processedFiles, {
          sourceOverrides
        })
      }
      continue
    }

    await collectAmbientFromPackage(join(nodeModulesDir, entry.name), target, processedFiles, {
      sourceOverrides
    })
  }
}

async function collectAmbientFromPackage(pkgDir, target, processedFiles, { sourceOverrides }) {
  const pkgJsonPath = join(pkgDir, 'package.json')
  let pkg
  try {
    pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
  } catch (error) {
    return
  }

  const candidatePaths = new Set()
  const typesEntry =
    typeof pkg.types === 'string'
      ? pkg.types
      : typeof pkg.typings === 'string'
        ? pkg.typings
        : null

  if (typesEntry) {
    candidatePaths.add(join(pkgDir, typesEntry))
  }

  candidatePaths.add(join(pkgDir, 'index.d.ts'))
  candidatePaths.add(join(pkgDir, 'index.d.mts'))
  candidatePaths.add(join(pkgDir, 'index.d.cts'))
  candidatePaths.add(join(pkgDir, 'global.d.ts'))
  candidatePaths.add(join(pkgDir, 'global.d.mts'))
  candidatePaths.add(join(pkgDir, 'global.d.cts'))
  candidatePaths.add(join(pkgDir, 'globals.d.ts'))
  candidatePaths.add(join(pkgDir, 'globals.d.mts'))
  candidatePaths.add(join(pkgDir, 'globals.d.cts'))
  candidatePaths.add(join(pkgDir, 'types', 'index.d.ts'))
  candidatePaths.add(join(pkgDir, 'types', 'index.d.mts'))
  candidatePaths.add(join(pkgDir, 'types', 'index.d.cts'))
  candidatePaths.add(join(pkgDir, 'types', 'global.d.ts'))
  candidatePaths.add(join(pkgDir, 'types', 'global.d.mts'))
  candidatePaths.add(join(pkgDir, 'types', 'global.d.cts'))
  candidatePaths.add(join(pkgDir, 'types', 'globals.d.ts'))
  candidatePaths.add(join(pkgDir, 'types', 'globals.d.mts'))
  candidatePaths.add(join(pkgDir, 'types', 'globals.d.cts'))

  if (pkg.name && String(pkg.name).startsWith('@types/')) {
    candidatePaths.add(join(pkgDir, 'index.d.ts'))
  }

  for (const candidate of candidatePaths) {
    await collectAmbientFromDeclarationFile(candidate, target, processedFiles, { sourceOverrides })
  }
}

async function collectAmbientFromDeclarationFile(filePath, target, processedFiles, { sourceOverrides }) {
  if (processedFiles.has(filePath)) {
    return
  }
  processedFiles.add(filePath)

  let fileInfo
  try {
    fileInfo = await stat(filePath)
  } catch (error) {
    return
  }

  if (fileInfo.isDirectory()) {
    const indexCandidate = join(filePath, 'index.d.ts')
    try {
      const indexInfo = await stat(indexCandidate)
      if (indexInfo.isFile()) {
        await collectAmbientFromDeclarationFile(indexCandidate, target, processedFiles, { sourceOverrides })
      }
    } catch (error) {
      // ignore
    }
    return
  }

  if (!isDeclarationFile(filePath)) {
    return
  }

  let source
  if (sourceOverrides?.has(filePath)) {
    source = String(sourceOverrides.get(filePath) ?? '')
  } else {
    try {
      source = await readFile(filePath, 'utf8')
    } catch (error) {
      return
    }
  }

  try {
    const ast = parse(source, {
      filePath,
      enableTypeScriptParser: true,
      sourceFile: filePath
    })
    collectAmbientFromAst(ast, target)
  } catch (error) {
    // Skip parse errors; these files can still be linted directly if needed.
  }
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
