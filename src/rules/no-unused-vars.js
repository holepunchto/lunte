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

    return {
      VariableDeclarator(node) {
        for (const { name, node: id } of extractPatternIdentifiers(node.id)) {
          definedSymbols.set(id, { name, node: id })
          if (
            node.parent &&
            node.parent.parent &&
            node.parent.parent.type === 'ExportNamedDeclaration'
          ) {
            usedSymbols.add(name)
          }
        }
      },
      FunctionDeclaration(node) {
        if (node.id) {
          definedSymbols.set(node.id, { name: node.id.name, node: node.id })
          if (
            node.parent &&
            (node.parent.type === 'ExportNamedDeclaration' ||
              node.parent.type === 'ExportDefaultDeclaration')
          ) {
            usedSymbols.add(node.id.name)
          }
        }
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            definedSymbols.set(id, { name, node: id, isParam: true })
          }
        }
      },
      FunctionExpression(node) {
        if (node.id) {
          definedSymbols.set(node.id, { name: node.id.name, node: node.id })
        }
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            definedSymbols.set(id, { name, node: id, isParam: true })
          }
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params ?? []) {
          for (const { name, node: id } of extractPatternIdentifiers(param)) {
            definedSymbols.set(id, { name, node: id, isParam: true })
          }
        }
      },
      Identifier(node) {
        const parent = context.getParent()
        if (!isReferenceIdentifier(node, parent)) {
          return
        }
        usedSymbols.add(node.name)
      },
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            usedSymbols.add(node.declaration.id.name)
          }
          if (node.declaration.type === 'VariableDeclaration') {
            for (const declarator of node.declaration.declarations) {
              for (const { name } of extractPatternIdentifiers(declarator.id)) {
                usedSymbols.add(name)
              }
            }
          }
        }
        for (const spec of node.specifiers ?? []) {
          if (spec.local && spec.local.type === 'Identifier') {
            usedSymbols.add(spec.local.name)
          }
        }
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration
        if (!declaration) return
        if (declaration.type === 'Identifier') {
          usedSymbols.add(declaration.name)
        }
        if (
          (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
          declaration.id
        ) {
          usedSymbols.add(declaration.id.name)
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
      return parent.key !== node
    case 'PropertyDefinition':
      return parent.key !== node
    case 'MethodDefinition':
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
