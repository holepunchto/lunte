import { analyze } from './core/analyzer.js'
import { formatConsoleReport } from './core/reporter.js'
import { Severity } from './core/constants.js'
import { resolveFileTargets } from './core/file-resolver.js'
import { loadIgnore } from './core/ignore.js'
import { loadConfig } from './config/loader.js'

export async function run(argv = []) {
  const options = parseArguments(argv)

  if (options.showHelp) {
    printHelp()
    return 0
  }

  // Placeholder: wire the analyzer once file reading is implemented.
  if (options.files.length === 0) {
    console.error('No input files specified.')
    return 1
  }

  const cwd = process.cwd()
  const { config } = await loadConfig({ cwd })
  const ignoreMatcher = await loadIgnore({ cwd })
  const files = await resolveFileTargets(options.files, { ignore: ignoreMatcher })
  if (files.length === 0) {
    console.error('No JavaScript files found.')
    return 1
  }

  const mergedEnv = mergeEnv(config.env, options.envs)
  const mergedGlobals = mergeGlobals(config.globals, options.globals)
  const mergedRuleOverrides = mergeRuleOverrides(config.rules, options.ruleOverrides)

  const result = await analyze({
    files,
    ruleOverrides: mergedRuleOverrides,
    envOverrides: mergedEnv,
    globalOverrides: mergedGlobals
  })
  const output = formatConsoleReport(result)
  console.log(output)

  const hasErrors = result.diagnostics.some((d) => d.severity === Severity.error)
  return hasErrors ? 1 : 0
}

function parseArguments(argv) {
  const files = []
  let showHelp = false
  const ruleOverrides = []
  const envs = []
  const globals = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      showHelp = true
      continue
    }

    if (arg.startsWith('--rule')) {
      const override = parseRuleOverride(arg, argv[i + 1])
      if (override) {
        ruleOverrides.push(override)
        if (!arg.includes('=')) {
          i += 1
        }
      }
      continue
    }

    if (arg.startsWith('--env')) {
      const value = parseListArgument(arg, argv[i + 1], '--env')
      if (value) {
        envs.push(...value)
        if (!arg.includes('=')) {
          i += 1
        }
      }
      continue
    }

    if (arg.startsWith('--global')) {
      const value = parseListArgument(arg, argv[i + 1], '--global')
      if (value) {
        globals.push(...value)
        if (!arg.includes('=')) {
          i += 1
        }
      }
      continue
    }

    files.push(arg)
  }

  return { files, showHelp, ruleOverrides, envs, globals }
}

function printHelp() {
  console.log('Usage: lunte [options] <file ...>')
  console.log('  --help, -h    Show this usage information.')
  console.log('  --rule name=severity  Override rule severity (error, warn, off).')
  console.log('  --env name             Enable predefined environment globals.')
  console.log('  --global name          Declare additional global variables.')
}

function parseRuleOverride(arg, nextValue) {
  let payload = null
  if (arg.startsWith('--rule=')) {
    payload = arg.slice('--rule='.length)
  } else if (arg === '--rule' && typeof nextValue === 'string') {
    payload = nextValue
  }

  if (!payload || !payload.includes('=')) {
    return null
  }

  const [name, severity] = payload.split('=')
  if (!name || !severity) {
    return null
  }

  return { name, severity }
}

function parseListArgument(arg, nextValue, flagName) {
  let payload = null
  if (arg.startsWith(`${flagName}=`)) {
    payload = arg.slice(flagName.length + 1)
  } else if (arg === flagName && typeof nextValue === 'string') {
    payload = nextValue
  }

  if (!payload) {
    return null
  }

  return payload
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function mergeEnv(configEnv = [], cliEnv = []) {
  return [...configEnv, ...cliEnv]
}

function mergeGlobals(configGlobals = [], cliGlobals = []) {
  return [...configGlobals, ...cliGlobals]
}

function mergeRuleOverrides(configRules = {}, cliOverrides = []) {
  const merged = []
  for (const [name, severity] of Object.entries(configRules ?? {})) {
    merged.push({ name, severity })
  }
  return [...merged, ...cliOverrides]
}
