const DIRECTIVE_DISABLE_LINE = 'lunte-disable-line'
const DIRECTIVE_DISABLE_NEXT_LINE = 'lunte-disable-next-line'

export function buildInlineIgnoreMatcher(comments = []) {
  const entries = new Map()

  for (const comment of comments) {
    if (!comment || typeof comment.value !== 'string' || !comment.loc) continue

    const text = comment.value.trim()
    if (!text) continue

    if (text.startsWith(DIRECTIVE_DISABLE_LINE)) {
      const payload = text.slice(DIRECTIVE_DISABLE_LINE.length).trim()
      const line = comment.loc.end?.line ?? comment.loc.start.line
      registerLine(entries, line, parseRuleList(payload))
      continue
    }

    if (text.startsWith(DIRECTIVE_DISABLE_NEXT_LINE)) {
      const payload = text.slice(DIRECTIVE_DISABLE_NEXT_LINE.length).trim()
      const line = (comment.loc.end?.line ?? comment.loc.start.line) + 1
      registerLine(entries, line, parseRuleList(payload))
    }
  }

  return {
    shouldIgnore({ line, ruleId }) {
      if (!line) return false
      const entry = entries.get(line)
      if (!entry) return false
      if (entry.all) return true
      if (!ruleId) return entry.rules.size > 0
      return entry.rules.has(ruleId)
    }
  }
}

function registerLine(target, line, ruleIds) {
  if (!line || line < 1) return
  let entry = target.get(line)
  if (!entry) {
    entry = { all: false, rules: new Set() }
    target.set(line, entry)
  }

  if (!ruleIds) {
    entry.all = true
    entry.rules.clear()
    return
  }

  if (entry.all) {
    return
  }

  for (const id of ruleIds) {
    entry.rules.add(id)
  }
}

function parseRuleList(payload) {
  if (!payload) return null
  const rules = new Set()
  for (const segment of payload.split(/[,\s]+/)) {
    const name = segment.trim()
    if (name) {
      rules.add(name)
    }
  }
  return rules.size > 0 ? rules : null
}
