import { Severity } from '../core/constants.js'

export const requireAwait = {
  meta: {
    name: 'require-await',
    description: 'Rule to disallow async functions which have no `await` expression.',
    recommended: true,
    defaultSeverity: Severity.warning
  },
  create(context) {
    let scope = null

    function enterScope() {
      scope = { parent: scope, hasAwait: false }
    }

    function exitScope(node) {
      if (node.async && !node.generator && !scope.hasAwait) {
        const name = node.id ? node.id.name : 'Anonymous'

        context.report({ node, message: `${name} function has no 'await' expression.` })
      }

      scope = scope.parent
    }

    return {
      FunctionDeclaration: enterScope,
      'FunctionDeclaration:exit': exitScope,
      FunctionExpression: enterScope,
      'FunctionExpression:exit': exitScope,
      ArrowFunctionExpression: enterScope,
      'ArrowFunctionExpression:exit': exitScope,

      AwaitExpression() {
        if (!scope) return

        scope.hasAwait = true
      },
      ForOfStatement(node) {
        if (!scope) return

        if (node.await) {
          scope.hasAwait = true
        }
      },
      VariableDeclaration(node) {
        if (!scope) return

        if (node.kind === 'await using') {
          scope.hasAwait = true
        }
      }
    }
  }
}
