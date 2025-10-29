import { Severity } from '../core/constants.js'

export const eqeqeq = {
  meta: {
    name: 'eqeqeq',
    description: 'Require === and !== instead of == and !=.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === '==' || node.operator === '!=') {
          const operatorText = node.operator === '==' ? '===' : '!=='
          context.report({
            node,
            message: `Expected '${operatorText}' and instead saw '${node.operator}'.`
          })
        }
      }
    }
  }
}
