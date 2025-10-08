import { Severity } from '../core/constants.js'

const BOOLEAN_CAST_FUNCTIONS = new Set(['Boolean'])

function isBooleanCastCallee(node) {
  return node && node.type === 'Identifier' && BOOLEAN_CAST_FUNCTIONS.has(node.name)
}

function isBooleanFunction(node) {
  return (
    (node?.type === 'CallExpression' || node?.type === 'NewExpression') &&
    isBooleanCastCallee(node.callee)
  )
}

function isBooleanFunctionArgument(node, argument) {
  if (!isBooleanFunction(node)) return false
  if (!node.arguments || node.arguments.length === 0) return argument === undefined
  return node.arguments[0] === argument
}

function isDoubleNegation(node) {
  return (
    node?.type === 'UnaryExpression' &&
    node.operator === '!' &&
    node.argument?.type === 'UnaryExpression' &&
    node.argument.operator === '!'
  )
}

function isBooleanTestContext(node, ancestors = []) {
  if (!node) return false

  let current = node

  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const parent = ancestors[i]
    if (!parent) continue

    if (parent.type === 'ChainExpression') {
      current = parent
      continue
    }

    if (
      parent.type === 'LogicalExpression' &&
      (parent.operator === '&&' || parent.operator === '||')
    ) {
      current = parent
      continue
    }

    if (
      parent.type === 'IfStatement' ||
      parent.type === 'WhileStatement' ||
      parent.type === 'DoWhileStatement' ||
      parent.type === 'ForStatement'
    ) {
      return parent.test === current
    }

    if (parent.type === 'ConditionalExpression') {
      return parent.test === current
    }

    if (parent.type === 'UnaryExpression') {
      return parent.operator === '!'
    }

    if (isBooleanFunctionArgument(parent, current)) {
      return true
    }

    break
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
        if (isDoubleNegation(node) && isBooleanTestContext(node, context.getAncestors())) {
          context.report({
            node,
            message: 'Redundant double negation.'
          })
        }
      },
      CallExpression(node) {
        if (!isBooleanFunction(node)) {
          return
        }

        const parent = context.getParent()
        if (parent && parent.type === 'LogicalExpression') {
          return
        }

        if (!isBooleanTestContext(node, context.getAncestors())) {
          context.report({
            node,
            message: 'Unnecessary boolean cast.'
          })
        }
      }
    }
  }
}
