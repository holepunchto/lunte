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

          if (imports.has(source)) {
            const firstImport = imports.get(source)
            context.report({
              node: statement,
              message: `'${source}' import is duplicated.`,
              data: {
                module: source,
                firstImportLine: firstImport.loc?.start?.line
              }
            })
          } else {
            imports.set(source, statement)
          }
        }
      }
    }
  }
}
