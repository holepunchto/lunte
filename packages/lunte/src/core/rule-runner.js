import { ScopeManager } from './scope-manager.js'
import { RuleContext } from './rule-context.js'
import { builtInRules } from '../rules/index.js'
import { Severity } from './constants.js'
import { getDefaultRuleConfig } from '../config/defaults.js'

const DEFAULT_IGNORE_MATCHER = {
  shouldIgnore() {
    return false
  }
}

export function runRules({ ast, filePath, source, ruleConfig, globals, inlineIgnores }) {
  const effectiveConfig = ruleConfig ?? getDefaultRuleConfig()
  const activeRules = []

  const ignoreMatcher = inlineIgnores ?? DEFAULT_IGNORE_MATCHER

  for (const [name, rule] of builtInRules.entries()) {
    const config = effectiveConfig.get(name) ?? {
      severity: rule.meta?.defaultSeverity ?? Severity.error
    }
    if (!config || config.severity === Severity.off) {
      continue
    }
    activeRules.push({ name, rule, config })
  }

  const scopeManager = new ScopeManager()
  const diagnostics = []

  const ruleEntries = activeRules.map(({ rule, name, config }) => {
    const context = new RuleContext({
      filePath,
      source,
      diagnostics,
      scopeManager,
      ruleId: name,
      ruleSeverity: config.severity,
      globals,
      ignoreMatcher
    })
    const listeners = normalizeListeners(rule.create(context))
    return { context, listeners }
  })

  const state = {
    scopeManager,
    ruleEntries
  }

  traverse(ast, state, [])

  return diagnostics
}

function traverse(node, state, ancestors) {
  if (!node || typeof node.type !== 'string') {
    return
  }

  const parent = ancestors[ancestors.length - 1] ?? null

  const scopeType = getScopeType(node, parent)
  if (scopeType) {
    state.scopeManager.enterScope(scopeType, node)
    if (scopeType === 'program') {
      hoistProgramDeclarations(node, state.scopeManager)
    }
    hoistFunctionDeclarations(node, state.scopeManager)
    handleScopeIntroductions(node, state.scopeManager)
  }

  handleInScopeDeclarations(node, state.scopeManager)

  const nextAncestors = ancestors.concat(node)
  notifyListeners('enter', node, nextAncestors, ancestors, state)

  for (const child of iterateChildren(node)) {
    traverse(child, state, nextAncestors)
  }

  notifyListeners('exit', node, nextAncestors, ancestors, state)

  if (scopeType) {
    state.scopeManager.exitScope()
  }
}

function notifyListeners(phase, node, ancestors, parentAncestors, state) {
  const parent = parentAncestors[parentAncestors.length - 1] ?? null

  if (phase === 'enter') {
    recordReferenceIfNeeded(node, parent, state.scopeManager, parentAncestors)
  }

  for (const entry of state.ruleEntries) {
    const handlers = entry.listeners[phase].get(node.type)
    if (!handlers) continue
    entry.context.setTraversalState({ node, ancestors: parentAncestors })
    for (const handler of handlers) {
      handler(node)
    }
  }
}

function normalizeListeners(listenerMap) {
  const enter = new Map()
  const exit = new Map()

  for (const [selector, handler] of Object.entries(listenerMap)) {
    if (typeof handler === 'function') {
      if (selector.endsWith(':exit')) {
        const type = selector.slice(0, -5)
        pushHandler(exit, type, handler)
      } else {
        pushHandler(enter, selector, handler)
      }
      continue
    }

    if (handler && typeof handler === 'object') {
      if (typeof handler.enter === 'function') {
        pushHandler(enter, selector, handler.enter)
      }
      if (typeof handler.exit === 'function') {
        pushHandler(exit, selector, handler.exit)
      }
    }
  }

  return { enter, exit }
}

function pushHandler(store, type, handler) {
  if (!store.has(type)) {
    store.set(type, [])
  }
  store.get(type).push(handler)
}

function getScopeType(node, parent) {
  switch (node.type) {
    case 'Program':
      return 'program'
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return 'function'
    case 'BlockStatement':
      return 'block'
    case 'CatchClause':
      return 'block'
    case 'ForInStatement':
    case 'ForOfStatement':
      return 'block'
    case 'ClassExpression':
      return 'class'
    default:
      return null
  }
}

