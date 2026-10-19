import { Severity } from '../core/constants.js'

export const noDupeKeys = {
  meta: {
    name: 'no-dupe-keys',
    description: 'Disallow duplicate keys in object literals.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      ObjectExpression(node) {
        const keys = new Map()

        for (const property of node.properties) {
          // Skip spread properties
          if (property.type === 'SpreadElement') continue

          const key = getPropertyKey(property)
          const kind = getPropertyKind(property)
          if (key === null) continue // Computed properties we can't statically analyze

          const existing = keys.get(key)
          if (existing && isDuplicateProperty(existing, kind)) {
            context.report({
              node: property,
              message: `Duplicate key '${key}'.`
            })
          } else {
            keys.set(key, { ...existing, [kind]: property })
          }
        }
      }
    }
  }
}

function isDuplicateProperty(existing, kind) {
  if (kind === 'get') return Boolean(existing.get)
  if (kind === 'set') return Boolean(existing.set)
  return Boolean(existing.get || existing.set || existing.init)
}

function getPropertyKind(property) {
  if (property.kind === 'get') return 'get'
  if (property.kind === 'set') return 'set'
  return 'init'
}

function getPropertyKey(property) {
  if (property.computed) {
    // For computed properties like {[key]: value}, we can only check literals
    if (property.key.type === 'Literal') {
      return String(property.key.value)
    }
    return null // Can't statically analyze
  }

  if (property.key.type === 'Identifier') {
    return property.key.name
  }

  if (property.key.type === 'Literal') {
    return String(property.key.value)
  }

  return null
}
