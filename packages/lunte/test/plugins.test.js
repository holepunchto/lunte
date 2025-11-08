import test from 'brittle'
import { writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { loadPlugins } from '../src/config/plugins.js'
import { builtInRules } from '../src/rules/index.js'
import { mkdtemp } from './helpers/mkdtemp.js'

const RULE_NAME = 'pear/no-apples'

test('loadPlugins registers rules from plugin modules', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'lunte-plugin-'))
  const pluginPath = join(dir, 'plugin.mjs')

  await writeFile(
    pluginPath,
    `
export default {
  rules: [
    {
      meta: { name: '${RULE_NAME}' },
      create() {
        return {}
      }
    }
  ]
}
    `.trim()
  )

  t.is(builtInRules.has(RULE_NAME), false)
  t.teardown(() => {
    builtInRules.delete(RULE_NAME)
  })

  await loadPlugins([pluginPath], {
    cwd: dir,
    onError: (message) => t.fail(message)
  })

  t.is(builtInRules.has(RULE_NAME), true)
})
