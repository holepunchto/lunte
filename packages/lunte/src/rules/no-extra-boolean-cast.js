import { Severity } from '../core/constants.js'

function isBooleanCast(node) {
  return (
    node &&
    (node.type === 'CallExpression' || node.type === 'NewExpression') &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'Boolean'
  )
}

function isDoubleNegation(node) {
  return (
    node?.type === 'UnaryExpression' &&
    node.operator === '!' &&
    node.argument?.type === 'UnaryExpression' &&
    node.argument.operator === '!'
  )
}

function isBooleanTestPosition(node, ancestors) {
  if (!node || !ancestors || ancestors.length === 0) return false

  let current = node

  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const parent = ancestors[i]
    if (!parent) continue

    switch (parent.type) {
      case 'ChainExpression':
        current = parent
        continue
      case 'LogicalExpression':
        if (parent.operator === '&&' || parent.operator === '||') {
          current = parent
          continue
        }
        return false
      case 'IfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ForStatement':
        return parent.test === current
      case 'ConditionalExpression':
        return parent.test === current
      case 'UnaryExpression':
        return parent.operator === '!'
      case 'CallExpression':
      case 'NewExpression':
        if (isBooleanCast(parent) && parent.arguments?.[0] === current) {
          return true
        }
        return false
      default:
        return false
    }
  }

  return false
}

export const noExtraBooleanCast = {
  meta: {
    name: 'no-extra-boolean-cast',
    description: 'Disallow unnecessary boolean casts.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      UnaryExpression(node) {
        if (isDoubleNegation(node) && isBooleanTestPosition(node, context.getAncestors())) {
          context.report({
            node,
            message: 'Redundant double negation.'
          })
        }
      },
      CallExpression(node) {
        if (!isBooleanCast(node)) {
          return
        }

        const parent = context.getParent()
        if (parent && parent.type === 'LogicalExpression') {
          return
        }

        if (!isBooleanTestPosition(node, context.getAncestors())) {
          context.report({
            node,
            message: 'Unnecessary boolean cast.'
          })
        }
      }
    }
  }
}
