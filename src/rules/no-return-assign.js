import { Severity } from '../core/constants.js'

function isParenthesized (text) {
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
  create (context) {
    return {
      ReturnStatement (node) {
        const argument = node.argument
        if (!argument || argument.type !== 'AssignmentExpression') return

        const source = context.getSource(node) || ''
        if (isParenthesized(source)) return

        context.report({
          node: argument,
          message: 'Unexpected assignment within return statement.'
        })
      }
    }
  }
}
