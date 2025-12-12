export function applyFixes({ source, diagnostics }) {
  const edits = []

  for (let i = 0; i < diagnostics.length; i++) {
    const diagnostic = diagnostics[i]
    if (!diagnostic.fix) continue
    for (const edit of diagnostic.fix) {
      edits.push({ range: edit.range, text: edit.text, diagnosticIndex: i })
    }
  }

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
