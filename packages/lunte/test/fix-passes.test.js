import test from 'brittle'

import { analyze, MAX_FIX_PASSES } from '../src/core/analyzer.js'
import { applyFixes } from '../src/core/fixes.js'
import { builtInRules, registerRule } from '../src/rules/index.js'

function only(...ruleNames) {
  return Array.from(builtInRules.keys()).map((name) => ({
    name,
    severity: ruleNames.includes(name) ? 'error' : 'off'
  }))
}

function useRule(t, name, create) {
  registerRule({ meta: { name }, create })
  t.teardown(() => {
    builtInRules.delete(name)
  })
}

async function fixSource(source, ruleOverrides) {
  const file = '/virtual/fix-passes.js'
  const result = await analyze({
    files: [file],
    ruleOverrides,
    fix: true,
    write: false,
    sourceOverrides: new Map([[file, source]])
  })
  return { ...result, output: result.fixedOutputs.get(file) }
}

function wrapBodyRule(context) {
  return {
    IfStatement(node) {
      const body = node.consequent
      if (body.type === 'BlockStatement') return
      const text = context.source.slice(body.start, body.end)
      context.report({
        node: body,
        message: 'Wrap body.',
        fix: [{ range: [body.start, body.end], text: `{ ${text} }` }]
      })
    }
  }
}

function rewriteIfRule(context) {
  return {
    IfStatement(node) {
      const body = node.consequent
      if (body.type === 'BlockStatement') return
      const test = context.source.slice(node.test.start, node.test.end)
      const text = context.source.slice(body.start, body.end)
      context.report({
        node,
        message: 'Rewrite if.',
        fix: [{ range: [node.start, node.end], text: `if (${test}) { ${text} }` }]
      })
    }
  }
}

test('applyFixes applies all edits of a fix or none', (t) => {
  const source = 'abcdef'
  const result = applyFixes({
    source,
    diagnostics: [
      {
        fix: [
          { range: [0, 0], text: '<' },
          { range: [3, 3], text: '>' }
        ]
      },
      { fix: [{ range: [2, 4], text: 'XX' }] },
      { fix: [{ range: [5, 6], text: 'F' }] }
    ]
  })

  t.is(result.output, '<abc>deF')
  t.is(result.appliedEdits, 3)
  t.is(result.appliedDiagnostics, 2)
})

test('overlapping multi-edit fixes from two rules never half-apply (body wrap)', async (t) => {
  useRule(t, 'test/wrap-body', wrapBodyRule)

  const source = 'if (x)\n  foo()\n'
  const result = await fixSource(source, only('curly', 'test/wrap-body'))

  t.is(result.output, 'if (x) {\n  foo()\n}\n', 'curly wins, no doubled braces')
  t.is(result.fixedEdits, 2)
  t.is(result.fixedDiagnostics, 1)
  t.is(result.diagnostics.length, 0)
})

test('overlapping multi-edit fixes from two rules never half-apply (statement rewrite)', async (t) => {
  useRule(t, 'test/rewrite-if', rewriteIfRule)

  const source = 'if (x)\n  foo()\n'
  const result = await fixSource(source, only('curly', 'test/rewrite-if'))

  t.is(result.output, 'if (x) { foo() }\n', 'rewrite wins, curly skipped entirely')
  t.is(result.fixedEdits, 1)
  t.is(result.fixedDiagnostics, 1)
  t.is(result.diagnostics.length, 0)
})

test('nested braceless statements are fully fixed in one run', async (t) => {
  const source = 'for (const x of xs)\n  if (x)\n    foo(x)\n'
  const result = await fixSource(source, only('curly'))

  t.is(result.output, 'for (const x of xs) {\n  if (x) {\n    foo(x)\n  }\n}\n')
  t.is(result.fixedEdits, 4, 'edits counted across passes')
  t.is(result.fixedDiagnostics, 2, 'diagnostics counted across passes')
  t.is(result.fixedFiles, 1)
  t.is(result.diagnostics.length, 0)
})

test('fix passes stop at the cap for a fix that never converges', async (t) => {
  useRule(t, 'test/never-converges', (context) => ({
    Program(node) {
      context.report({
        node,
        message: 'Always more.',
        fix: [{ range: [0, 0], text: ';' }]
      })
    }
  }))

  const result = await fixSource('foo()\n', only('test/never-converges'))

  t.is(MAX_FIX_PASSES, 10)
  t.is(result.output, ';'.repeat(MAX_FIX_PASSES) + 'foo()\n')
  t.is(result.fixedEdits, MAX_FIX_PASSES)
  t.is(result.fixedDiagnostics, MAX_FIX_PASSES)
  t.is(result.diagnostics.length, 1, 'remaining diagnostic is still reported')
})

test('fix pass producing unparsable output is discarded', async (t) => {
  useRule(t, 'test/breaks-code', (context) => ({
    IfStatement(node) {
      if (node.consequent.type !== 'BlockStatement') return
      context.report({
        node,
        message: 'Break it.',
        fix: [{ range: [node.end, node.end], text: '(' }]
      })
    }
  }))

  const source = 'if (x)\n  foo()\n'
  const result = await fixSource(source, only('curly', 'test/breaks-code'))

  t.is(result.output, 'if (x) {\n  foo()\n}\n', 'keeps the last good source')
  t.is(result.fixedEdits, 2)
  t.is(result.fixedDiagnostics, 1)
  t.alike(
    result.diagnostics.map((d) => d.ruleId),
    ['test/breaks-code'],
    'reports diagnostics of the last good source'
  )
})

test('first fix pass producing unparsable output leaves the source untouched', async (t) => {
  useRule(t, 'test/always-breaks', (context) => ({
    Program(node) {
      context.report({
        node,
        message: 'Break it.',
        fix: [{ range: [0, 0], text: '(' }]
      })
    }
  }))

  const result = await fixSource('foo()\n', only('test/always-breaks'))

  t.is(result.output, undefined, 'no fixed output')
  t.is(result.fixedEdits, 0)
  t.is(result.fixedFiles, 0)
  t.alike(
    result.diagnostics.map((d) => d.ruleId),
    ['test/always-breaks'],
    'reports the original diagnostics instead of a parse error'
  )
})
