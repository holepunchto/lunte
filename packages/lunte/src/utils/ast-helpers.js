export function isReferenceIdentifier(node, parent, ancestors = []) {
  if (!parent) return true

  if (isTypeOnlyIdentifier(node, parent, ancestors)) {
    return false
  }

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

const TS_TYPE_ONLY_PARENTS = new Set([
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSInterfaceBody',
  'TSTypeAnnotation',
  'TSTypeReference',
  'TSQualifiedName',
  'TSTypeLiteral',
  'TSPropertySignature',
  'TSMethodSignature',
  'TSIndexSignature',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
  'TSExpressionWithTypeArguments',
  'TSArrayType',
  'TSTupleType',
  'TSOptionalType',
  'TSRestType',
  'TSUnionType',
  'TSIntersectionType',
  'TSTypeQuery',
  'TSImportType',
  'TSInferType',
  'TSConditionalType',
  'TSMappedType',
  'TSParenthesizedType',
  'TSLiteralType',
  'TSTypeOperator',
  'TSTypeParameter',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation',
  'TSFunctionType',
  'TSConstructorType',
  'TSDeclareFunction'
])

const TS_RUNTIME_WRAPPER_PARENTS = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSInstantiationExpression',
  'TSExportAssignment'
])

function isTypeOnlyIdentifier(node, parent, ancestors = []) {
  if (!parent || typeof parent.type !== 'string') {
    return false
  }

  if (TS_RUNTIME_WRAPPER_PARENTS.has(parent.type)) {
    return false
  }

  if (parent.type === 'TSExpressionWithTypeArguments') {
    const firstNonTSAncestor = findFirstNonTSAncestor(ancestors)
    if (firstNonTSAncestor && (firstNonTSAncestor.type === 'ClassDeclaration' || firstNonTSAncestor.type === 'ClassExpression')) {
      return false
    }
    return true
  }

  if (parent.type === 'TSQualifiedName') {
    return true
  }

  if (TS_TYPE_ONLY_PARENTS.has(parent.type)) {
    return true
  }

  return false
}

function findFirstNonTSAncestor(ancestors = []) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i]
    if (ancestor && typeof ancestor.type === 'string' && !ancestor.type.startsWith('TS')) {
      return ancestor
    }
  }
  return null
}
