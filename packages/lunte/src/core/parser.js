import { parse as acornParse } from '../../vendor/acorn/dist/acorn.mjs'

export const DEFAULT_OPTIONS = Object.freeze({
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
  ranges: true,
  allowHashBang: true
})

export function parse(sourceText, options = {}) {
  if (typeof sourceText !== 'string') {
    throw new TypeError('Parser input must be a string.')
  }

  if (!options || Object.keys(options).length === 0) {
    return acornParse(sourceText, DEFAULT_OPTIONS)
  }

  return acornParse(sourceText, {
    ...DEFAULT_OPTIONS,
    ...options
  })
}
