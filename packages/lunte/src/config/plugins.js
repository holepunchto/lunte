import process from 'process'
import { resolve as resolvePath, isAbsolute } from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'

import { registerRule } from '../rules/index.js'

const loadedPlugins = new Set()
const requireForResolve = createRequire(import.meta.url)

export async function loadPlugins(pluginIds = [], { cwd = process.cwd(), onError } = {}) {
  const uniqueIds = Array.from(new Set(pluginIds ?? [])).filter(Boolean)

  for (const pluginId of uniqueIds) {
    if (loadedPlugins.has(pluginId)) {
      continue
    }

    try {
      const specifier = await resolvePlugin(pluginId, cwd)
      const moduleExports = await import(specifier)
      const plugin = moduleExports?.default ?? moduleExports
      const rules = extractRules(plugin)
      if (rules.length === 0) {
        emitError(onError, `Plugin "${pluginId}" did not export any rules.`)
        loadedPlugins.add(pluginId)
        continue
      }

      for (const rule of rules) {
        try {
          registerRule(rule)
        } catch (error) {
          emitError(
            onError,
            `Plugin "${pluginId}" provided an invalid rule: ${error?.message ?? String(error)}`
          )
        }
      }

      loadedPlugins.add(pluginId)
    } catch (error) {
      emitError(onError, `Failed to load plugin "${pluginId}": ${error?.message ?? String(error)}`)
    }
  }
}

function extractRules(plugin) {
  if (!plugin) return []

  if (Array.isArray(plugin?.rules)) {
    return plugin.rules.filter(Boolean)
  }

  if (Array.isArray(plugin)) {
    return plugin.filter(Boolean)
  }

  if (plugin?.rules && typeof plugin.rules === 'object') {
    return Object.values(plugin.rules).filter(Boolean)
  }

  return []
}

async function resolvePlugin(pluginId, cwd) {
  if (pluginId.startsWith('file://')) {
    return pluginId
  }

  if (pluginId.startsWith('.') || isAbsolute(pluginId)) {
    const absolute = isAbsolute(pluginId) ? pluginId : resolvePath(cwd, pluginId)
    return pathToFileURL(absolute).href
  }

  const resolved = requireForResolve.resolve(pluginId, { paths: [cwd] })
  return pathToFileURL(resolved).href
}

function emitError(handler, message) {
  if (!message) return
  if (typeof handler === 'function') {
    handler(message)
    return
  }
  console.warn(message)
}
