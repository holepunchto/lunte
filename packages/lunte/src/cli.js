import process from 'process'
import { command, flag, rest, bail } from 'paparam'

import { analyze } from './core/analyzer.js'
import { formatConsoleReport } from './core/reporter.js'
import { Severity } from './core/constants.js'
import { resolveFileTargets } from './core/file-resolver.js'
import { loadIgnore } from './core/ignore.js'
import { loadConfig } from './config/loader.js'
import { loadPlugins } from './config/plugins.js'

const colorSupport = Boolean(process.stdout?.isTTY)
const VERBOSE_COLORS = colorSupport
  ? {
      reset: '\u001b[0m',
      red: '\u001b[31m',
      yellow: '\u001b[33m',
      green: '\u001b[32m'
    }
  : {
      reset: '',
      red: '',
      yellow: '',
      green: ''
    }

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
  flag('--plugin [names]', 'Load additional rule plugins (comma separated).').multiple(),
  flag('--typescript', 'Enable the experimental TypeScript parser.'),
  flag('--force-ts-parser', 'Force the TypeScript parser for .js/.jsx (implies --typescript).'),
  flag('--verbose|-v', 'Print additional information while analyzing.'),
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

  const files = Array.isArray(parser.rest) ? parser.rest : ['.']
  if (files.length === 0) {
    console.error('No input files specified.')
    return 1
  }

  const cwd = process.cwd()
  const { config } = await loadConfig({ cwd })
  const ignoreMatcher = await loadIgnore({ cwd })
  const enableTypeScriptParserForJS = Boolean(config.forceTsParser) || Boolean(parser.flags.forceTsParser)
  const enableTypeScriptParser =
    enableTypeScriptParserForJS || Boolean(config.typescript) || Boolean(parser.flags.typescript)
  const enableDependencyAmbientGlobals = Boolean(config.experimental__enableTSAmbientGlobals)
  const resolvedFiles = await resolveFileTargets(files, {
    ignore: ignoreMatcher,
    includeTypeScript: enableTypeScriptParser,
    includeJsx: enableTypeScriptParserForJS
  })
  if (resolvedFiles.length === 0) {
    console.error('No matching source files found.')
    return 1
  }

  const mergedEnv = safeMerge(config.env, parseList(parser.flags.env))
  const mergedGlobals = safeMerge(config.globals, parseList(parser.flags.global))
  const mergedRuleOverrides = mergeRuleOverrides(config.rules, parseRules(parser.flags.rule))
  const mergedPlugins = safeMerge(config.plugins, parseList(parser.flags.plugin))
  const disableHolepunchGlobals = Boolean(config.disableHolepunchGlobals)

  const verbose = Boolean(parser.flags.verbose)
  if (verbose) {
    console.log(`Analyzing ${resolvedFiles.length} file${resolvedFiles.length === 1 ? '' : 's'}:`)
  }

  await loadPlugins(mergedPlugins, {
    cwd,
    onError: (message) => console.warn(message)
  })

  const result = await analyze({
    files: resolvedFiles,
    ruleOverrides: mergedRuleOverrides,
    envOverrides: mergedEnv,
    globalOverrides: mergedGlobals,
    disableHolepunchGlobals,
    enableTypeScriptParser,
    enableTypeScriptParserForJS,
    enableDependencyAmbientGlobals,
    onFileComplete: verbose
      ? ({ filePath, diagnostics }) => {
          const hasError = diagnostics.some((d) => d.severity === Severity.error)
          const hasWarning = diagnostics.some((d) => d.severity === Severity.warning)
          const color = hasError
            ? VERBOSE_COLORS.red
            : hasWarning
              ? VERBOSE_COLORS.yellow
              : VERBOSE_COLORS.green
          const symbol = hasError ? '✕' : hasWarning ? '!' : '✓'
          const detail = hasError ? ' (errors)' : hasWarning ? ' (warnings)' : ''
          console.log(`  ${color}${symbol}${VERBOSE_COLORS.reset} ${filePath}${detail}`)
        }
      : undefined
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
