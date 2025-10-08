import test from 'brittle'

import { extractFileDirectives } from '../src/core/file-directives.js'

test('extractFileDirectives supports global and globals directives', (t) => {
  const source = `/*global foo:false, bar*/\n/*globals baz*/\n// globals qux\nconsole.log(foo, bar, baz, qux)\n`
  const directives = extractFileDirectives(source)

  t.ok(directives.globals.has('foo'))
  t.ok(directives.globals.has('bar'))
  t.ok(directives.globals.has('baz'))
  t.ok(directives.globals.has('qux'))
})

test('extractFileDirectives parses eslint-env directives', (t) => {
  const source = `/* eslint-env browser, node */\n/*globals foo*/\nconsole.log(foo)\n`
  const directives = extractFileDirectives(source)

  t.ok(directives.envs.has('browser'))
  t.ok(directives.envs.has('node'))
  t.is(directives.envs.has('foo'), false)
})
