import { Severity } from '../core/constants.js'

function isProhibitedStatement(statement) {
  if (!statement) return false
  if (statement.type === 'BlockStatement') return false
  if (statement.type === 'VariableDeclaration' && statement.kind !== 'var') return true
  return statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration'
}

export const noCaseDeclarations = {
  meta: {
    name: 'no-case-declarations',
    description: 'Disallow lexical declarations in switch cases without blocks.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      SwitchCase(node) {
        for (const statement of node.consequent || []) {
          if (isProhibitedStatement(statement)) {
            context.report({
              node: statement,
              message: 'Unexpected lexical declaration in case block.'
            })
          }
        }
      }
    }
  }
}
