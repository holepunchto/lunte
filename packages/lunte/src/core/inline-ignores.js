const DIRECTIVES = [
  { keyword: 'lunte-disable-line', mode: 'line' },
  { keyword: 'lunte-disable-next-line', mode: 'next-line' },
  { keyword: 'lunte-disable', mode: 'file' },
  { keyword: 'eslint-disable-line', mode: 'line' },
  { keyword: 'eslint-disable-next-line', mode: 'next-line' },
  { keyword: 'eslint-disable', mode: 'file' }
]

export function buildInlineIgnoreMatcher(comments = []) {
  const entries = new Map()
  const globalState = { all: false, rules: new Set() }

  for (const comment of comments) {
    if (!comment || typeof comment.value !== 'string' || !comment.loc) continue

    const text = comment.value.trim()
    if (!text) continue

    for (const directive of DIRECTIVES) {
      if (!text.startsWith(directive.keyword)) {
        continue
      }

      const payload = text.slice(directive.keyword.length).trim()
      const baseLine = comment.loc.end?.line ?? comment.loc.start.line
      if (directive.mode === 'file') {
        registerGlobal(globalState, parseRuleList(payload))
      } else {
        const targetLine = directive.mode === 'next-line' ? baseLine + 1 : baseLine
        registerLine(entries, targetLine, parseRuleList(payload))
      }
      break
    }
  }

  return {
    shouldIgnore({ line, ruleId }) {
      if (globalState.all) return true
      if (ruleId && globalState.rules.has(ruleId)) {
        return true
      }
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

function registerGlobal(state, ruleIds) {
  if (!ruleIds) {
    state.all = true
    state.rules.clear()
    return
  }

  if (state.all) {
    return
  }

  for (const id of ruleIds) {
    state.rules.add(id)
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
