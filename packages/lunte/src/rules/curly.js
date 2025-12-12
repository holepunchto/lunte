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
          const fix =
            keyword === 'if' ? buildIfFix({ node, body, source: context.source }) : undefined
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

            // Find the 'else' keyword position by searching source between consequent and alternate
            let elseOnDifferentLine = false
            if (
              consequentLoc &&
              alternateLoc &&
              node.consequent.end !== null &&
              alternate.start !== null
            ) {
              const betweenText = context.source.slice(node.consequent.end, alternate.start)
              const elseMatch = betweenText.match(/\belse\b/)
              if (elseMatch) {
                // Calculate which line the else keyword is on
                const beforeElse = context.source.slice(0, node.consequent.end + elseMatch.index)
                const elseKeywordLine = (beforeElse.match(/\n/g) || []).length + 1
                elseOnDifferentLine = elseKeywordLine !== alternateLoc.start.line
              }
            }

            if (alternateIsMultiLine || braceStyleViolation || elseOnDifferentLine) {
              context.report({
                node: alternate,
                message: `Expected { after 'else' for multi-line statement.`
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

function buildIfFix({ node, body, source }) {
  const newlineIndex = source.lastIndexOf('\n', body.start)
  const ifLineStart = source.lastIndexOf('\n', node.start)

  const ifIndent =
    ifLineStart === -1
      ? ''
      : (source.slice(ifLineStart + 1, node.start).match(/^[ \t]*/) || [''])[0]

  const openInsertPos = newlineIndex >= 0 ? newlineIndex : body.start

  return [
    { range: [openInsertPos, openInsertPos], text: ' {' },
    { range: [body.end, body.end], text: `\n${ifIndent}}` }
  ]
}
