import { Severity } from '../core/constants.js'

export const preferConst = {
  meta: {
    name: 'prefer-const',
    description:
      'Require const declarations for variables that are never reassigned after declared.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const letVariables = new Map()
    const scopeStack = []

    function enterScope() {
      scopeStack.push(new Map())
    }

    function exitScope() {
      const scope = scopeStack.pop()
      if (!scope) return

      for (const [name, info] of scope.entries()) {
        if (!info.reassigned && !info.destructured) {
          context.report({
            node: info.node,
            message: `'${name}' is never reassigned. Use 'const' instead.`
          })
        }
      }
    }

    function getCurrentScope() {
      return scopeStack[scopeStack.length - 1]
    }

    function markReassigned(name) {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const scope = scopeStack[i]
        if (scope.has(name)) {
          scope.get(name).reassigned = true
          return
        }
      }
    }

    function isInForStatement(ancestors) {
      const parent = ancestors[ancestors.length - 1]
      return (
        parent?.type === 'ForStatement' ||
        parent?.type === 'ForInStatement' ||
        parent?.type === 'ForOfStatement'
      )
    }

    function isDestructured(node) {
      return node.type === 'ArrayPattern' || node.type === 'ObjectPattern'
    }

    return {
      Program: enterScope,
      'Program:exit': exitScope,
      BlockStatement: enterScope,
      'BlockStatement:exit': exitScope,
      ForStatement: enterScope,
      'ForStatement:exit': exitScope,
      ForInStatement: enterScope,
      'ForInStatement:exit': exitScope,
      ForOfStatement: enterScope,
      'ForOfStatement:exit': exitScope,

      VariableDeclaration(node) {
        if (node.kind !== 'let') return

        const ancestors = context.getAncestors()
        const inForLoop = isInForStatement(ancestors)

        for (const declarator of node.declarations) {
          const identifiers = extractIdentifiers(declarator.id)
          const destructured = isDestructured(declarator.id)

          for (const id of identifiers) {
            const scope = getCurrentScope()
            if (scope) {
              scope.set(id.name, {
                node: id,
                reassigned: inForLoop,
                destructured
              })
            }
          }
        }
      },

      AssignmentExpression(node) {
        const names = extractAssignmentTargets(node.left)
        for (const name of names) {
          markReassigned(name)
        }
      },

      UpdateExpression(node) {
        if (node.argument.type === 'Identifier') {
          markReassigned(node.argument.name)
        }
      }
    }
  }
}

function extractIdentifiers(pattern) {
  const identifiers = []

  function traverse(node) {
    if (!node) return

    switch (node.type) {
      case 'Identifier':
        identifiers.push(node)
        break
      case 'ArrayPattern':
        for (const element of node.elements) {
          traverse(element)
        }
        break
      case 'ObjectPattern':
        for (const property of node.properties) {
          if (property.type === 'Property') {
            traverse(property.value)
          } else if (property.type === 'RestElement') {
            traverse(property.argument)
          }
        }
        break
      case 'RestElement':
        traverse(node.argument)
        break
      case 'AssignmentPattern':
        traverse(node.left)
        break
    }
  }

  traverse(pattern)
  return identifiers
}

function extractAssignmentTargets(node) {
  const names = []

  function traverse(pattern) {
    if (!pattern) return

    switch (pattern.type) {
      case 'Identifier':
        names.push(pattern.name)
        break
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          traverse(element)
        }
        break
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'Property') {
            traverse(property.value)
          } else if (property.type === 'RestElement') {
            traverse(property.argument)
          }
        }
        break
      case 'RestElement':
        traverse(pattern.argument)
        break
      case 'AssignmentPattern':
        traverse(pattern.left)
        break
    }
  }

  traverse(node)
  return names
}
