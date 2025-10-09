import { Severity } from '../core/constants.js'

const ALLOWED_PARENTS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression'
])

function isAllowedEmptyBlock(parent) {
  if (!parent) return false
  if (parent.type === 'CatchClause') return true
  return ALLOWED_PARENTS.has(parent.type)
}

export const noEmpty = {
  meta: {
    name: 'no-empty',
    description: 'Disallow empty block statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      BlockStatement(node) {
        if (node.body.length > 0) return
        const parent = context.getParent()
        if (isAllowedEmptyBlock(parent)) return
        context.report({
          node,
          message: 'Unexpected empty block.'
        })
      }
    }
  }
}
