import { Severity } from './constants.js';

const colorSupport = process.stdout.isTTY;

const COLORS = colorSupport
  ? {
      reset: '\u001b[0m',
      dim: '\u001b[2m',
      red: '\u001b[31m',
      yellow: '\u001b[33m',
      green: '\u001b[32m',
    }
  : {
      reset: '',
      dim: '',
      red: '',
      yellow: '',
      green: '',
    };

export function formatConsoleReport({ diagnostics }) {
  if (!diagnostics || diagnostics.length === 0) {
    return `${COLORS.green}✓ No issues found${COLORS.reset}`;
  }

  const lines = diagnostics.map(formatDiagnosticLine);
  const summary = buildSummary(diagnostics);
  return [...lines, summary].join('\n');
}

function formatDiagnosticLine(diag) {
  const location = diag.line != null ? `${diag.line}:${diag.column ?? 1}` : '?:?';
  const color = diag.severity === Severity.error ? COLORS.red : COLORS.yellow;
  const label = diag.severity.toUpperCase();
  return `${diag.filePath}:${location}  ${color}${label}${COLORS.reset}  ${diag.message}`;
}

function buildSummary(diagnostics) {
  const errorCount = diagnostics.filter((d) => d.severity === Severity.error).length;
  const warningCount = diagnostics.filter((d) => d.severity === Severity.warning).length;
  const parts = [];
  if (errorCount) parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  if (warningCount) parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`;
}
