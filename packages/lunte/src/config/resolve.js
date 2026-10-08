import { builtInRules } from '../rules/index.js'
import { getDefaultRuleConfig } from './defaults.js'
import { Severity } from '../core/constants.js'
import { ENV_GLOBALS, BASE_GLOBALS, HOLEPUNCH_GLOBALS } from './envs.js'

const SEVERITY_ALIASES = new Map([
  ['off', Severity.off],
  ['0', Severity.off],
  ['warn', Severity.warning],
  ['warning', Severity.warning],
  ['1', Severity.warning],
  ['error', Severity.error],
  ['err', Severity.error],
  ['2', Severity.error]
])

export function resolveConfig({
  ruleOverrides = [],
  envNames = [],
  globals = [],
  disableHolepunchGlobals = false
} = {}) {
  const ruleConfig = resolveRuleConfig(ruleOverrides)
  const globalSet = new Set()

  for (const name of BASE_GLOBALS) {
    globalSet.add(name)
  }

  if (!disableHolepunchGlobals) {
    for (const name of HOLEPUNCH_GLOBALS) {
      globalSet.add(name)
    }
  }

  const activeEnvNames = new Set(envNames.length > 0 ? envNames : ['node'])
  for (const envName of activeEnvNames) {
    const entries = ENV_GLOBALS[envName]
    if (!entries) continue
    for (const name of entries) {
      globalSet.add(name)
    }
  }

  for (const name of globals) {
    if (typeof name === 'string' && name.trim()) {
      globalSet.add(name.trim())
    }
  }

  return { ruleConfig, globals: globalSet }
}

export function resolveRuleConfig(overrides = []) {
  const config = getDefaultRuleConfig()

  for (const override of overrides) {
    const { name, severity } = override ?? {}
    if (!name || !builtInRules.has(name)) {
      continue
    }
    const entry = normalizeRuleEntry(severity)
    if (!entry) {
      continue
    }
    // Like ESLint, a severity-only override keeps the options set before it.
    config.set(name, {
      severity: entry.severity,
      options: entry.options ?? config.get(name)?.options
    })
  }

  return config
}

export function normalizeRuleEntry(value) {
  const [first, ...options] = Array.isArray(value) ? value : [value]
  const severity = normalizeSeverity(first)
  if (!severity) {
    return null
  }
  return { severity, options: options.length > 0 ? options : undefined }
}

export function normalizeSeverity(value) {
  if (typeof value === 'string') {
    const normalized = SEVERITY_ALIASES.get(value.toLowerCase())
    if (normalized) {
      return normalized
    }
  }
  if (typeof value === 'number') {
    return normalizeSeverity(String(value))
  }
  return null
}
