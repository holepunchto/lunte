import test from 'brittle'

import { resolveRuleConfig, resolveConfig } from '../src/config/resolve.js'
import { mergeRuleOptions } from '../src/config/rule-options.js'

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

test('mergeRuleOptions merges configured options into the defaults, as ESLint does', (t) => {
  const defaults = [{ max: 40, ignore: ['a'], nested: { on: true, depth: 1 } }, 'strict']

  t.alike(mergeRuleOptions(defaults, [{ max: 60 }]), [
    { max: 60, ignore: ['a'], nested: { on: true, depth: 1 } },
    'strict'
  ])
  t.alike(
    mergeRuleOptions(defaults, [{ ignore: ['b'], nested: { depth: 2 } }]),
    [{ max: 40, ignore: ['b'], nested: { on: true, depth: 2 } }, 'strict'],
    'arrays replace, objects merge'
  )
  t.alike(
    mergeRuleOptions(defaults, [undefined, 'loose', { extra: 1 }]),
    [defaults[0], 'loose', { extra: 1 }],
    'undefined keeps the default, extra positions pass through'
  )
  t.alike(
    mergeRuleOptions(['x'], [{ a: 1 }]),
    [{ a: 1 }],
    'an object replaces a non-object default'
  )
})

test('mergeRuleOptions handles missing defaults or options', (t) => {
  t.alike(mergeRuleOptions(undefined, undefined), [])
  t.alike(mergeRuleOptions(undefined, [{ max: 1 }]), [{ max: 1 }])
  t.alike(mergeRuleOptions([{ max: 40 }], undefined), [{ max: 40 }])
  t.alike(
    mergeRuleOptions({ max: 40 }, [{ max: 60 }]),
    [{ max: 60 }],
    'defaults that are not an array are ignored, not the config'
  )
})

test('mergeRuleOptions only merges plain objects', (t) => {
  const pattern = /b/g
  const [merged] = mergeRuleOptions([{ pattern: /a/g }], [{ pattern }])

  t.is(merged.pattern, pattern, 'a regex replaces the default instead of merging into it')
})
