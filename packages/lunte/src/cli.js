import { command, flag, rest, bail } from 'paparam'

import { analyze } from './core/analyzer.js'
import { formatConsoleReport } from './core/reporter.js'
import { Severity } from './core/constants.js'
import { resolveFileTargets } from './core/file-resolver.js'
import { loadIgnore } from './core/ignore.js'
import { loadConfig } from './config/loader.js'

const parser = command(
  'lunte',
  bail(({ reason, flag, arg }) => {
    if (flag) {
      const name = flag.long ? `--${flag.name}` : `-${flag.name}`
      if (reason === 'UNKNOWN_FLAG') return `Unknown option: ${name}`
      if (reason === 'INVALID_FLAG') return `Invalid usage for option: ${name}`
    }
    if (arg && reason === 'UNKNOWN_ARG') return `Unknown argument: ${arg.value}`
    return reason
  }),
  flag('--rule [name=severity]', 'Override rule severity (error, warn, off).').multiple(),
  flag('--env [names]', 'Enable predefined environment globals (comma separated).').multiple(),
  flag('--global [names]', 'Declare additional global variables (comma separated).').multiple(),
  rest('[...files]', 'Files, directories, or glob patterns to analyze.')
)

export async function run(argv = []) {
  parser.parse(argv, { silent: true })

  if (parser.bailed?.output) {
    console.error(parser.bailed.output)
    return 1
  }

  if (parser.flags.help) {
    console.log(parser.help())
    return 0
  }

  const files = Array.isArray(parser.rest) ? parser.rest : []
  if (files.length === 0) {
    console.error('No input files specified.')
    return 1
  }

  const cwd = process.cwd()
  const { config } = await loadConfig({ cwd })
  const ignoreMatcher = await loadIgnore({ cwd })
  const resolvedFiles = await resolveFileTargets(files, { ignore: ignoreMatcher })
  if (resolvedFiles.length === 0) {
    console.error('No JavaScript files found.')
    return 1
  }

  const mergedEnv = safeMerge(config.env, parseList(parser.flags.env))
  const mergedGlobals = safeMerge(config.globals, parseList(parser.flags.global))
  const mergedRuleOverrides = mergeRuleOverrides(config.rules, parseRules(parser.flags.rule))

  const result = await analyze({
    files: resolvedFiles,
    ruleOverrides: mergedRuleOverrides,
    envOverrides: mergedEnv,
    globalOverrides: mergedGlobals
  })
  console.log(formatConsoleReport(result))

  const hasErrors = result.diagnostics.some((d) => d.severity === Severity.error)
  return hasErrors ? 1 : 0
}

const intoArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])

const parseList = (values) =>
  intoArray(values)
    .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    .map((item) => item.trim())
    .filter(Boolean)
const parseRules = (values) =>
  intoArray(values)
    .map((value) => (typeof value === 'string' ? value.split('=').map((part) => part.trim()) : []))
    .filter(([name, severity]) => name && severity)
    .map(([name, severity]) => ({ name, severity }))

function safeMerge(one = [], two = []) {
  return [...one, ...two]
}

function mergeRuleOverrides(configRules = {}, cliOverrides = []) {
  const merged = []
  for (const [name, severity] of Object.entries(configRules ?? {})) {
    merged.push({ name, severity })
  }
  return [...merged, ...cliOverrides]
}
