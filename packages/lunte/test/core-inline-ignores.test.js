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

  t.ok(matcher.shouldIgnore({ line: 4, ruleId: 'no-undef' }), 'next-line directive targets following line')
  t.is(
    matcher.shouldIgnore({ line: 4, ruleId: 'no-unused-vars' }),
    false,
    'next-line directive limited to listed rules'
  )

  t.ok(matcher.shouldIgnore({ line: 5, ruleId: 'no-unused-vars' }), 'multiple rule ids parsed from comma list')
  t.ok(matcher.shouldIgnore({ line: 5, ruleId: 'no-undef' }))
  t.is(
    matcher.shouldIgnore({ line: 5, ruleId: 'no-debugger' }),
    false,
    'unlisted rule remains active'
  )
})

test('buildInlineIgnoreMatcher preserves specific directives when all-rules already applied', (t) => {
  const matcher = buildInlineIgnoreMatcher([
    makeComment('lunte-disable-line', 10),
    makeComment('lunte-disable-line no-undef', 10)
  ])

  t.ok(matcher.shouldIgnore({ line: 10, ruleId: 'no-undef' }), 'all directive takes precedence')
  t.ok(matcher.shouldIgnore({ line: 10, ruleId: 'anything' }))
})
