import { Severity } from '../core/constants.js'

export const noCondAssign = {
  meta: {
    name: 'no-cond-assign',
    description: 'Disallow assignment operators in conditional expressions.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    function isConditionalContext(node) {
      const parent = context.getParent()
      if (!parent) return false

      // Check if we're in a conditional position
      if (parent.type === 'IfStatement' && parent.test === node) return true
      if (parent.type === 'WhileStatement' && parent.test === node) return true
      if (parent.type === 'DoWhileStatement' && parent.test === node) return true
      if (parent.type === 'ForStatement' && parent.test === node) return true
      if (parent.type === 'ConditionalExpression' && parent.test === node) return true

      return false
    }

    return {
      AssignmentExpression(node) {
        if (isConditionalContext(node)) {
          context.report({
            node,
            message: 'Expected a conditional expression and instead saw an assignment.'
          })
        }
      }
    }
  }
}
