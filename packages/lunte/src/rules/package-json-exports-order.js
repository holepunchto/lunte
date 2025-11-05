import { Severity } from '../core/constants.js'
import { basename } from 'node:path'

export const packageJsonExportsOrder = {
  meta: {
    name: 'package-json/exports-order',
    description: 'Ensure "default" condition is last in package.json exports.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const filename = basename(context.filePath)

    if (filename !== 'package.json') return {}

    return {
      Program(node) {
        // Parse as JSON instead of JS
        try {
          const packageData = JSON.parse(context.source)

          if (!packageData.exports) return

          checkExportsObject(packageData.exports, [], context)
        } catch (error) {
          // If it's not valid JSON, fail silently.
          // Analyzer adds error
        }
      }
    }
  }
}

function checkExportsObject(exports, path, context) {
  if (!exports || typeof exports !== 'object') {
    return
  }

  // Handle array and object forms
  const entries = Array.isArray(exports) ? exports.entries() : Object.entries(exports)
  const keys = Array.isArray(exports) ? exports.map((_, i) => String(i)) : Object.keys(exports)

  const conditionalKeys = ['default', 'import', 'require', 'node', 'bare', 'asset', 'addon']
  const hasConditionals = keys.some((key) => conditionalKeys.includes(key))

  if (hasConditionals) {
    // Check if "default" exists and is not last
    const defaultIndex = keys.indexOf('default')
    if (defaultIndex !== -1 && defaultIndex !== keys.length - 1) {
      const pathStr = path.length > 0 ? `exports.${path.join('.')}` : 'exports'
      context.report({
        node: context._currentNode,
        message: `The "default" condition in ${pathStr} must be last. Conditions are evaluated in order, so "default" will override more specific conditions that come after it.`
      })
    }
  }

  // Recursively check nested objects
  for (const [key, value] of entries) {
    if (value && typeof value === 'object') {
      checkExportsObject(value, [...path, key], context)
    }
  }
}
