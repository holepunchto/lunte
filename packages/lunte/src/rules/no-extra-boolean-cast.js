import { Severity } from '../core/constants.js'

const BOOLEAN_CAST_FUNCTIONS = new Set(['Boolean'])

function isBooleanFunction (node) {
  return node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    BOOLEAN_CAST_FUNCTIONS.has(node.callee.name)
}

function isDoubleNegation (node) {
  return node.operator === '!' &&
    node.argument &&
    node.argument.type === 'UnaryExpression' &&
    node.argument.operator === '!'
}

function isInBooleanContext (context) {
  const parent = context.getParent()
  if (!parent) return false
  switch (parent.type) {
    case 'IfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ForStatement':
      return parent.test === context._currentNode
    case 'ConditionalExpression':
      return parent.test === context._currentNode
    case 'LogicalExpression':
      return parent.left === context._currentNode || parent.right === context._currentNode
    case 'UnaryExpression':
      return parent.operator === '!'
    default:
      return false
  }
}

export const noExtraBooleanCast = {
  meta: {
    name: 'no-extra-boolean-cast',
    description: 'Disallow unnecessary boolean casts.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create (context) {
    return {
      UnaryExpression (node) {
        if (isDoubleNegation(node) && !isInBooleanContext(context)) {
          context.report({
            node,
            message: 'Redundant double negation.'
          })
        }
      },
      CallExpression (node) {
        if (isBooleanFunction(node) && !isInBooleanContext(context)) {
          context.report({
            node,
            message: 'Unnecessary boolean cast.'
          })
        }
      }
    }
  }
}
