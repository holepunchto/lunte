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

export function parse(sourceText, { filePath, ...options } = {}) {
  if (typeof sourceText !== 'string') {
    throw new TypeError('Parser input must be a string.')
  }

  const useTypeScriptParser = isTypeScriptLike(filePath) || isJsxFile(filePath)

  if (useTypeScriptParser) {
    return parseWithAcornTypescript(sourceText, options, {
      dts: isDeclarationFile(filePath),
      jsx: isTsxFile(filePath) || isJsxFile(filePath)
    })
  }

  return parseWithAcorn(sourceText, options)
}

export function isTypeScriptLike(filePath) {
  if (!filePath) {
    return false
  }

  const extension = extname(filePath).toLowerCase()
  if (SUPPORTED_TS_EXTENSIONS.has(extension)) {
    return true
  }
  return isDeclarationFile(filePath)
}

export function isDeclarationFile(filePath) {
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

  const BaseParser = AcornParser.extend(acornTypescript({ dts, jsx }))
  class TypeScriptParser extends BaseParser {
    parseFunctionStatement(...args) {
      const node = super.parseFunctionStatement(...args)
      registerTypeScriptAmbientFunction(this, node)
      return node
    }

    parseFunctionBody(...args) {
      const scopeDepth = this.scopeStack.length
      const node = super.parseFunctionBody(...args)
      if (isTypeScriptDeclareFunction(node) && this.scopeStack.length === scopeDepth) {
        this.exitScope()
      }
      return node
    }
  }
  typeScriptParserCache.set(key, TypeScriptParser)
  return TypeScriptParser
}

function registerTypeScriptAmbientFunction(parser, node) {
  if (node?.type !== 'TSDeclareFunction' || !node.id) {
    return
  }

  const topLevelNames = parser.scopeStack?.[0]?.lexical
  if (topLevelNames && !topLevelNames.includes(node.id.name)) {
    topLevelNames.push(node.id.name)
  }
  delete parser.undefinedExports[node.id.name]
}

function isTypeScriptDeclareFunction(node) {
  return node?.type === 'TSDeclareFunction' || node?.type === 'TSDeclareMethod'
}

function isTsxFile(filePath) {
  if (!filePath) {
    return false
  }
  return filePath.toLowerCase().endsWith('.tsx')
}

export function isJsxFile(filePath) {
  if (!filePath) {
    return false
  }
  return filePath.toLowerCase().endsWith('.jsx')
}

function runParser(parserFn, sourceText, options = {}) {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  }

  return parserFn(sourceText, mergedOptions)
}
