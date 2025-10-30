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
          if (key === null) continue // Computed properties we can't statically analyze

          if (keys.has(key)) {
            context.report({
              node: property,
              message: `Duplicate key '${key}'.`
            })
          } else {
            keys.set(key, property)
          }
        }
      }
    }
  }
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
