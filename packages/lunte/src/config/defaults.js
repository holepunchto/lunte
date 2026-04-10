import { builtInRules } from '../rules/index.js'
import { Severity } from '../core/constants.js'

export function getDefaultRuleConfig() {
  const config = new Map()

  for (const [name, rule] of builtInRules.entries()) {
    const severity = rule.meta?.defaultSeverity ?? Severity.error
    const applicableToTypeDefinitions = rule.meta?.applicableToTypeDefinitions ?? true
    config.set(name, { severity, applicableToTypeDefinitions })
  }

  return config
}
