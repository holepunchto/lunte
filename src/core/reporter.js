export function formatConsoleReport({ diagnostics }) {
  if (!diagnostics || diagnostics.length === 0) {
    return '✓ No issues found';
  }

  const lines = diagnostics.map(formatDiagnosticLine);
  const summary = buildSummary(diagnostics);
  return [...lines, summary].join('\n');
}

function formatDiagnosticLine(diag) {
  const location = diag.line != null ? `${diag.line}:${diag.column ?? 1}` : '?:?';
  return `${diag.filePath}:${location}  ${diag.severity.toUpperCase()}  ${diag.message}`;
}

function buildSummary(diagnostics) {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const parts = [];
  if (errorCount) parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  if (warningCount) parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
}
