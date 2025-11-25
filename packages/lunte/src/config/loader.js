import process from 'process'
import { access, readFile } from 'fs/promises'
import { constants as FS_CONSTANTS } from 'fs'
import { join, dirname } from 'path'

const CONFIG_BASENAMES = ['.lunterc', '.lunterc.json']

export async function loadConfig({ cwd = process.cwd() } = {}) {
  const filePath = await findConfigFile(cwd)
  if (!filePath) {
    return { config: {}, path: null }
  }

  const raw = await readFile(filePath, 'utf8')
  let config
  try {
    config = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`)
  }

  return { config: normalizeConfig(config), path: filePath }
}

async function findConfigFile(startDir) {
  let dir = startDir

  while (true) {
    for (const basename of CONFIG_BASENAMES) {
      const candidate = join(dir, basename)
      if (await fileExists(candidate)) {
        return candidate
      }
    }

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function fileExists(path) {
  try {
    await access(path, FS_CONSTANTS.F_OK)
    return true
  } catch {
    return false
  }
}

function normalizeConfig(config) {
  const result = {}
  if (Array.isArray(config?.env)) {
    result.env = config.env.map(String)
  }
  if (Array.isArray(config?.globals)) {
    result.globals = config.globals.map(String)
  }
  if (Array.isArray(config?.plugins)) {
    result.plugins = config.plugins.map((value) => String(value).trim()).filter(Boolean)
  }
  if (config?.rules && typeof config.rules === 'object') {
    result.rules = {}
    for (const [name, severity] of Object.entries(config.rules)) {
      result.rules[String(name)] = severity
    }
  }
  if (config?.disableHolepunchGlobals !== undefined) {
    result.disableHolepunchGlobals = Boolean(config.disableHolepunchGlobals)
  }
  if (config?.typescript !== undefined) {
    result.typescript = Boolean(config.typescript)
  }
  if (config?.forceTsParser !== undefined) {
    result.forceTsParser = Boolean(config.forceTsParser)
  }
    if (config?.experimental__enableTSAmbientGlobals !== undefined) {
    result.experimental__enableTSAmbientGlobals = Boolean(config.experimental__enableTSAmbientGlobals)
  }
  return result
}
