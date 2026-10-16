import { Severity } from '../core/constants.js'

function isParenthesized(text) {
  let trimmed = text.trim().replace(/;\s*$/, '')
  if (trimmed.startsWith('return')) {
    trimmed = trimmed.slice('return'.length).trim()
  }
  return trimmed.startsWith('(') && trimmed.endsWith(')')
}

export const noReturnAssign = {
  meta: {
    name: 'no-return-assign',
    description: 'Disallow assignments in return statements unless parenthesized.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      ReturnStatement(node) {
        const argument = node.argument
        if (!argument || argument.type !== 'AssignmentExpression') return

        const source = context.getSource(node) || ''
        if (isParenthesized(source)) return

        context.report({
          node: argument,
          message: 'Unexpected assignment within return statement.'
        })
      },
      ArrowFunctionExpression(node) {
        // Arrow functions with implicit returns: () => x = 1
        // If the body is not a BlockStatement, it's an implicit return
        if (node.body.type === 'BlockStatement') return
        if (node.body.type !== 'AssignmentExpression') return

        // Check if the assignment is parenthesized by looking at the source
        // around the body (parentheses are not in the AST)
        const fullSource = context.getSource(node) || ''
        const arrowIndex = fullSource.indexOf('=>')
        if (arrowIndex === -1) return

        const afterArrow = fullSource.slice(arrowIndex + 2).trim()
        if (afterArrow.startsWith('(') && afterArrow.endsWith(')')) return

        context.report({
          node: node.body,
          message: 'Unexpected assignment within return statement.'
        })
      }
    }
  }
}
