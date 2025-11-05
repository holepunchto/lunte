import test from 'brittle'
import { formatConsoleReport } from '../src/core/reporter.js'

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '')
}

test('reports success message when no diagnostics', (t) => {
  const output = formatConsoleReport({ diagnostics: [] })
  t.ok(stripAnsi(output).includes('No issues found'))
})

test('formats error diagnostics with summaries', (t) => {
  const output = formatConsoleReport({
    diagnostics: [
      {
        filePath: 'file.js',
        line: 1,
        column: 2,
        severity: 'error',
        message: 'Oops'
      },
      {
        filePath: 'file.js',
        line: 2,
        column: 3,
        severity: 'warning',
        message: 'Look out'
      }
    ]
  })
  const clean = stripAnsi(output)
  t.ok(clean.includes('file.js:1:2  ERROR'))
  t.ok(clean.includes('file.js:2:3  WARNING'))
  t.ok(clean.includes('1 error, 1 warning'))
})

test('formats error diagnostics with summaries and no filePath', (t) => {
  const output = formatConsoleReport({
    diagnostics: [
      {
        line: 1,
        column: 2,
        severity: 'error',
        message: 'Oops'
      },
      {
        line: 2,
        column: 3,
        severity: 'warning',
        message: 'Look out'
      }
    ]
  })
  const clean = stripAnsi(output)
  t.ok(clean.includes('input:1:2  ERROR'))
  t.ok(clean.includes('input:2:3  WARNING'))
  t.ok(clean.includes('1 error, 1 warning'))
})
