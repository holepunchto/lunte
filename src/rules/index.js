import { noUseBeforeDefine } from './no-use-before-define.js'
import { noUndef } from './no-undef.js'
import { noUnusedVars } from './no-unused-vars.js'

export const builtInRules = new Map()

registerRule(noUseBeforeDefine)
registerRule(noUndef)
registerRule(noUnusedVars)

export function registerRule(rule) {
  if (!rule || typeof rule.meta?.name !== 'string') {
    throw new Error('Rule must define meta.name.')
  }

  builtInRules.set(rule.meta.name, rule)
}
