import { Severity } from '../core/constants.js'

export const curly = {
  meta: {
    name: 'curly',
    description: 'Enforce consistent brace style for all control statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    function checkStatement(node, body, keyword) {
      if (!body) return

      if (body.type !== 'BlockStatement') {
        context.report({
          node: body,
          message: `Expected { after '${keyword}'.`
        })
      }
    }

    return {
      IfStatement(node) {
        checkStatement(node, node.consequent, 'if')
        if (node.alternate && node.alternate.type !== 'IfStatement') {
          checkStatement(node, node.alternate, 'else')
        }
      },

      WhileStatement(node) {
        checkStatement(node, node.body, 'while')
      },

      DoWhileStatement(node) {
        checkStatement(node, node.body, 'do')
      },

      ForStatement(node) {
        checkStatement(node, node.body, 'for')
      },

      ForInStatement(node) {
        checkStatement(node, node.body, 'for-in')
      },

      ForOfStatement(node) {
        checkStatement(node, node.body, 'for-of')
      }
    }
  }
}
