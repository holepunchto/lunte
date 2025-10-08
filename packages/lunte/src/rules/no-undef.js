import { Severity } from '../core/constants.js'

const ALWAYS_ALLOWED = new Set(['undefined', 'NaN', 'Infinity', 'arguments'])

export const noUndef = {
  meta: {
    name: 'no-undef',
    description: 'Disallow use of undeclared variables.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
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

        const definition = context.resolve(node.name, node.start)
        if (!definition) {
          const futureDefinition = context.resolve(node.name, Number.POSITIVE_INFINITY)
          if (!futureDefinition) {
            context.report({
              node,
              message: `'${node.name}' is not defined.`
            })
          }
        }
      }
    }
  }
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
