import { Severity } from '../core/constants.js'

export const noVar = {
  meta: {
    name: 'no-var',
    description: 'Disallow var declarations.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind === 'var') {
          context.report({
            node,
            message: "Unexpected var, use 'let' or 'const' instead."
          })
        }
      }
    }
  }
}
