import { extname } from 'path'

import { parse as acornParse, Parser as AcornParser } from '../../vendor/acorn/dist/acorn.mjs'
import { tsPlugin as acornTypescript } from '../../vendor/acorn-typescript/index.js'

export const DEFAULT_OPTIONS = Object.freeze({
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
  ranges: true,
  allowHashBang: true
})

const SUPPORTED_TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx'])
const DTS_SUFFIXES = ['.d.ts', '.d.mts', '.d.cts']

const typeScriptParserCache = new Map()

const parseWithAcorn = (sourceText, options = {}) => runParser(acornParse, sourceText, options)

const parseWithAcornTypescript = (sourceText, options = {}, { dts = false, jsx = false } = {}) => {
  const parser = getTypeScriptParser({ dts, jsx })
  return runParser((code, opts) => parser.parse(code, opts), sourceText, options)
}

export function parse(sourceText, { filePath, enableTypeScriptParser = false, ...options } = {}) {
  if (typeof sourceText !== 'string') {
    throw new TypeError('Parser input must be a string.')
  }

  if (enableTypeScriptParser && isTypeScriptLike(filePath)) {
    return parseWithAcornTypescript(sourceText, options, {
      dts: isDeclarationFile(filePath),
      jsx: isTsxFile(filePath)
    })
  }

  return parseWithAcorn(sourceText, options)
}

function isTypeScriptLike(filePath) {
  if (!filePath) {
    return false
  }

  const extension = extname(filePath).toLowerCase()
  if (SUPPORTED_TS_EXTENSIONS.has(extension)) {
    return true
  }
  return isDeclarationFile(filePath)
}

function isDeclarationFile(filePath) {
  if (!filePath) {
    return false
  }
  return DTS_SUFFIXES.some((suffix) => filePath.endsWith(suffix))
}

function getTypeScriptParser({ dts, jsx }) {
  const key = `${dts ? 'dts' : 'default'}${jsx ? '-jsx' : ''}`
  if (typeScriptParserCache.has(key)) {
    return typeScriptParserCache.get(key)
  }

  if (typeof acornTypescript !== 'function') {
    throw new Error(
      'TypeScript parser plugin not found. Install @sveltejs/acorn-typescript to enable the experimental parser.'
    )
  }

  const parser = AcornParser.extend(acornTypescript({ dts, jsx }))
  typeScriptParserCache.set(key, parser)
  return parser
}

function isTsxFile(filePath) {
  if (!filePath) {
    return false
  }
  return filePath.toLowerCase().endsWith('.tsx')
}

function runParser(parserFn, sourceText, options = {}) {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  return parserFn(sourceText, mergedOptions)
}
