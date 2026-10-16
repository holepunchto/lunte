import test from 'brittle'

import { ScopeManager } from '../src/core/scope-manager.js'

function enterProgram(scopeManager) {
  return scopeManager.enterScope('program', { type: 'Program' })
}

test('enterScope initialises global scope', (t) => {
  const manager = new ScopeManager()
  const program = enterProgram(manager)

  t.is(manager.getCurrentScope(), program)
  t.is(manager.globalScope, program)
})

test('exitScope restores parent scope', (t) => {
  const manager = new ScopeManager()
  enterProgram(manager)
  const fnScope = manager.enterScope('function', { type: 'FunctionDeclaration' })

  manager.exitScope()
  t.is(manager.getCurrentScope().type, 'program')
  t.is(fnScope.parent.type, 'program')
})

test('declare stores identifiers in current scope', (t) => {
  const manager = new ScopeManager()
  enterProgram(manager)
  const info = { node: {}, index: 5 }
  manager.declare('foo', info)

  const declaration = manager.resolve('foo')
  t.is(declaration, info)
})

test('resolve climbs parent scopes when needed', (t) => {
  const manager = new ScopeManager()
  const program = enterProgram(manager)
  manager.declare('foo', { node: {}, index: 1 })
  const block = manager.enterScope('block', { type: 'BlockStatement' })
  manager.declare('bar', { node: {}, index: 2 })

  t.is(manager.resolve('foo').index, 1)
  t.is(manager.resolve('bar').index, 2)

  manager.exitScope()
  t.is(manager.getCurrentScope(), program)
})

test('resolve honours beforeIndex for non-hoisted declarations', (t) => {
  const manager = new ScopeManager()
  enterProgram(manager)
  const block = manager.enterScope('block', { type: 'BlockStatement' })
  manager.declare('later', { node: {}, index: 10, hoisted: false })

  t.is(manager.resolve('later', 5), null)
  t.is(manager.resolve('later', 10), block.getDeclarations('later')[0])
})

test('resolve treats hoisted declarations as always available', (t) => {
  const manager = new ScopeManager()
  enterProgram(manager)
  manager.declare('fn', { node: {}, hoisted: true })

  t.is(manager.resolve('fn', 0).hoisted, true)
  t.is(manager.resolve('fn', -1).hoisted, true)
})

test('declare with hoistTo:function targets nearest function scope', (t) => {
  const manager = new ScopeManager()
  enterProgram(manager)
  const fnScope = manager.enterScope('function', { type: 'FunctionDeclaration' })
  const blockScope = manager.enterScope('block', { type: 'BlockStatement' })

  manager.declare('hoisted', { node: {}, hoisted: true }, { hoistTo: 'function' })

  t.is(fnScope.getDeclarations('hoisted').length, 1)
  t.is(blockScope.getDeclarations('hoisted').length, 0)
})

test('declare with hoistTo:function without function scope falls back to program', (t) => {
  const manager = new ScopeManager()
  const program = enterProgram(manager)
  const block = manager.enterScope('block', { type: 'BlockStatement' })

  manager.declare('x', { node: {} }, { hoistTo: 'function' })

  t.is(program.getDeclarations('x').length, 1)
  t.is(block.getDeclarations('x').length, 0)
})

test('addReference stores references on current scope', (t) => {
  const manager = new ScopeManager()
  const program = enterProgram(manager)
  manager.addReference({ name: 'foo' })
  const block = manager.enterScope('block', { type: 'BlockStatement' })
  manager.addReference({ name: 'bar' })

  t.is(program.getReferences().length, 1)
  t.is(block.getReferences().length, 1)
})

test('getReferences returns empty array without scope', (t) => {
  const manager = new ScopeManager()
  t.is(manager.getReferences().length, 0)

  enterProgram(manager)
  t.is(manager.getReferences().length, 0)
})
