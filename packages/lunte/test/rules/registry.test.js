import test from 'brittle'

import { builtInRules } from '../../src/rules/index.js'

test('builtInRules exposes expected rule names', (t) => {
  const expected = [
    'no-use-before-define',
    'no-undef',
    'no-unused-vars',
    'no-debugger',
    'no-var',
    'no-case-declarations',
    'no-return-assign',
    'no-multi-str',
    'no-empty',
    'no-extra-boolean-cast'
  ]

  t.alike(Array.from(builtInRules.keys()).sort(), expected.sort())
})
