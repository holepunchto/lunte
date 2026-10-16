import { Severity } from '../core/constants.js'

const BLOCK_SAFE_TYPES = new Set(['FunctionDeclaration', 'ClassDeclaration'])

function isProhibitedStatement(statement) {
  if (!statement || statement.type === 'BlockStatement') {
    return false
  }

  if (statement.type === 'VariableDeclaration') {
    return statement.kind !== 'var'
  }

  return BLOCK_SAFE_TYPES.has(statement.type)
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
