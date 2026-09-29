import { getLineInfo } from '../../vendor/acorn/dist/acorn.mjs'

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
    this.globals = globals
    this.ignoreMatcher = ignoreMatcher
  }

  setTraversalState({ node, ancestors }) {
    this._currentNode = node
    this._ancestors = ancestors
  }

  report({ node, message, severity, fix }) {
    const target = node ?? this._currentNode
    const startLoc = this._resolvePosition(target?.loc?.start, target?.start) ?? {}
    const endLoc = this._resolvePosition(target?.loc?.end, target?.end) ?? startLoc
    const line = startLoc.line

    if (
      this.ignoreMatcher.shouldIgnore({ line, ruleId: this.ruleId }) ||
      this.ignoreMatcher.shouldIgnore({ line: endLoc.line, ruleId: this.ruleId })
    ) {
      return
    }

    const diagnostic = {
      filePath: this.filePath,
      message,
      severity: severity ?? this.ruleSeverity,
      ruleId: this.ruleId,
      line,
      column: startLoc.column !== undefined ? startLoc.column + 1 : undefined
    }

    if (fix) {
      diagnostic.fix = fix
    }

    this.diagnostics.push(diagnostic)
  }

  _resolvePosition(position, offset) {
    if (typeof position?.line === 'number') {
      return position
    }
    if (typeof offset !== 'number' || typeof this.source !== 'string') {
      return undefined
    }
    return getLineInfo(this.source, Math.max(0, Math.min(offset, this.source.length)))
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
