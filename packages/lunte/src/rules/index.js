import { noUseBeforeDefine } from './no-use-before-define.js'
import { noUndef } from './no-undef.js'
import { noUnusedVars } from './no-unused-vars.js'
import { noDebugger } from './no-debugger.js'
import { noVar } from './no-var.js'
import { noCaseDeclarations } from './no-case-declarations.js'
import { noReturnAssign } from './no-return-assign.js'
import { noMultiStr } from './no-multi-str.js'
import { noEmpty } from './no-empty.js'
import { noExtraBooleanCast } from './no-extra-boolean-cast.js'
import { noConstAssign } from './no-const-assign.js'
import { noDuplicateCase } from './no-duplicate-case.js'
import { noFallthrough } from './no-fallthrough.js'
import { eqeqeq } from './eqeqeq.js'
import { noUnreachable } from './no-unreachable.js'
import { noCondAssign } from './no-cond-assign.js'
import { noDupeKeys } from './no-dupe-keys.js'
import { noEmptyPattern } from './no-empty-pattern.js'
import { preferConst } from './prefer-const.js'
import { curly } from './curly.js'
import { constructorSuper } from './constructor-super.js'
import { importNoDuplicates } from './import-no-duplicates.js'
import { noRedeclare } from './no-redeclare.js'
import { defaultCaseLast } from './default-case-last.js'
import { packageJsonExportsOrder } from './package-json-exports-order.js'

export const builtInRules = new Map()

registerRule(noUseBeforeDefine)
registerRule(noUndef)
registerRule(noUnusedVars)
registerRule(noDebugger)
registerRule(noVar)
registerRule(noCaseDeclarations)
registerRule(noReturnAssign)
registerRule(noMultiStr)
registerRule(noEmpty)
registerRule(noExtraBooleanCast)
registerRule(noConstAssign)
registerRule(noDuplicateCase)
registerRule(noFallthrough)
registerRule(eqeqeq)
registerRule(noUnreachable)
registerRule(noCondAssign)
registerRule(noDupeKeys)
registerRule(noEmptyPattern)
registerRule(preferConst)
registerRule(curly)
registerRule(constructorSuper)
registerRule(importNoDuplicates)
registerRule(noRedeclare)
registerRule(defaultCaseLast)
registerRule(packageJsonExportsOrder)

export function registerRule(rule) {
  if (!rule || typeof rule.meta?.name !== 'string') {
    throw new Error('Rule must define meta.name.')
  }

  builtInRules.set(rule.meta.name, rule)
}
