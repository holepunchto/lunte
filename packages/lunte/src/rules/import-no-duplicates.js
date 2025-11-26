import { Severity } from '../core/constants.js'

export const importNoDuplicates = {
  meta: {
    name: 'import/no-duplicates',
    description: 'Disallow duplicate imports from the same module.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    const imports = new Map()

    return {
      'Program:exit'(node) {
        for (const statement of node.body) {
          if (statement.type !== 'ImportDeclaration') continue

          const source = statement.source.value

          const existing = imports.get(source)
          // Treat type-only and value imports as distinct buckets so users can
          // keep a separate type import alongside value imports (mirrors ESLint
          // import/no-duplicates allowTypeImports behavior).
          const kind = statement.importKind === 'type' ? 'type' : 'value'
          if (existing?.[kind]) {
            const firstImport = existing[kind]
            context.report({
              node: statement,
              message: `'${source}' import is duplicated.`,
              data: {
                module: source,
                firstImportLine: firstImport.loc?.start?.line
              }
            })
          } else {
            const next = existing ?? { type: null, value: null }
            next[kind] = statement
            imports.set(source, next)
          }
        }
      }
    }
  }
}
