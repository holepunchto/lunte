import test from 'brittle'

import { resolveRuleConfig, resolveConfig } from '../src/config/resolve.js'

test('resolveRuleConfig applies overrides', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-unused-vars', severity: 'error' },
    { name: 'no-undef', severity: 'off' }
  ])

  const unused = config.get('no-unused-vars')
  const undef = config.get('no-undef')

  t.is(unused.severity, 'error')
  t.is(undef.severity, 'off')
})

test('resolveConfig merges envs and globals', (t) => {
  const { globals } = resolveConfig({
    envNames: ['browser'],
    globals: ['MY_APP']
  })

  t.ok(globals.has('window'))
  t.ok(globals.has('MY_APP'))
  t.ok(globals.has('console'))
})
