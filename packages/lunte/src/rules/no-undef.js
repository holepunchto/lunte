import { Severity } from '../core/constants.js'
import { isReferenceIdentifier } from '../utils/ast-helpers.js'

const ALWAYS_ALLOWED = new Set(['undefined', 'NaN', 'Infinity', 'arguments'])

export const noUndef = {
  meta: {
    name: 'no-undef',
    description: 'Disallow use of undeclared variables.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const pendingReferences = []

    return {
      Identifier(node) {
        const parent = context.getParent()
        const ancestors = context.getAncestors()

        if (!isReferenceIdentifier(node, parent, ancestors)) {
          return
        }

        if (ALWAYS_ALLOWED.has(node.name) || context.isGlobal(node.name)) {
          return
        }

        pendingReferences.push({
          node,
          ancestors: ancestors.slice(),
          scope: context.getCurrentScope()
        })
      },
      'Program:exit'() {
        const scopeManager = context.getScopeManager()
        const originalScope = scopeManager.getCurrentScope()

        for (const reference of pendingReferences) {
          context.setTraversalState({ node: reference.node, ancestors: reference.ancestors })
          if (reference.scope) {
            scopeManager.currentScope = reference.scope
          }

          const definition = context.resolve(reference.node.name, reference.node.start)
          if (definition) {
            continue
          }

          const futureDefinition = context.resolve(reference.node.name, Number.POSITIVE_INFINITY)
          if (!futureDefinition) {
            context.report({
              node: reference.node,
              message: `'${reference.node.name}' is not defined.`
            })
          }
        }

        scopeManager.currentScope = originalScope
      }
    }
  }
}
