import { Severity } from '../core/constants.js'

export const eqeqeq = {
  meta: {
    name: 'eqeqeq',
    description: 'Require === and !== instead of == and !=.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === '==' || node.operator === '!=') {
          const operatorText = node.operator === '==' ? '===' : '!=='
          const operatorRange = findOperatorRange({
            node,
            source: context.source
          })
          const fix = operatorRange ? [{ range: operatorRange, text: operatorText }] : undefined
          context.report({
            node,
            message: `Expected '${operatorText}' and instead saw '${node.operator}'.`,
            fix
          })
        }
      }
    }
  }
}

function findOperatorRange({ node, source }) {
  const leftEnd = node.left?.end
  const rightStart = node.right?.start
  if (typeof leftEnd !== 'number' || typeof rightStart !== 'number') {
    return null
  }

  const between = source.slice(leftEnd, rightStart)
  const operator = node.operator
  let i = 0

  while (i < between.length) {
    const char = between[i]
    const next = between[i + 1]

    if (char === '/' && next === '/') {
      const newlineIndex = between.indexOf('\n', i + 2)
      if (newlineIndex === -1) return null
      i = newlineIndex + 1
      continue
    }

    if (char === '/' && next === '*') {
      const endIndex = between.indexOf('*/', i + 2)
      if (endIndex === -1) return null
      i = endIndex + 2
      continue
    }

    if (between.startsWith(operator, i)) {
      const start = leftEnd + i
      return [start, start + operator.length]
    }

    i += 1
  }

  return null
}
