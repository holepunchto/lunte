import { ScopeManager } from './scope-manager.js'
import { RuleContext } from './rule-context.js'
import { builtInRules } from '../rules/index.js'
import { Severity } from './constants.js'
import { getDefaultRuleConfig } from '../config/defaults.js'

export function runRules({ ast, filePath, source, ruleConfig, globals }) {
  const effectiveConfig = ruleConfig ?? getDefaultRuleConfig()
  const activeRules = []

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
      globals
    })
    const listeners = normalizeListeners(rule.create(context) ?? {})
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
  notifyListeners('enter', node, nextAncestors, state)

  for (const child of iterateChildren(node)) {
    traverse(child, state, nextAncestors)
  }

  notifyListeners('exit', node, nextAncestors, state)

  if (scopeType) {
    state.scopeManager.exitScope()
  }
}

function notifyListeners(phase, node, ancestors, state) {
  for (const entry of state.ruleEntries) {
    const handlers = entry.listeners[phase].get(node.type)
    if (!handlers) continue
    entry.context.setTraversalState({ node, ancestors: ancestors.slice(0, -1) })
    for (const handler of handlers) {
      maybeRecordReference(entry.context, node, phase === 'enter')
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
    default:
      if (
        node.type === 'ForStatement' ||
        node.type === 'ForInStatement' ||
        node.type === 'ForOfStatement'
      ) {
        return null
      }
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
}

function handleInScopeDeclarations(node, scopeManager) {
  if (node.type === 'VariableDeclaration') {
    for (const declarator of node.declarations) {
      for (const { name, node: id } of extractPatternIdentifiers(declarator.id)) {
        const hoisted = node.kind === 'var'
        const info = createDeclarationInfo(id, {
          kind: node.kind,
          hoisted,
          index: hoisted ? undefined : inferTemporalDeadZoneIndex(declarator)
        })
        scopeManager.declare(name, info, { hoistTo: hoisted ? 'function' : undefined })
      }
    }
  }

  if (node.type === 'ImportDeclaration') {
    for (const specifier of node.specifiers) {
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
            hoisted: true
          }),
          { hoistTo: 'function' }
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
          scopeManager.declare(
            name,
            createDeclarationInfo(id, {
              kind: statement.kind,
              hoisted: true,
            }),
            { hoistTo: 'function' }
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
          hoisted: true,
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
          hoisted: true,
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
      if (decl.type === 'ClassDeclaration' && decl.id) {
        scopeManager.declare(
          decl.id.name,
          createDeclarationInfo(decl.id, {
            kind: 'class',
            hoisted: true,
          }),
          { hoistTo: 'function' }
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

function maybeRecordReference(context, node, isEntering) {
  if (!isEntering) return
  if (node.type !== 'Identifier') return

  const parent = context.getParent()
  if (!isReferenceInContext(node, parent)) {
    return
  }

  context.addReference({
    name: node.name,
    node
  })
}

function isReferenceInContext(node, parent) {
  if (!parent) return true

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
      if (parent.shorthand && parent.value === node) {
        return true
      }
      return parent.key !== node
    case 'PropertyDefinition':
      return parent.key !== node
    case 'MethodDefinition':
      return parent.key !== node
    case 'ArrayPattern':
    case 'ObjectPattern':
      return false
    case 'AssignmentPattern':
      return parent.left !== node
    default:
      return true
  }
}

function extractPatternIdentifiers(pattern) {
  const results = []
  if (!pattern) return results

  switch (pattern.type) {
    case 'Identifier':
      results.push({ name: pattern.name, node: pattern })
      break
    case 'RestElement':
      results.push(...extractPatternIdentifiers(pattern.argument))
      break
    case 'AssignmentPattern':
      results.push(...extractPatternIdentifiers(pattern.left))
      break
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        results.push(...extractPatternIdentifiers(element))
      }
      break
    case 'ObjectPattern':
      for (const prop of pattern.properties) {
        if (prop.type === 'RestElement') {
          results.push(...extractPatternIdentifiers(prop.argument))
        } else {
          results.push(...extractPatternIdentifiers(prop.value))
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
