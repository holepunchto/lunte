import { Severity } from '../core/constants.js'

const UNKNOWN = Symbol('unknown')

export const noDuplicateCase = {
  meta: {
    name: 'no-duplicate-case',
    description: 'Disallow duplicate case labels in switch statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      SwitchStatement(node) {
        const seenKeys = new Map()
        let hasDefault = false

        for (const switchCase of node.cases) {
          if (!switchCase.test) {
            if (hasDefault) {
              context.report({
                node: switchCase,
                message: 'Duplicate default clause.'
              })
            }
            hasDefault = true
            continue
          }

          const key = getCaseKey(switchCase.test)
          if (key === null) {
            continue
          }

          if (seenKeys.has(key)) {
            context.report({
              node: switchCase.test,
              message: 'Duplicate case label.'
            })
          } else {
            seenKeys.set(key, switchCase.test)
          }
        }
      }
    }
  }
}

function getCaseKey(test) {
  const value = evaluateStatic(test)
  if (value === UNKNOWN) {
    return null
  }

  if (value && typeof value === 'object' && value.type === 'regex') {
    return `regex:${value.pattern}/${value.flags ?? ''}`
  }

  switch (typeof value) {
    case 'number': {
      if (Number.isNaN(value)) return 'number:NaN'
      return `number:${String(value)}`
    }
    case 'bigint':
      return `bigint:${String(value)}`
    case 'string':
      return `string:${value}`
    case 'boolean':
      return `boolean:${value}`
    case 'undefined':
      return 'undefined'
    default:
      if (value === null) {
        return 'null'
      }
      return null
  }
}

function evaluateStatic(node) {
  if (!node) {
    return UNKNOWN
  }

  switch (node.type) {
    case 'Literal':
      if (node.regex) {
        return {
          type: 'regex',
          pattern: node.regex.pattern ?? '',
          flags: node.regex.flags ?? ''
        }
      }
      if (node.bigint != null) {
        try {
          return BigInt(node.bigint)
        } catch {
          return UNKNOWN
        }
      }
      return node.value
    case 'TemplateLiteral':
      if (node.expressions.length === 0 && node.quasis.length === 1) {
        const quasi = node.quasis[0]
        return quasi?.value?.cooked ?? ''
      }
      return UNKNOWN
    case 'UnaryExpression': {
      const argumentValue = evaluateStatic(node.argument)
      if (argumentValue === UNKNOWN) {
        return UNKNOWN
      }

      switch (node.operator) {
        case '+':
          if (typeof argumentValue === 'number') return +argumentValue
          return UNKNOWN
        case '-':
          if (typeof argumentValue === 'number') return -argumentValue
          if (typeof argumentValue === 'bigint') return -argumentValue
          return UNKNOWN
        case '~':
          if (typeof argumentValue === 'number') return ~argumentValue
          return UNKNOWN
        case '!':
          return !argumentValue
        case 'void':
          return undefined
        default:
          return UNKNOWN
      }
    }
    case 'Identifier':
      if (node.name === 'undefined') {
        return undefined
      }
      return UNKNOWN
    default:
      return UNKNOWN
  }
}
