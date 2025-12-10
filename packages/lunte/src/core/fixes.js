export function normalizeFix(fix) {
  if (!fix) return undefined

  // Accept { range, text }, { edits: [...] }, or an array of edits
  if (Array.isArray(fix)) {
    const edits = fix.map(normalizeFixEdit).filter(Boolean)
    return edits.length ? edits : undefined
  }

  if (Array.isArray(fix?.edits)) {
    const edits = fix.edits.map(normalizeFixEdit).filter(Boolean)
    return edits.length ? edits : undefined
  }

  const singleEdit = normalizeFixEdit(fix)
  return singleEdit ? [singleEdit] : undefined
}

function normalizeFixEdit(edit) {
  if (!edit || !Array.isArray(edit.range) || edit.range.length !== 2) return null

  const [start, end] = edit.range
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (start < 0 || end < start) return null

  return {
    range: [start, end],
    text: typeof edit.text === 'string' ? edit.text : ''
  }
}

export function applyFixes({ source, diagnostics }) {
  const edits = []

  diagnostics.forEach((diagnostic, index) => {
    const normalized = normalizeFix(diagnostic.fix)
    if (!normalized) return

    for (const edit of normalized) {
      // Guard against edits that point outside the current source
      if (edit.range[1] > source.length) continue
      edits.push({
        range: edit.range,
        text: edit.text,
        diagnosticIndex: index
      })
    }
  })

  if (edits.length === 0) {
    return {
      output: source,
      appliedEdits: 0,
      appliedDiagnostics: 0
    }
  }

  edits.sort((a, b) => {
    if (a.range[0] === b.range[0]) {
      return a.range[1] - b.range[1]
    }
    return a.range[0] - b.range[0]
  })

  let cursor = 0
  let output = ''
  let appliedEdits = 0
  const appliedDiagnostics = new Set()

  for (const edit of edits) {
    const [start, end] = edit.range
    if (start < cursor) {
      // Overlaps with a previously applied edit; skip to avoid conflicts.
      continue
    }

    output += source.slice(cursor, start)
    output += edit.text
    cursor = end

    appliedEdits += 1
    appliedDiagnostics.add(edit.diagnosticIndex)
  }

  output += source.slice(cursor)

  return {
    output,
    appliedEdits,
    appliedDiagnostics: appliedDiagnostics.size
  }
}
