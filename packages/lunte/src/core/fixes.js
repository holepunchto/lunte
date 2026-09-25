export function applyFixes({ source, diagnostics }) {
  const fixes = []

  for (let i = 0; i < diagnostics.length; i++) {
    const diagnostic = diagnostics[i]
    if (!diagnostic.fix || diagnostic.fix.length === 0) continue
    const edits = diagnostic.fix
      .map((edit, order) => ({ range: edit.range, text: edit.text, order }))
      .sort(compareEdits)
    fixes.push({ edits, diagnosticIndex: i })
  }

  if (fixes.length === 0) {
    return {
      output: source,
      appliedEdits: 0,
      appliedDiagnostics: 0
    }
  }

  fixes.sort(
    (a, b) => compareEdits(a.edits[0], b.edits[0]) || a.diagnosticIndex - b.diagnosticIndex
  )

  const accepted = []
  let appliedDiagnostics = 0

  for (const fix of fixes) {
    if (hasSelfOverlap(fix.edits)) continue
    if (fix.edits.some((edit) => accepted.some((other) => editsConflict(edit, other)))) {
      continue
    }

    for (const edit of fix.edits) {
      accepted.push({ ...edit, order: accepted.length })
    }
    appliedDiagnostics += 1
  }

  accepted.sort(compareEdits)

  let cursor = 0
  let output = ''

  for (const edit of accepted) {
    const [start, end] = edit.range
    output += source.slice(cursor, start)
    output += edit.text
    cursor = end
  }

  output += source.slice(cursor)

  return {
    output,
    appliedEdits: accepted.length,
    appliedDiagnostics
  }
}

function compareEdits(a, b) {
  return a.range[0] - b.range[0] || a.range[1] - b.range[1] || a.order - b.order
}

function hasSelfOverlap(edits) {
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].range[0] < edits[i - 1].range[1]) return true
  }
  return false
}

function editsConflict(a, b) {
  const [aStart, aEnd] = a.range
  const [bStart, bEnd] = b.range
  if (aStart === aEnd || bStart === bEnd) {
    return aStart <= bEnd && bStart <= aEnd
  }
  return aStart < bEnd && bStart < aEnd
}