function handleScopeIntroductions(node, scopeManager) {
  if (node.type === 'Program') {
    return
  }

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    for (const param of node.params ?? []) {
      for (const { name, node: id } of extractPatternIdentifiers(param)) {
        scopeManager.declare(
          name,
          createDeclarationInfo(id, {
            kind: 'param',
            hoisted: true
          })
        )
      }
    }

    if (
      (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
      node.id
    ) {
      scopeManager.declare(
        node.id.name,
        createDeclarationInfo(node.id, {
          kind: 'function',
          hoisted: true
        })
      )
    }
  }

  if (node.type === 'CatchClause' && node.param) {
    for (const { name, node: id } of extractPatternIdentifiers(node.param)) {
      scopeManager.declare(
        name,
        createDeclarationInfo(id, {
          kind: 'catch',
          hoisted: true
        })
      )
    }
  }

  if (node.type === 'ClassExpression' && node.id) {
    scopeManager.declare(
      node.id.name,
      createDeclarationInfo(node.id, {
        kind: 'class',
        hoisted: false // Classes are not hoisted in JavaScript
      })
    )
  }
}

function handleInScopeDeclarations(node, scopeManager) {
  if (node.type === 'VariableDeclaration') {
    for (const declarator of node.declarations) {
      for (const { name, node: id, availableAt } of extractPatternIdentifiers(declarator.id)) {
        const hoisted = node.kind === 'var'
        const info = createDeclarationInfo(id, {
          kind: node.kind,
          hoisted,
          index: hoisted ? undefined : availableAt || inferTemporalDeadZoneIndex(declarator)
        })
        scopeManager.declare(name, info, { hoistTo: hoisted ? 'function' : undefined })
      }
    }
  }

  if (node.type === 'ImportDeclaration') {
    const declarationKind = node.importKind === 'type' ? 'type' : 'value'
    for (const specifier of node.specifiers) {
      const specifierKind = specifier.importKind ?? declarationKind
      if (specifierKind === 'type') {
        continue
      }
      const local = specifier.local
      scopeManager.declare(
        local.name,
        createDeclarationInfo(local, {
          kind: 'import',
          hoisted: true
        })
      )
    }
  }

  if (node.type === 'ClassDeclaration' && node.id) {
    scopeManager.declare(
      node.id.name,
      createDeclarationInfo(node.id, {
        kind: 'class',
        hoisted: false
      })
    )
  }

  if (node.type === 'TSImportEqualsDeclaration' && node.id && node.importKind !== 'type') {
    scopeManager.declare(
      node.id.name,
      createDeclarationInfo(node.id, {
        kind: 'import',
        hoisted: true
      })
    )
  }

  if (node.type === 'TSEnumDeclaration' && node.id && !node.declare) {
    scopeManager.declare(
      node.id.name,
      createDeclarationInfo(node.id, {
        kind: 'ts-enum',
        hoisted: false
      })
    )
  }

  if (node.type === 'TSModuleDeclaration' && !node.declare) {
    const name = getTSModuleIdentifier(node.id)
    if (name) {
      scopeManager.declare(
        name,
        createDeclarationInfo(node.id, {
          kind: 'ts-module',
          hoisted: false
        })
      )
    }
  }
}

function hoistFunctionDeclarations(node, scopeManager) {
  const body = getBodyStatements(node)
  if (!body) return

  for (const statement of body) {
    if (!statement) continue
    if (statement.type === 'FunctionDeclaration' && statement.id) {
      scopeManager.declare(
        statement.id.name,
        createDeclarationInfo(statement.id, {
          kind: 'function',
          hoisted: true
        }),
        { hoistTo: 'function' }
      )
      continue
    }

    if (
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration') &&
      statement.declaration
    ) {
      const decl = statement.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id) {
        scopeManager.declare(
          decl.id.name,
          createDeclarationInfo(decl.id, {
            kind: 'function',
            hoisted: true
          }),
          { hoistTo: 'function' }
        )
      } else if (decl.type === 'ClassDeclaration' && decl.id) {
        scopeManager.declare(
          decl.id.name,
          createDeclarationInfo(decl.id, {
            kind: 'class',
            hoisted: false // Classes are not hoisted in JavaScript
          })
        )
      }
    }
  }
}

function hoistProgramDeclarations(programNode, scopeManager) {
  if (!programNode || programNode.type !== 'Program') return

  for (const statement of programNode.body ?? []) {
    if (!statement) continue

    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        for (const { name, node: id } of extractPatternIdentifiers(declarator.id)) {
          const isVar = statement.kind === 'var'
          scopeManager.declare(
            name,
            createDeclarationInfo(id, {
              kind: statement.kind,
              hoisted: isVar
            }),
            isVar ? { hoistTo: 'function' } : undefined
          )
        }
      }
      continue
    }

    if (statement.type === 'FunctionDeclaration' && statement.id) {
      scopeManager.declare(
        statement.id.name,
        createDeclarationInfo(statement.id, {
          kind: 'function',
          hoisted: true
        }),
        { hoistTo: 'function' }
      )
      continue
    }

    if (statement.type === 'ClassDeclaration' && statement.id) {
      scopeManager.declare(
        statement.id.name,
        createDeclarationInfo(statement.id, {
          kind: 'class',
          hoisted: false // Classes are not hoisted in JavaScript
        })
      )
      continue
    }

    if (
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration') &&
      statement.declaration
    ) {
      const decl = statement.declaration
      if (decl.type === 'ClassDeclaration' && decl.id) {
        scopeManager.declare(
          decl.id.name,
          createDeclarationInfo(decl.id, {
            kind: 'class',
            hoisted: false // Classes are not hoisted in JavaScript
          })
        )
      }
    }
  }
}

