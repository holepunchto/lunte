import test from 'brittle'
import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { analyze } from '../src/core/analyzer.js'
import { loadConfig } from '../src/config/loader.js'
import { loadPlugins } from '../src/config/plugins.js'
import { builtInRules } from '../src/rules/index.js'

const RULE_NAME = 'opts/echo'
const DEFAULTS_RULE_NAME = 'opts/echo-defaults'

const PLUGIN_SOURCE = `
function echo(name, defaultOptions) {
  return {
    meta: { name, defaultOptions },
    create(context) {
      return {
        Program(node) {
          context.report({ node, message: JSON.stringify(context.options ?? null) })
        }
      }
    }
  }
}

export default {
  rules: [echo('${RULE_NAME}'), echo('${DEFAULTS_RULE_NAME}', [{ max: 40 }])]
}
`

test('plugin rules receive options from .lunterc', async (t) => {
  const dir = await setup(t, {
    rules: {
      [RULE_NAME]: ['warn', { max: 60 }, 'strict'],
      [DEFAULTS_RULE_NAME]: ['error', { max: 80 }]
    }
  })

  const echoed = await lint(dir)

  t.alike(echoed.get(RULE_NAME), { severity: 'warning', options: [{ max: 60 }, 'strict'] })
  t.alike(echoed.get(DEFAULTS_RULE_NAME), { severity: 'error', options: [{ max: 80 }] })
})

test('context.options falls back to meta.defaultOptions, then []', async (t) => {
  const dir = await setup(t, {
    rules: { [RULE_NAME]: 'error', [DEFAULTS_RULE_NAME]: 'warn' }
  })

  const echoed = await lint(dir)

  t.alike(echoed.get(RULE_NAME), { severity: 'error', options: [] })
  t.alike(echoed.get(DEFAULTS_RULE_NAME), { severity: 'warning', options: [{ max: 40 }] })
})

test('a CLI severity override keeps options from .lunterc', async (t) => {
  const dir = await setup(t, { rules: { [RULE_NAME]: ['error', { max: 60 }] } })

  const echoed = await lint(dir, [{ name: RULE_NAME, severity: 'warn' }])

  t.alike(echoed.get(RULE_NAME), { severity: 'warning', options: [{ max: 60 }] })
})

async function setup(t, lunterc) {
  const dir = await mkdtemp(join(tmpdir(), 'lunte-rule-options-'))
  const pluginPath = join(dir, 'plugin.mjs')
  await writeFile(pluginPath, PLUGIN_SOURCE)
  await writeFile(join(dir, '.lunterc'), JSON.stringify({ plugins: [pluginPath], ...lunterc }))

  t.teardown(() => {
    builtInRules.delete(RULE_NAME)
    builtInRules.delete(DEFAULTS_RULE_NAME)
  })

  return dir
}

async function lint(dir, cliOverrides = []) {
  const { config } = await loadConfig({ cwd: dir })
  await loadPlugins(config.plugins, { cwd: dir })

  const ruleOverrides = Object.entries(config.rules).map(([name, severity]) => ({
    name,
    severity
  }))
  const { diagnostics } = await analyze({
    source: 'export {}\n',
    sourceFile: join(dir, 'input.js'),
    ruleOverrides: [...ruleOverrides, ...cliOverrides]
  })

  const echoed = new Map()
  for (const { ruleId, severity, message } of diagnostics) {
    if (ruleId?.startsWith('opts/')) {
      echoed.set(ruleId, { severity, options: JSON.parse(message) })
    }
  }
  return echoed
}
