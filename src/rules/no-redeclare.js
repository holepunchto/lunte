import { Severity } from '../core/constants.js'

export const noRedeclare = {
  meta: {
    name: 'no-redeclare',
    description: 'Disallow variable redeclaration.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const seenScopes = new WeakSet()

    function checkScope(scope) {
      if (!scope || seenScopes.has(scope)) return
      seenScopes.add(scope)

      const declarations = scope.declarations || new Map()

      for (const [name, declList] of declarations.entries()) {
        if (!Array.isArray(declList) || declList.length <= 1) {
          continue
        }

        // If there are multiple declarations, check if they're the kind we should report
        // (let/const duplicates are already caught as syntax errors by the parser)
        const varDecls = declList.filter((decl) => decl.kind === 'var' || decl.kind === 'function')

        if (varDecls.length > 1) {
          // Deduplicate by node - functions can be added multiple times during hoisting
          const uniqueDecls = []
          const seenNodes = new Set()
          for (const decl of varDecls) {
            if (!seenNodes.has(decl.node)) {
              seenNodes.add(decl.node)
              uniqueDecls.push(decl)
            }
          }

          // Report all but the first declaration
          if (uniqueDecls.length > 1) {
            for (let i = 1; i < uniqueDecls.length; i++) {
              const decl = uniqueDecls[i]
              context.report({
                node: decl.node,
                message: `'${name}' is already defined.`
              })
            }
          }
        }
      }
    }

    return {
      Program() {
        checkScope(context.getCurrentScope())
      },
      BlockStatement() {
        checkScope(context.getCurrentScope())
      },
      FunctionDeclaration() {
        checkScope(context.getCurrentScope())
      },
      FunctionExpression() {
        checkScope(context.getCurrentScope())
      },
      ArrowFunctionExpression() {
        checkScope(context.getCurrentScope())
      },
      ForStatement() {
        checkScope(context.getCurrentScope())
      },
      ForInStatement() {
        checkScope(context.getCurrentScope())
      },
      ForOfStatement() {
        checkScope(context.getCurrentScope())
      },
      SwitchStatement() {
        checkScope(context.getCurrentScope())
      },
      CatchClause() {
        checkScope(context.getCurrentScope())
      }
    }
  }
}
