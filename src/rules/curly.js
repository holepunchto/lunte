import { Severity } from '../core/constants.js'

export const curly = {
  meta: {
    name: 'curly',
    description: 'Enforce curly braces for multi-line control statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    function checkStatement(node, body, keyword) {
      if (!body) return

      if (body.type !== 'BlockStatement') {
        // Allow single-line statements without braces
        // Flag if the body is on a different line from the control statement
        const nodeLoc = node.loc
        const bodyLoc = body.loc
        if (nodeLoc && bodyLoc && nodeLoc.start.line !== bodyLoc.start.line) {
          const fix = buildStatementFix({ node, body, source: context.source })
          context.report({
            node: body,
            message: `Expected { after '${keyword}' for multi-line statement.`,
            fix
          })
        }
      }
    }

    return {
      IfStatement(node) {
        checkStatement(node, node.consequent, 'if')
        if (node.alternate && node.alternate.type !== 'IfStatement') {
          const alternate = node.alternate
          if (alternate.type !== 'BlockStatement') {
            const consequentLoc = node.consequent.loc
            const alternateLoc = alternate.loc

            // Three cases require braces for else:
            // 1. The alternate body itself spans multiple lines
            // 2. The if has braces (BlockStatement) and else is on a different line (brace-style)
            // 3. The else keyword and its body are on different lines
            const alternateIsMultiLine =
              alternateLoc && alternateLoc.start.line !== alternateLoc.end.line
            const braceStyleViolation =
              node.consequent.type === 'BlockStatement' &&
              consequentLoc &&
              alternateLoc &&
              consequentLoc.end.line !== alternateLoc.start.line

            const elseInfo = findElseInfo({
              node,
              alternate,
              source: context.source
            })
            const elseOnDifferentLine =
              elseInfo && alternateLoc
                ? elseInfo.elseKeywordLine !== alternateLoc.start.line
                : false

            if (alternateIsMultiLine || braceStyleViolation || elseOnDifferentLine) {
              const fix = elseInfo
                ? buildElseFix({
                    elseStart: elseInfo.elseStart,
                    elseEnd: elseInfo.elseEnd,
                    elseKeywordLine: elseInfo.elseKeywordLine,
                    body: alternate,
                    source: context.source
                  })
                : undefined
              context.report({
                node: alternate,
                message: `Expected { after 'else' for multi-line statement.`,
                fix
              })
            }
          }
        }
      },

      WhileStatement(node) {
        checkStatement(node, node.body, 'while')
      },

      DoWhileStatement(node) {
        checkStatement(node, node.body, 'do')
      },

      ForStatement(node) {
        checkStatement(node, node.body, 'for')
      },

      ForInStatement(node) {
        checkStatement(node, node.body, 'for-in')
      },

      ForOfStatement(node) {
        checkStatement(node, node.body, 'for-of')
      }
    }
  }
}

function buildStatementFix({ node, body, source }) {
  if (!node || node.start === null || body.start === null || body.end === null) {
    return undefined
  }

  const newlineIndex = source.lastIndexOf('\n', body.start)
  const statementLineStart = source.lastIndexOf('\n', node.start)

  const statementIndent =
    statementLineStart === -1
      ? ''
      : (source.slice(statementLineStart + 1, node.start).match(/^[ \t]*/) || [''])[0]

  const openInsertPos = newlineIndex >= 0 ? newlineIndex : body.start

  return [
    { range: [openInsertPos, openInsertPos], text: ' {' },
    { range: [body.end, body.end], text: `\n${statementIndent}}` }
  ]
}

function findElseInfo({ node, alternate, source }) {
  if (!node || !alternate || node.consequent.end === null || alternate.start === null) {
    return null
  }

  const betweenText = source.slice(node.consequent.end, alternate.start)
  const elseMatch = betweenText.match(/\belse\b/)
  if (!elseMatch) return null

  const elseStart = node.consequent.end + elseMatch.index
  const elseEnd = elseStart + elseMatch[0].length

  const beforeElse = source.slice(0, elseStart)
  const elseKeywordLine = (beforeElse.match(/\n/g) || []).length + 1

  return { elseStart, elseEnd, elseKeywordLine }
}

function buildElseFix({ elseStart, elseEnd, elseKeywordLine, body, source }) {
  if (elseStart === null || elseEnd === null || body.start === null || body.end === null) {
    return undefined
  }

  const elseLineStart = source.lastIndexOf('\n', elseStart)
  const elseIndent =
    elseLineStart === -1
      ? ''
      : (source.slice(elseLineStart + 1, elseStart).match(/^[ \t]*/) || [''])[0]

  const bodyLoc = body.loc
  const closeInline =
    bodyLoc &&
    elseKeywordLine &&
    bodyLoc.start.line === bodyLoc.end.line &&
    bodyLoc.start.line === elseKeywordLine
  const closeText = closeInline ? ' }' : `\n${elseIndent}}`

  return [
    { range: [elseEnd, elseEnd], text: ' {' },
    { range: [body.end, body.end], text: closeText }
  ]
}
