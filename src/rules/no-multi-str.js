import { Severity } from '../core/constants.js'

function isMultilineEscapedString(node) {
  if (node.type !== 'Literal' || typeof node.value !== 'string') return false
  if (typeof node.raw !== 'string') return false
  return /\\\r?\n/.test(node.raw)
}

export const noMultiStr = {
  meta: {
    name: 'no-multi-str',
    description: 'Disallow multiline strings with backslash escapes.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      Literal(node) {
        if (isMultilineEscapedString(node)) {
          context.report({
            node,
            message: 'Unexpected multiline string.'
          })
        }
      }
    }
  }
}
