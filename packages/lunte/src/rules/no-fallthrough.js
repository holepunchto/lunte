import { Severity } from '../core/constants.js'

const FALLTHROUGH_PATTERN = /\/\*(?:[^*]|\*+[^*/])*\*\/|\/\/[^\n]*/g
const FALLTHROUGH_HINT = /falls?\s*-?\s*through/i
const TERMINATING_STATEMENTS = new Set(['BreakStatement', 'ReturnStatement', 'ThrowStatement', 'ContinueStatement'])

export const noFallthrough = {
  meta: {
    name: 'no-fallthrough',
    description: 'Disallow fallthrough of case statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      SwitchStatement(node) {
        const cases = node.cases
        if (!Array.isArray(cases) || cases.length === 0) {
          return
        }

        for (let index = 0; index < cases.length - 1; index += 1) {
          const switchCase = cases[index]
          if (!switchCase) continue

          if (switchCase.consequent.length === 0) {
            continue
          }

          if (caseTerminates(switchCase)) {
            continue
          }

          if (hasFallthroughComment(context, switchCase, cases[index + 1])) {
            continue
          }

          context.report({
            node: switchCase,
            message: 'Expected a break statement before next case.'
          })
        }
      }
    }
  }
}

function caseTerminates(switchCase) {
  return terminatesStatements(switchCase.consequent)
}

function terminatesStatements(statements) {
  for (let index = statements.length - 1; index >= 0; index -= 1) {
    const statement = statements[index]
    if (!statement) continue

    if (isIgnorableAfterTerminator(statement)) {
      continue
    }

    return statementTerminates(statement)
  }
  return false
}

function isIgnorableAfterTerminator(node) {
  return node.type === 'FunctionDeclaration'
}

function statementTerminates(node) {
  if (TERMINATING_STATEMENTS.has(node.type)) {
    return true
  }

  switch (node.type) {
    case 'BlockStatement':
      return terminatesStatements(node.body)
    case 'IfStatement':
      if (!node.alternate) {
        return false
      }
      return clauseTerminates(node.consequent) && clauseTerminates(node.alternate)
    case 'TryStatement': {
      if (node.finalizer && clauseTerminates(node.finalizer)) {
        return true
      }
      const blockTerm = clauseTerminates(node.block)
      if (!node.handler) {
        return blockTerm
      }
      return blockTerm && clauseTerminates(node.handler.body)
    }
    case 'SwitchStatement':
      return false
    default:
      return false
  }
}

function clauseTerminates(node) {
  if (!node) {
    return false
  }
  if (node.type === 'BlockStatement') {
    return terminatesStatements(node.body)
  }
  return statementTerminates(node)
}

function hasFallthroughComment(context, currentCase, nextCase) {
  const rangeStart = getCaseEnd(currentCase)
  const rangeEnd = getCaseStart(nextCase)

  if (rangeStart === null || rangeStart === undefined || rangeEnd === null || rangeEnd === undefined || rangeEnd <= rangeStart) {
    return false
  }

  const segment = context.getSource({ start: rangeStart, end: rangeEnd })
  if (typeof segment !== 'string' || segment.length === 0) {
    return false
  }

  FALLTHROUGH_PATTERN.lastIndex = 0
  let match
  // lunte-disable-next-line no-cond-assign
  while ((match = FALLTHROUGH_PATTERN.exec(segment))) {
    if (FALLTHROUGH_HINT.test(match[0])) {
      return true
    }
  }

  return false
}

function getCaseEnd(node) {
  if (!node) return null
  if (node.consequent.length > 0) {
    const last = node.consequent[node.consequent.length - 1]
    return last?.end ?? node.end ?? null
  }
  return node.end ?? null
}

function getCaseStart(node) {
  if (!node) return null
  if (node.consequent.length > 0) {
    return node.consequent[0]?.start ?? node.start ?? null
  }
  return node.start ?? null
}
