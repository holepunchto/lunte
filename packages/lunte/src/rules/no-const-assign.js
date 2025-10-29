import { Severity } from '../core/constants.js'

export const noConstAssign = {
  meta: {
    name: 'no-const-assign',
    description: 'Disallow reassigning const variables.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        checkAssignment(node.left, context)
      },
      UpdateExpression(node) {
        checkAssignment(node.argument, context)
      }
    }
  }
}

function checkAssignment(node, context) {
  if (node.type === 'Identifier') {
    const variable = context.resolve(node.name)
    if (variable && variable.kind === 'const') {
      context.report({
        node,
        message: `'${node.name}' is constant.`
      })
    }
  } else if (node.type === 'ArrayPattern' || node.type === 'ObjectPattern') {
    // Handle destructuring assignments
    checkPattern(node, context)
  }
  // Note: We don't recurse into MemberExpression because obj.prop = x
  // is mutating the object, not reassigning the const variable obj
}

function checkPattern(pattern, context) {
  if (pattern.type === 'Identifier') {
    const variable = context.resolve(pattern.name)
    if (variable && variable.kind === 'const') {
      context.report({
        node: pattern,
        message: `'${pattern.name}' is constant.`
      })
    }
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) checkPattern(element, context)
    }
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'Property') {
        checkPattern(property.value, context)
      } else if (property.type === 'RestElement') {
        checkPattern(property.argument, context)
      }
    }
  } else if (pattern.type === 'RestElement') {
    checkPattern(pattern.argument, context)
  } else if (pattern.type === 'AssignmentPattern') {
    checkPattern(pattern.left, context)
  }
}
