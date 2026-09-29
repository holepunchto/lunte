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

test('resolveConfig includes Holepunch globals by default', (t) => {
  const { globals } = resolveConfig()

  t.ok(globals.has('Pear'))
  t.ok(globals.has('Bare'))
})

test('resolveConfig can disable Holepunch globals', (t) => {
  const { globals } = resolveConfig({ disableHolepunchGlobals: true })

  t.is(globals.has('Pear'), false)
  t.is(globals.has('Bare'), false)
})

test('resolveRuleConfig keeps severity-only entries free of options', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-unused-vars', severity: 'warn' },
    { name: 'no-undef', severity: 2 }
  ])

  t.alike(config.get('no-unused-vars'), { severity: 'warning', options: undefined })
  t.alike(config.get('no-undef'), { severity: 'error', options: undefined })
})

test('resolveRuleConfig accepts [severity, ...options]', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-unused-vars', severity: ['warn', { args: 'none' }, 'extra'] },
    { name: 'no-undef', severity: [0] }
  ])

  t.alike(config.get('no-unused-vars'), {
    severity: 'warning',
    options: [{ args: 'none' }, 'extra']
  })
  t.alike(config.get('no-undef'), { severity: 'off', options: undefined })
})

test('resolveRuleConfig keeps earlier options on a severity-only override', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-unused-vars', severity: ['error', { args: 'none' }] },
    { name: 'no-unused-vars', severity: 'warn' }
  ])

  t.alike(config.get('no-unused-vars'), { severity: 'warning', options: [{ args: 'none' }] })
})

test('resolveRuleConfig replaces earlier options with new ones', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-unused-vars', severity: ['error', { args: 'none' }] },
    { name: 'no-unused-vars', severity: ['error', { vars: 'local' }] }
  ])

  t.alike(config.get('no-unused-vars').options, [{ vars: 'local' }])
})

test('resolveRuleConfig ignores entries with an invalid severity', (t) => {
  const config = resolveRuleConfig([
    { name: 'no-undef', severity: ['loud', { max: 1 }] },
    { name: 'no-debugger', severity: [] }
  ])

  t.is(config.get('no-undef').severity, 'error')
  t.is(config.get('no-undef').options, undefined)
  t.is(config.get('no-debugger').severity, 'error')
})
