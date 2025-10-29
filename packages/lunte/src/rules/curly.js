import { Severity } from '../core/constants.js'

export const curly = {
  meta: {
    name: 'curly',
    description: 'Enforce curly braces for multi-line control statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    function checkStatement(node, body, keyword) {
      if (!body) return

      if (body.type !== 'BlockStatement') {
        // Allow single-line statements without braces
        // Flag if the body is on a different line from the control statement
        const nodeLoc = node.loc
        const bodyLoc = body.loc
        if (nodeLoc && bodyLoc && nodeLoc.start.line !== bodyLoc.start.line) {
          context.report({
            node: body,
            message: `Expected { after '${keyword}' for multi-line statement.`
          })
        }
      }
    }

    return {
      IfStatement(node) {
        checkStatement(node, node.consequent, 'if')
        if (node.alternate && node.alternate.type !== 'IfStatement') {
          // For else, check if alternate is on different line from consequent end
          const alternate = node.alternate
          if (alternate.type !== 'BlockStatement') {
            const consequentLoc = node.consequent.loc
            const alternateLoc = alternate.loc
            if (
              consequentLoc &&
              alternateLoc &&
              consequentLoc.end.line !== alternateLoc.start.line
            ) {
              context.report({
                node: alternate,
                message: `Expected { after 'else' for multi-line statement.`
              })
            }
          }
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
