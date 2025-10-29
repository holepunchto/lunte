export function isReferenceIdentifier(node, parent, ancestors = []) {
  if (!parent) return true

  const parentIndex = ancestors.length - 1
  const grandparent = parentIndex > 0 ? ancestors[parentIndex - 1] : null

  switch (parent.type) {
    case 'VariableDeclarator':
      return parent.id !== node
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return parent.id !== node
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.id !== node
    case 'ImportSpecifier':
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
      return false
    case 'MetaProperty':
      return false
    case 'ExportSpecifier':
      return false
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
      return false
    case 'LabeledStatement':
      return false
    case 'BreakStatement':
    case 'ContinueStatement':
      return false
    case 'CatchClause':
      return parent.param !== node
    case 'MemberExpression':
      return parent.object === node || parent.computed
    case 'Property':
      if (grandparent && grandparent.type === 'ObjectPattern') {
        return false
      }
      if (parent.shorthand && parent.value === node) {
        return true
      }
      if (parent.computed && parent.key === node) {
        return true
      }
      return parent.key !== node
    case 'PropertyDefinition':
      if (parent.computed && parent.key === node) {
        return true
      }
      return parent.key !== node
    case 'MethodDefinition':
      if (parent.computed && parent.key === node) {
        return true
      }
      return parent.key !== node
    case 'ArrayPattern':
    case 'ObjectPattern':
      return false
    case 'AssignmentPattern':
      return parent.left !== node
    case 'UnaryExpression':
      if (parent.operator === 'typeof') {
        return false
      }
      return true
    default:
      return true
  }
}
