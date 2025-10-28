import { Severity } from '../core/constants.js'

export const noUnusedVars = {
  meta: {
    name: 'no-unused-vars',
    description: 'Disallow unused variables.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const definedSymbols = new Map()
    const usedSymbols = new Set()

    function defineBinding(name, node) {
      if (!name || !node) return
      definedSymbols.set(node, { name, node })
      if (shouldIgnoreName(name)) {
        usedSymbols.add(name)
      }
    }

    function markUsed(name) {
      if (!name) return
      usedSymbols.add(name)
    }

    return {
      VariableDeclarator(node) {
        for (const { name, node: id } of extractPatternIdentifiers(node.id)) {
          defineBinding(name, id)
          if (
            node.parent &&
            node.parent.parent &&
            node.parent.parent.type === 'ExportNamedDeclaration'
          ) {
            markUsed(name)
          }
        }
      },
      FunctionDeclaration(node) {
        if (node.id) {
          defineBinding(node.id.name, node.id)
          if (
            node.parent &&
            (node.parent.type === 'ExportNamedDeclaration' ||
              node.parent.type === 'ExportDefaultDeclaration')
          ) {
            markUsed(node.id.name)
          }
        }
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            defineBinding(name, id)
          }
        }
      },
      FunctionExpression(node) {
        if (node.id) {
          defineBinding(node.id.name, node.id)
          const parent = context.getParent()
          if (
            parent &&
            (parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
            Array.isArray(parent.arguments) &&
            parent.arguments.includes(node)
          ) {
            // Treat callback names as used when the function is supplied as an argument.
            markUsed(node.id.name)
          }
          if (isCommonJsExported(node, context)) {
            markUsed(node.id.name)
          }
        }
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            defineBinding(name, id)
          }
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            defineBinding(name, id)
          }
        }
      },
      Identifier(node) {
        const parent = context.getParent()
        if (!isReferenceIdentifier(node, parent)) {
          return
        }
        markUsed(node.name)
      },
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            markUsed(node.declaration.id.name)
          }
          if (node.declaration.type === 'VariableDeclaration') {
            for (const declarator of node.declaration.declarations) {
              for (const { name } of extractPatternIdentifiers(declarator.id)) {
                markUsed(name)
              }
            }
          }
        }
        for (const spec of node.specifiers ?? []) {
          if (spec.local && spec.local.type === 'Identifier') {
            markUsed(spec.local.name)
          }
        }
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration
        if (!declaration) return
        if (declaration.type === 'Identifier') {
          markUsed(declaration.name)
        }
        if (
          (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
          declaration.id
        ) {
          markUsed(declaration.id.name)
        }
      },
      Program: {
        exit() {
          for (const { name, node } of definedSymbols.values()) {
            if (usedSymbols.has(name)) continue
            context.report({
              node,
              message: `'${name}' is defined but never used.`
            })
          }
        }
      }
    }
  }
}

function extractPatternIdentifiers(pattern) {
  const results = []
  if (!pattern) return results

  switch (pattern.type) {
    case 'Identifier':
      results.push({ name: pattern.name, node: pattern })
      break
    case 'RestElement':
      results.push(...extractPatternIdentifiers(pattern.argument))
      break
    case 'AssignmentPattern':
      results.push(...extractPatternIdentifiers(pattern.left))
      break
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        results.push(...extractPatternIdentifiers(element))
      }
      break
    case 'ObjectPattern':
      for (const prop of pattern.properties) {
        if (prop.type === 'RestElement') {
          results.push(...extractPatternIdentifiers(prop.argument))
        } else {
          results.push(...extractPatternIdentifiers(prop.value))
        }
      }
      break
    default:
      break
  }

  return results
}

function shouldIgnoreName(name) {
  return typeof name === 'string' && name.startsWith('_')
}

function isCommonJsExported(functionNode, context) {
  if (!functionNode?.id) return false
  const parent = context.getParent()
  if (!parent) return false

  if (parent.type === 'AssignmentExpression' && parent.right === functionNode) {
    return isCommonJsExportTarget(parent.left)
  }

  if (parent.type === 'Property' && parent.value === functionNode) {
    const ancestors = context.getAncestors()
    const grandparent = ancestors[ancestors.length - 2]
    if (grandparent && grandparent.type === 'ObjectExpression') {
      const containerParent = ancestors[ancestors.length - 3]
      if (containerParent) {
        if (
          containerParent.type === 'AssignmentExpression' &&
          containerParent.right === grandparent
        ) {
          return isCommonJsExportTarget(containerParent.left)
        }
        if (
          containerParent.type === 'CallExpression' &&
          containerParent.callee.type === 'Identifier'
        ) {
          // Best effort: ignore
        }
      }
    }
  }

  return false
}

function isCommonJsExportTarget(node) {
  if (!node) return false
  if (node.type === 'Identifier') {
    return node.name === 'exports'
  }
  if (node.type !== 'MemberExpression') {
    return false
  }

  if (isModuleExports(node)) {
    return true
  }

  return isCommonJsExportTarget(node.object)
}

function isModuleExports(node) {
  if (!node || node.type !== 'MemberExpression') return false
  if (
    isIdentifier(node.object, 'module') &&
    matchesProperty(node.property, 'exports', node.computed)
  ) {
    return true
  }
  return isModuleExports(node.object)
}

function isIdentifier(node, name) {
  return node?.type === 'Identifier' && node.name === name
}

function matchesProperty(property, name, computed) {
  if (computed) {
    return property?.type === 'Literal' && property.value === name
  }
  return property?.type === 'Identifier' && property.name === name
}

function isReferenceIdentifier(node, parent) {
  if (!parent) return true

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
    case 'ExportSpecifier':
      return false
    case 'MetaProperty':
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
    default:
      return true
  }
}
