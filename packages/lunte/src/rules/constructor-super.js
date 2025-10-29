import { Severity } from '../core/constants.js'

export const constructorSuper = {
  meta: {
    name: 'constructor-super',
    description:
      'Require super() calls in constructors of derived classes and disallow super() in non-derived classes.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const classStack = []

    function isDerivedClass(node) {
      return node.superClass !== null
    }

    function isSuperCall(node) {
      return node.type === 'CallExpression' && node.callee.type === 'Super'
    }

    function findSuperCall(node) {
      if (!node) return null
      if (isSuperCall(node)) return node

      if (node.type === 'BlockStatement') {
        for (const stmt of node.body) {
          if (stmt.type === 'ExpressionStatement') {
            if (isSuperCall(stmt.expression)) return stmt.expression
          }
        }
      }

      return null
    }

    function hasThisBeforeSuper(body) {
      if (!body || body.type !== 'BlockStatement') return null

      let foundSuper = false
      for (const stmt of body.body) {
        if (stmt.type === 'ExpressionStatement' && isSuperCall(stmt.expression)) {
          foundSuper = true
          continue
        }

        if (!foundSuper) {
          const thisNode = findThisExpression(stmt)
          if (thisNode) return thisNode
        }
      }
      return null
    }

    function findThisExpression(node) {
      if (!node) return null
      if (node.type === 'ThisExpression') return node

      // Check common statement types
      if (node.type === 'ExpressionStatement') {
        return findThisExpression(node.expression)
      }

      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          const result = findThisExpression(decl.init)
          if (result) return result
        }
      }

      if (node.type === 'MemberExpression') {
        return findThisExpression(node.object)
      }

      if (node.type === 'CallExpression') {
        const result = findThisExpression(node.callee)
        if (result) return result
        for (const arg of node.arguments) {
          const argResult = findThisExpression(arg)
          if (argResult) return argResult
        }
      }

      if (node.type === 'AssignmentExpression') {
        const leftResult = findThisExpression(node.left)
        if (leftResult) return leftResult
        return findThisExpression(node.right)
      }

      return null
    }

    return {
      ClassDeclaration(node) {
        classStack.push({ node, isDerived: isDerivedClass(node) })
      },
      'ClassDeclaration:exit'() {
        classStack.pop()
      },

      ClassExpression(node) {
        classStack.push({ node, isDerived: isDerivedClass(node) })
      },
      'ClassExpression:exit'() {
        classStack.pop()
      },

      MethodDefinition(node) {
        if (node.kind !== 'constructor' || classStack.length === 0) return

        const currentClass = classStack[classStack.length - 1]
        const isDerived = currentClass.isDerived
        const body = node.value.body
        const superCall = findSuperCall(body)

        if (isDerived) {
          // Derived class must call super()
          if (!superCall) {
            context.report({
              node,
              message: "Constructors of derived classes must call 'super()'."
            })
            return
          }

          // Check if 'this' is used before super()
          const thisBeforeSuper = hasThisBeforeSuper(body)
          if (thisBeforeSuper) {
            context.report({
              node: thisBeforeSuper,
              message: "'this' is not allowed before 'super()' in derived class constructors."
            })
          }
        } else {
          // Non-derived class must not call super()
          if (superCall) {
            context.report({
              node: superCall,
              message: "Constructors of non-derived classes must not call 'super()'."
            })
          }
        }
      }
    }
  }
}
