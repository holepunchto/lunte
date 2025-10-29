import { Severity } from '../core/constants.js'

export const noEmptyPattern = {
  meta: {
    name: 'no-empty-pattern',
    description: 'Disallow empty destructuring patterns.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      ObjectPattern(node) {
        if (node.properties.length === 0) {
          context.report({
            node,
            message: 'Unexpected empty object pattern.'
          })
        }
      },
      ArrayPattern(node) {
        // Empty array pattern [] is invalid
        // Pattern with holes like [,,,] is also considered empty if all elements are null
        if (node.elements.length === 0) {
          context.report({
            node,
            message: 'Unexpected empty array pattern.'
          })
        } else {
          // Check if all elements are holes (null)
          const hasNonHole = node.elements.some(el => el !== null)
          if (!hasNonHole) {
            context.report({
              node,
              message: 'Unexpected empty array pattern.'
            })
          }
        }
      }
    }
  }
}
