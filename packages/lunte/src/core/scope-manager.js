export class Scope {
  constructor(type, parent = null) {
    this.type = type
    this.parent = parent
    this.children = []
    this.declarations = new Map()
    this.references = []
  }

  declare(name, info) {
    if (!this.declarations.has(name)) {
      this.declarations.set(name, [])
    }
    this.declarations.get(name).push(info)
  }

  getDeclarations(name) {
    return this.declarations.get(name) ?? []
  }

  addReference(ref) {
    this.references.push(ref)
  }

  getReferences() {
    return this.references
  }
}

export class ScopeManager {
  constructor() {
    this.currentScope = null
    this.globalScope = null
  }

  enterScope(type, node) {
    const scope = new Scope(type, this.currentScope)
    scope.node = node
    if (this.currentScope) {
      this.currentScope.children.push(scope)
    }
    this.currentScope = scope
    if (!this.globalScope) {
      this.globalScope = scope
    }
    return scope
  }

  exitScope() {
    if (!this.currentScope) return
    this.currentScope = this.currentScope.parent
  }

  declare(name, info, options = {}) {
    const targetScope = this.#resolveTargetScope(options)
    targetScope.declare(name, info)
  }

  resolve(name, beforeIndex) {
    let scope = this.currentScope
    while (scope) {
      const declarations = scope.getDeclarations(name)
      const match = declarations.find((decl) => {
        if (scope.type === 'program') {
          return true
        }
        if (decl.hoisted) return true
        if (typeof beforeIndex !== 'number') return true
        return decl.index <= beforeIndex
      })
      if (match) {
        return match
      }
      scope = scope.parent
    }
    return null
  }

  addReference(ref) {
    if (!this.currentScope) {
      throw new Error('Cannot add reference without an active scope.')
    }
    this.currentScope.addReference(ref)
  }

  getReferences(scope = this.currentScope) {
    if (!scope) return []
    return scope.getReferences()
  }

  getCurrentScope() {
    return this.currentScope
  }

  #resolveTargetScope(options) {
    let scope = this.currentScope
    if (!scope) {
      throw new Error('Cannot declare without an active scope.')
    }

    if (options.hoistTo === 'function') {
      while (scope && scope.type !== 'function' && scope.type !== 'program') {
        scope = scope.parent
      }
      if (!scope) {
        throw new Error('No function scope available for hoisted declaration.')
      }
      return scope
    }

    return scope
  }
}
