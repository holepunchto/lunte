import test from 'brittle'

import { buildInlineIgnoreMatcher } from '../src/core/inline-ignores.js'

function makeComment(value, line, endLine = line) {
  return {
    value,
    loc: {
      start: { line },
      end: { line: endLine }
    }
  }
}

test('buildInlineIgnoreMatcher handles line and next-line directives', (t) => {
  const matcher = buildInlineIgnoreMatcher([
    makeComment(' lunte-disable-line ', 2),
    makeComment('lunte-disable-next-line no-undef', 3),
    makeComment('lunte-disable-line no-unused-vars, no-undef', 5)
  ])

  t.ok(matcher.shouldIgnore({ line: 2, ruleId: 'no-undef' }), 'line directive suppresses all rules')
  t.ok(matcher.shouldIgnore({ line: 2, ruleId: 'random-rule' }))

  t.ok(
    matcher.shouldIgnore({ line: 4, ruleId: 'no-undef' }),
    'next-line directive targets following line'
  )
  t.is(matcher.shouldIgnore({ line: 4, ruleId: 'no-unused-vars' }), false)

  t.ok(
    matcher.shouldIgnore({ line: 5, ruleId: 'no-unused-vars' }),
    'multiple rule ids parsed from comma list'
  )
  t.ok(matcher.shouldIgnore({ line: 5, ruleId: 'no-undef' }))
  t.is(matcher.shouldIgnore({ line: 5, ruleId: 'no-debugger' }), false)
})

test('buildInlineIgnoreMatcher preserves specific directives when all-rules already applied', (t) => {
  const matcher = buildInlineIgnoreMatcher([
    makeComment('lunte-disable-line', 10),
    makeComment('lunte-disable-line no-undef', 10)
  ])

  t.ok(matcher.shouldIgnore({ line: 10, ruleId: 'no-undef' }), 'all directive takes precedence')
  t.ok(matcher.shouldIgnore({ line: 10, ruleId: 'anything' }))
})

test('shouldIgnore treats missing ruleId as match when specific rules provided', (t) => {
  const matcher = buildInlineIgnoreMatcher([
    makeComment('lunte-disable-line no-undef, no-unused-vars', 7)
  ])

  t.ok(
    matcher.shouldIgnore({ line: 7 }),
    'unspecified rule should still be suppressed when directive lists rules'
  )
})

test('non-directive comments do not affect ignore matcher', (t) => {
  const matcher = buildInlineIgnoreMatcher([
    makeComment('just a comment', 4),
    makeComment('another one', 5)
  ])

  t.is(matcher.shouldIgnore({ line: 4, ruleId: 'no-undef' }), false)
  t.is(matcher.shouldIgnore({ line: 5, ruleId: 'no-undef' }), false)
})

test('next-line directive applies to following line even with trailing whitespace', (t) => {
  const matcher = buildInlineIgnoreMatcher([makeComment('lunte-disable-next-line   ', 12)])

  t.ok(matcher.shouldIgnore({ line: 13, ruleId: 'no-undef' }))
  t.is(matcher.shouldIgnore({ line: 12, ruleId: 'no-undef' }), false)
})

test('file-level disable applies to all subsequent lines', (t) => {
  const matcher = buildInlineIgnoreMatcher([makeComment(' eslint-disable no-var ', 3, 3)])

  t.ok(matcher.shouldIgnore({ line: 3, ruleId: 'no-var' }))
  t.ok(matcher.shouldIgnore({ line: 200, ruleId: 'no-var' }))
  t.is(matcher.shouldIgnore({ line: 200, ruleId: 'no-undef' }), false)
})

test('file-level disable without rules suppresses all rules', (t) => {
  const matcher = buildInlineIgnoreMatcher([makeComment(' eslint-disable ', 1, 1)])

  t.ok(matcher.shouldIgnore({ line: 1, ruleId: 'anything' }))
  t.ok(matcher.shouldIgnore({ line: 500, ruleId: 'no-unused-vars' }))
})
