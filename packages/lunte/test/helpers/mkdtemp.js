import * as fsPromises from 'fs/promises'

const MAX_ATTEMPTS = 10
const DEFAULT_MODE = 0o700

const nativeMkdtemp =
  typeof fsPromises.mkdtemp === 'function' ? fsPromises.mkdtemp.bind(fsPromises) : null

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0')
}

export async function mkdtemp(prefix) {
  if (!prefix) {
    throw new TypeError('mkdtemp prefix is required')
  }

  if (nativeMkdtemp) {
    return nativeMkdtemp(prefix)
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const dir = `${prefix}${randomSuffix()}`
    try {
      await fsPromises.mkdir(dir, { mode: DEFAULT_MODE })
      return dir
    } catch (error) {
      if (error?.code === 'EEXIST') {
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to generate a unique temporary directory')
}