function getBodyStatements(node) {
  switch (node.type) {
    case 'Program':
      return node.body
    case 'BlockStatement':
      return node.body
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      if (node.body && node.body.type === 'BlockStatement') {
        return node.body.body
      }
      return null
    default:
      return null
  }
}

function createDeclarationInfo(node, { kind, hoisted, index }) {
  return {
    kind,
    hoisted,
    node,
    index: resolveIndex(node, index)
  }
}

function resolveIndex(node, providedIndex) {
  if (typeof providedIndex === 'number') {
    return providedIndex
  }
  return typeof node.start === 'number' ? node.start : Number.NEGATIVE_INFINITY
}

function inferTemporalDeadZoneIndex(declarator) {
  if (!declarator) return undefined
  const init = declarator.init
  if (!init) return undefined

  if (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression') {
    return typeof init.start === 'number' ? init.start : declarator.start
  }

  if (typeof init.end === 'number') {
    return init.end
  }
  if (typeof declarator.end === 'number') {
    return declarator.end
  }
  return undefined
}

function recordReferenceIfNeeded(node, parent, scopeManager, ancestors) {
  if (!shouldRecordReference(node, parent, ancestors)) {
    return
  }

  scopeManager.addReference({
    name: node.name,
    node
  })
}

function shouldRecordReference(node, parent, ancestors = []) {
  if (!node || node.type !== 'Identifier') {
    return false
  }
  return isReferenceInContext(node, parent, ancestors)
}

function isReferenceInContext(node, parent, ancestors) {
  if (!parent) return true
  const parentIndex = ancestors.length - 1
  const grandparent = parentIndex > 0 ? ancestors[parentIndex - 1] : null

  switch (parent.type) {
    case 'VariableDeclarator':
      return parent.id !== node
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return parent.id !== node
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.id !== node
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
      return false
    case 'LabeledStatement':
      return false
    case 'BreakStatement':
    case 'ContinueStatement':
      return false
    case 'CatchClause':
      return parent.param !== node
    case 'MemberExpression':
      return parent.object === node || parent.computed
    case 'Property':
      if (grandparent && grandparent.type === 'ObjectPattern') {
        return false
      }
      if (parent.shorthand && parent.value === node) {
        return true
      }
      if (parent.computed && parent.key === node) {
        return true
      }
      return parent.key !== node
    case 'PropertyDefinition':
      return parent.key !== node
    case 'MethodDefinition':
      return parent.key !== node
    case 'RestElement':
      return false
    case 'UnaryExpression':
      if (parent.operator === 'typeof') {
        return false
      }
      return true
    case 'ArrayPattern':
    case 'ObjectPattern':
      return false
    case 'AssignmentPattern':
      return parent.left !== node
    case 'TSEnumDeclaration':
    case 'TSEnumMember':
    case 'TSModuleDeclaration':
    case 'TSImportEqualsDeclaration':
      return false
    default:
      return true
  }
}

function getTSModuleIdentifier(id) {
  if (!id) return null
  if (id.type === 'Identifier') {
    return id.name
  }
  return null
}

function extractPatternIdentifiers(pattern, containerEnd) {
  const results = []
  if (!pattern) return results

  switch (pattern.type) {
    case 'Identifier':
      results.push({ name: pattern.name, node: pattern, availableAt: containerEnd })
      break
    case 'RestElement':
      results.push(...extractPatternIdentifiers(pattern.argument, containerEnd || pattern.end))
      break
    case 'AssignmentPattern':
      results.push(...extractPatternIdentifiers(pattern.left, containerEnd || pattern.end))
      break
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        results.push(...extractPatternIdentifiers(element, element?.end))
      }
      break
    case 'ObjectPattern':
      for (const prop of pattern.properties) {
        if (prop.type === 'RestElement') {
          results.push(...extractPatternIdentifiers(prop.argument, prop.end))
        } else {
          results.push(...extractPatternIdentifiers(prop.value, prop.end))
        }
      }
      break
    default:
      break
  }

  return results
}

function* iterateChildren(node) {
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue
    const value = node[key]
    if (!value) continue
    if (Array.isArray(value)) {
      for (const element of value) {
        if (element && typeof element.type === 'string') {
          yield element
        }
      }
    } else if (value && typeof value.type === 'string') {
      yield value
    }
  }
}
