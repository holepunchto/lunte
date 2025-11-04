import { Severity } from './constants.js'

const DEFAULT_IGNORE_MATCHER = {
  shouldIgnore() {
    return false
  }
}

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
    this.ignoreMatcher = ignoreMatcher ?? DEFAULT_IGNORE_MATCHER
  }

  setTraversalState({ node, ancestors }) {
    this._currentNode = node ?? null
    this._ancestors = ancestors ?? []
  }

  report({ node, message, severity }) {
    const target = node ?? this._currentNode
    const startLoc = target?.loc?.start ?? {}
    const endLoc = target?.loc?.end ?? startLoc
    const line = startLoc.line

    const ignoreMatcher = this.ignoreMatcher
    if (ignoreMatcher) {
      const shouldSkipStart = ignoreMatcher.shouldIgnore({
        line,
        ruleId: this.ruleId
      })
      const shouldSkipEnd =
        !shouldSkipStart && endLoc.line !== null && endLoc.line !== undefined
          ? ignoreMatcher.shouldIgnore({ line: endLoc.line, ruleId: this.ruleId })
          : false
      if (shouldSkipStart || shouldSkipEnd) {
        return
      }
    }

    this.diagnostics.push({
      filePath: this.filePath,
      message,
      severity: severity ?? this.ruleSeverity ?? Severity.error,
      ruleId: this.ruleId,
      line,
      column: startLoc.column !== null && startLoc.column !== undefined ? startLoc.column + 1 : undefined
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
