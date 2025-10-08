import { Severity } from '../core/constants.js'

const ALWAYS_ALLOWED = new Set(['undefined', 'NaN', 'Infinity', 'arguments'])

export const noUseBeforeDefine = {
  meta: {
    name: 'no-use-before-define',
    description: 'Disallow using variables before they are defined.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const pendingReferences = []

    return {
      Identifier(node) {
        const parent = context.getParent()
        const ancestors = context.getAncestors()

        if (!isReferenceIdentifier(node, parent, ancestors)) {
          return
        }

        if (ALWAYS_ALLOWED.has(node.name) || context.isGlobal(node.name)) {
          return
        }

        pendingReferences.push({
          node,
          ancestors: ancestors.slice(),
          scope: context.getCurrentScope()
        })
      },
      'Program:exit'() {
        const scopeManager = context.getScopeManager()
        const originalScope = scopeManager.getCurrentScope()
        for (const reference of pendingReferences) {
          context.setTraversalState({ node: reference.node, ancestors: reference.ancestors })
          if (reference.scope) {
            scopeManager.currentScope = reference.scope
          }
          const resolved = context.resolve(reference.node.name, Number.POSITIVE_INFINITY)

          if (!resolved) {
            continue
          }

          if (resolved.hoisted) {
            continue
          }

          if (isDeferredReference(reference.node, reference.ancestors, resolved.node)) {
            continue
          }

          if (resolved.index <= reference.node.start) {
            continue
          }

          context.report({
            node: reference.node,
            message: `'${reference.node.name}' was used before it was defined.`
          })
        }
        scopeManager.currentScope = originalScope
      }
    }
  }
}

function isDeferredReference(node, ancestors, declarationNode) {
  if (!declarationNode) return false

  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i]
    if (isFunctionLike(ancestor)) {
      if (!containsNode(ancestor, declarationNode)) {
        return true
      }
    }
  }

  return false
}

function isFunctionLike(node) {
  return (
    node &&
    (node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression')
  )
}

function containsNode(container, maybeChild) {
  if (!container || !maybeChild) return false
  if (typeof container.start !== 'number' || typeof container.end !== 'number') {
    return false
  }
  if (typeof maybeChild.start !== 'number' || typeof maybeChild.end !== 'number') {
    return false
  }
  return container.start <= maybeChild.start && maybeChild.end <= container.end
}

function isReferenceIdentifier(node, parent, ancestors) {
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
    case 'MetaProperty':
      return false
    case 'ExportSpecifier':
      return false
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
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
