import { Severity } from '../core/constants.js'

export const noDebugger = {
  meta: {
    name: 'no-debugger',
    description: 'Disallow debugger statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      DebuggerStatement(node) {
        context.report({
          node,
          message: 'Unexpected debugger statement.'
        })
      }
    }
  }
}
