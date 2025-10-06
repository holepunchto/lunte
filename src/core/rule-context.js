export class RuleContext {
  constructor({ filePath, source, diagnostics, scopeManager }) {
    this.filePath = filePath;
    this.source = source;
    this.diagnostics = diagnostics;
    this.scopeManager = scopeManager;
    this._ancestors = [];
    this._currentNode = null;
  }

  setTraversalState({ node, ancestors }) {
    this._currentNode = node;
    this._ancestors = ancestors;
  }

  report({ node, message, severity = 'error' }) {
    const target = node ?? this._currentNode;
    const loc = target?.loc?.start ?? {};
    this.diagnostics.push({
      filePath: this.filePath,
      message,
      severity,
      line: loc.line,
      column: loc.column != null ? loc.column + 1 : undefined,
    });
  }

  getAncestors() {
    return this._ancestors;
  }

  getParent() {
    return this._ancestors[this._ancestors.length - 1] ?? null;
  }

  getScopeManager() {
    return this.scopeManager;
  }

  getCurrentScope() {
    return this.scopeManager.getCurrentScope();
  }

  resolve(name, beforeIndex) {
    return this.scopeManager.resolve(name, beforeIndex);
  }

  getSource(node = this._currentNode) {
    if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') {
      return undefined;
    }
    return this.source.slice(node.start, node.end);
  }
}
