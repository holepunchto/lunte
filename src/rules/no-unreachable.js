import { Severity } from '../core/constants.js'

const TERMINATING_STATEMENTS = new Set([
  'ReturnStatement',
  'ThrowStatement',
  'BreakStatement',
  'ContinueStatement'
])

export const noUnreachable = {
  meta: {
    name: 'no-unreachable',
    description: 'Disallow unreachable code after return, throw, break, or continue.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    function checkBlockStatements(statements) {
      for (let i = 0; i < statements.length - 1; i++) {
        const stmt = statements[i]

        // Check if this statement terminates control flow
        if (isTerminating(stmt)) {
          // All subsequent statements are unreachable
          const nextStmt = statements[i + 1]

          // Skip function declarations as they are hoisted
          if (nextStmt.type === 'FunctionDeclaration') {
            continue
          }

          context.report({
            node: nextStmt,
            message: 'Unreachable code.'
          })
          break // Only report the first unreachable statement
        }
      }
    }

    return {
      BlockStatement(node) {
        checkBlockStatements(node.body)
      },
      SwitchCase(node) {
        checkBlockStatements(node.consequent)
      },
      Program(node) {
        checkBlockStatements(node.body)
      }
    }
  }
}

function isTerminating(stmt) {
  if (TERMINATING_STATEMENTS.has(stmt.type)) {
    return true
  }

  // If statement terminates if both branches terminate
  if (stmt.type === 'IfStatement') {
    return (
      stmt.consequent &&
      stmt.alternate &&
      isTerminating(stmt.consequent) &&
      isTerminating(stmt.alternate)
    )
  }

  // Block statement terminates if it contains a terminating statement
  if (stmt.type === 'BlockStatement') {
    return stmt.body.some((s) => isTerminating(s))
  }

  return false
}
