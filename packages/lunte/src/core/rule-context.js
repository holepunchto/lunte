import { Severity } from './constants.js'

export class RuleContext {
  constructor({
    filePath,
    source,
    diagnostics,
    scopeManager,
    ruleId,
    ruleSeverity = Severity.error,
    globals,
    ignoreMatcher
  }) {
    this.filePath = filePath
    this.source = source
    this.diagnostics = diagnostics
    this.scopeManager = scopeManager
    this._ancestors = []
    this._currentNode = null
    this.ruleId = ruleId
    this.ruleSeverity = ruleSeverity
    this.globals = globals ?? new Set()
    this.ignoreMatcher =
      ignoreMatcher ?? {
        shouldIgnore() {
          return false
        }
      }
  }

  setTraversalState({ node, ancestors }) {
    this._currentNode = node
    this._ancestors = ancestors
  }

  report({ node, message, severity }) {
    const target = node ?? this._currentNode
    const loc = target?.loc?.start ?? {}
    const line = loc.line

    if (
      this.ignoreMatcher?.shouldIgnore({
        line,
        ruleId: this.ruleId
      })
    ) {
      return
    }

    this.diagnostics.push({
      filePath: this.filePath,
      message,
      severity: severity ?? this.ruleSeverity ?? Severity.error,
      ruleId: this.ruleId,
      line,
      column: loc.column != null ? loc.column + 1 : undefined
    })
  }

  getAncestors() {
    return this._ancestors
  }

  getParent() {
    return this._ancestors[this._ancestors.length - 1] ?? null
  }

  getScopeManager() {
    return this.scopeManager
  }

  getCurrentScope() {
    return this.scopeManager.getCurrentScope()
  }

  resolve(name, beforeIndex) {
    return this.scopeManager.resolve(name, beforeIndex)
  }

  addReference(ref) {
    this.scopeManager.addReference(ref)
  }

  getReferences(scope) {
    return this.scopeManager.getReferences(scope)
  }

  isGlobal(name) {
    return this.globals.has(name)
  }

  getGlobals() {
    return this.globals
  }

  getSource(node = this._currentNode) {
    if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') {
      return undefined
    }
    return this.source.slice(node.start, node.end)
  }
}
