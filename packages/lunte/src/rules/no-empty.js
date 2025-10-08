import { Severity } from '../core/constants.js'

function isAllowedEmptyBlock(node, parent) {
  if (!parent) return false
  if (parent.type === 'CatchClause') return true
  if (
    parent.type === 'FunctionDeclaration' ||
    parent.type === 'FunctionExpression' ||
    parent.type === 'ArrowFunctionExpression'
  ) {
    return true
  }
  return false
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
        if (isAllowedEmptyBlock(node, parent)) return
        context.report({
          node,
          message: 'Unexpected empty block.'
        })
      }
    }
  }
}
