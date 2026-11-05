import { Severity } from '../core/constants.js'
import { isDeclarationFile } from '../core/parser.js'
import { isReferenceIdentifier } from '../utils/ast-helpers.js'

export const noUnusedVars = {
  meta: {
    name: 'no-unused-vars',
    description: 'Disallow unused variables.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    if (isDeclarationFile(context.filePath)) {
      // Ambient declaration files only declare shapes; skip runtime unused checks.
      return {}
    }

    const definedSymbols = new Map()
    const usedSymbols = new Set()
    // type references count for imports, not ordinary variables.
    const typeUsedSymbols = new Set()
    const mergedBindingNames = new Set()
    let jsxPragmaNames = null

    function defineBinding(name, node, options = {}) {
      const { hasRestSibling = false, mergeByName = false, countTypeReferences = false } = options
      if (!name || !node) return
      if (mergeByName) {
        if (mergedBindingNames.has(name)) {
          return
        }
        mergedBindingNames.add(name)
      }
      definedSymbols.set(node, { name, node, countTypeReferences })
      // Mark as used if it starts with underscore OR has a rest sibling (ignoreRestSiblings behavior)
      if (shouldIgnoreName(name) || hasRestSibling) {
        usedSymbols.add(name)
      }
    }

    function markUsed(name) {
      if (!name) return
      usedSymbols.add(name)
    }

    function markTypeUsed(node) {
      const name = getLeftmostIdentifierName(node)
      if (!name) return
      typeUsedSymbols.add(name)
    }

    function markJsxPragmaUsed() {
      if (!jsxPragmaNames) {
        jsxPragmaNames = getJsxPragmaNames(context.source)
      }
      for (const name of jsxPragmaNames) {
        markUsed(name)
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return
        for (const specifier of node.specifiers ?? []) {
          if (specifier.importKind === 'type') continue
          defineBinding(specifier.local?.name, specifier.local, { countTypeReferences: true })
        }
      },
      TSTypeReference(node) {
        const name = getLeftmostIdentifierName(node.typeName)
        if (!name || isShadowedByTypeParameter(name, node, context.getAncestors())) return
        typeUsedSymbols.add(name)
      },
      TSTypeQuery(node) {
        markTypeUsed(node.exprName)
      },
      TSExpressionWithTypeArguments(node) {
        markTypeUsed(node.expression)
      },
      VariableDeclarator(node) {
        for (const { name, node: id, hasRestSibling } of extractPatternIdentifiers(node.id)) {
          defineBinding(name, id, { hasRestSibling })
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
          for (const { name, node: id, hasRestSibling } of extractPatternIdentifiers(param)) {
            defineBinding(name, id, { hasRestSibling })
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
          if (isAssignedFunctionExpression(node, parent) || isCommonJsExported(node, context)) {
            markUsed(node.id.name)
          }
        }
        for (const param of node.params ?? []) {
          for (const { name, node: id, hasRestSibling } of extractPatternIdentifiers(param)) {
            defineBinding(name, id, { hasRestSibling })
          }
        }
      },
      ArrowFunctionExpression(node) {
        for (const param of node.params ?? []) {
          for (const { name, node: id, hasRestSibling } of extractPatternIdentifiers(param)) {
            defineBinding(name, id, { hasRestSibling })
          }
        }
      },
      JSXOpeningElement(node) {
        const name = extractJSXIdentifier(node.name)
        if (name) markUsed(name)
        markJsxPragmaUsed()
      },
      JSXOpeningFragment() {
        markJsxPragmaUsed()
      },
      JSXClosingElement(node) {
        const name = extractJSXIdentifier(node.name)
        if (name) markUsed(name)
      },
      Identifier(node) {
        const parent = context.getParent()
        if (isThisPropertyReference(node, parent)) {
          markUsed(node.name)
          return
        }

        const ancestors = context.getAncestors()
        if (!isReferenceIdentifier(node, parent, ancestors, { ignoreTypeof: false })) {
          return
        }
        markUsed(node.name)
      },
      TSEnumDeclaration(node) {
        if (!node?.id || node.declare) {
          return
        }
        defineBinding(node.id.name, node.id)
        const parent = context.getParent()
        if (isExportedDeclaration(node, parent)) {
          markUsed(node.id.name)
        }
      },
      TSModuleDeclaration(node) {
        if (node.declare) {
          return
        }
        const name = getTSModuleName(node.id)
        if (!name) {
          return
        }
        defineBinding(name, node.id, { mergeByName: true })
        const parent = context.getParent()
        if (isExportedDeclaration(node, parent)) {
          markUsed(name)
        }
      },
      TSImportEqualsDeclaration(node) {
        if (!node?.id || node.importKind === 'type') {
          return
        }
        defineBinding(node.id.name, node.id, { countTypeReferences: true })
        if (node.isExport) {
          markUsed(node.id.name)
        }
        if (node.moduleReference?.type === 'TSQualifiedName') {
          markTypeUsed(node.moduleReference)
        }
      },
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            markUsed(node.declaration.id.name)
          }
          if (node.declaration.type === 'VariableDeclaration') {
            for (const declarator of node.declaration.declarations) {
              // No need to check hasRestSibling here since exported variables are used
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
          for (const { name, node, countTypeReferences } of definedSymbols.values()) {
            if (usedSymbols.has(name)) continue
            if (countTypeReferences && typeUsedSymbols.has(name)) continue
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

function extractPatternIdentifiers(pattern, options = {}) {
  const results = []
  if (!pattern) return results

  switch (pattern.type) {
    case 'Identifier':
      results.push({
        name: pattern.name,
        node: pattern,
        hasRestSibling: options.hasRestSibling || false
      })
      break
    case 'TSParameterProperty':
      results.push(...extractPatternIdentifiers(pattern.parameter, options))
      break
    case 'RestElement':
      results.push(...extractPatternIdentifiers(pattern.argument, { ...options, isRest: true }))
      break
    case 'AssignmentPattern':
      results.push(...extractPatternIdentifiers(pattern.left, options))
      break
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        results.push(...extractPatternIdentifiers(element, options))
      }
      break
    case 'ObjectPattern': {
      // Check if this object pattern has a rest element
      const hasRest = pattern.properties.some((p) => p.type === 'RestElement')

      for (const prop of pattern.properties) {
        if (prop.type === 'RestElement') {
          results.push(...extractPatternIdentifiers(prop.argument, { ...options, isRest: true }))
        } else {
          // Siblings of a rest element should be marked as having a rest sibling
          // This implements ignoreRestSiblings behavior (StandardJS compatibility)
          results.push(
            ...extractPatternIdentifiers(prop.value, {
              ...options,
              hasRestSibling: hasRest && !options.isRest
            })
          )
        }
      }
      break
    }
    default:
      break
  }

  return results
}

function extractJSXIdentifier(nameNode) {
  if (!nameNode) return null
  switch (nameNode.type) {
    case 'JSXIdentifier':
      return nameNode.name
    case 'JSXMemberExpression':
      return extractJSXIdentifier(nameNode.object)
    case 'JSXNamespacedName':
      return nameNode.namespace?.name ?? null
    default:
      return null
  }
}

function getLeftmostIdentifierName(node) {
  let current = node
  while (current) {
    switch (current.type) {
      case 'Identifier':
        return current.name
      case 'TSQualifiedName':
        current = current.left
        break
      case 'MemberExpression':
        current = current.object
        break
      default:
        return null
    }
  }
  return null
}

function isShadowedByTypeParameter(name, node, ancestors) {
  let child = node
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i]
    if (!ancestor || ancestor === node) continue
    if (
      ancestor.typeParameters?.type === 'TSTypeParameterDeclaration' &&
      ancestor.typeParameters.params?.some((param) => getTypeParameterName(param) === name)
    ) {
      return true
    }
    if (ancestor.type === 'TSMappedType' && getTypeParameterName(ancestor.typeParameter) === name) {
      return true
    }
    if (
      ancestor.type === 'TSConditionalType' &&
      ancestor.trueType === child &&
      declaresInferType(ancestor.extendsType, name)
    ) {
      return true
    }
    child = ancestor
  }
  return false
}

function getTypeParameterName(param) {
  if (!param) return null
  if (typeof param.name === 'string') return param.name
  return param.name?.name ?? null
}

function declaresInferType(node, name) {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((item) => declaresInferType(item, name))
  if (typeof node.type !== 'string') return false
  if (node.type === 'TSInferType') {
    return getTypeParameterName(node.typeParameter) === name
  }
  // nested conditional types own their infer scope.
  if (node.type === 'TSConditionalType') return false
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const value = node[key]
    if (value && typeof value === 'object' && declaresInferType(value, name)) return true
  }
  return false
}

function getJsxPragmaNames(source) {
  // jsx creates implicit references to its factory imports.
  const names = new Set()
  let factory = 'React'
  if (typeof source === 'string') {
    for (const comment of source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) ?? []) {
      const jsx = /@jsx\s+([A-Za-z_$][\w$]*)/.exec(comment)
      if (jsx) factory = jsx[1]
      const frag = /@jsxFrag\s+([A-Za-z_$][\w$]*)/.exec(comment)
      if (frag) names.add(frag[1])
    }
  }
  names.add(factory)
  return names
}

function shouldIgnoreName(name) {
  return typeof name === 'string' && name.startsWith('_')
}

function isExportedDeclaration(node, parent) {
  if (!parent) return false
  if (parent.type === 'ExportNamedDeclaration' && parent.declaration === node) {
    return true
  }
  if (parent.type === 'ExportDefaultDeclaration' && parent.declaration === node) {
    return true
  }
  return false
}

function getTSModuleName(id) {
  if (!id) return null
  if (id.type === 'Identifier') {
    return id.name
  }
  if (id.type === 'Literal' && typeof id.value === 'string') {
    return id.value
  }
  return null
}

function isAssignedFunctionExpression(functionNode, parent) {
  return parent?.type === 'AssignmentExpression' && parent.right === functionNode
}

function isThisPropertyReference(node, parent) {
  return (
    parent?.type === 'MemberExpression' &&
    parent.property === node &&
    !parent.computed &&
    parent.object?.type === 'ThisExpression'
  )
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
