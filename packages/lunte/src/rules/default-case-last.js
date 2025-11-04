import { Severity } from '../core/constants.js'

export const defaultCaseLast = {
  meta: {
    name: 'default-case-last',
    description: 'Enforce default clauses to be last in switch statements.',
    recommended: true,
    defaultSeverity: Severity.error
  },
  create(context) {
    return {
      SwitchStatement(node) {
        if (!Array.isArray(node.cases) || node.cases.length === 0) {
          return
        }

        let defaultIndex = -1

        for (let index = 0; index < node.cases.length; index += 1) {
          const switchCase = node.cases[index]
          if (!switchCase || switchCase.test) {
            continue
          }
          defaultIndex = index
          break
        }

        if (defaultIndex === -1 || defaultIndex === node.cases.length - 1) {
          return
        }

        context.report({
          node: node.cases[defaultIndex],
          message: 'Default clause should be the last case.'
        })
      }
    }
  }
}
