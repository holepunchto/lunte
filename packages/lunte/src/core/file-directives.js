const DIRECTIVE_COMMENT_MAX = 16_384

export function extractFileDirectives(source) {
  const directives = {
    globals: new Set(),
    envs: new Set()
  }

  let index = 0
  const length = Math.min(source.length, DIRECTIVE_COMMENT_MAX)

  while (index < length) {
    const char = source[index]

    if (isWhitespaceChar(char)) {
      index += 1
      continue
    }

    if (index === 0 && source.startsWith('#!', index)) {
      const endOfLine = findLineTerminator(source, index + 2, length)
      index = endOfLine === -1 ? length : endOfLine
      continue
    }

    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2)
      if (end === -1) break
      const content = source.slice(index + 2, end).trim()
      handleBlockDirective(content, directives)
      index = end + 2
      continue
    }

    if (source.startsWith('//', index)) {
      const end = findLineTerminator(source, index + 2, length)
      const content = source.slice(index + 2, end === -1 ? length : end).trim()
      handleLineDirective(content, directives)
      index = end === -1 ? length : end
      continue
    }

    const directiveEnd = consumeDirectivePrologue(source, index, length)
    if (directiveEnd !== -1) {
      index = directiveEnd
      continue
    }

    break
  }

  return directives
}

function handleBlockDirective(content, directives) {
  if (!content) return
  const globalsPayload = extractDirectivePayload(content, ['globals', 'global'])
  if (globalsPayload) {
    addGlobalsFromPayload(globalsPayload, directives)
    return
  }

  const envPayload = extractDirectivePayload(content, ['eslint-env'])
  if (envPayload) {
    addEnvsFromPayload(envPayload, directives)
  }
}

function handleLineDirective(content, directives) {
  if (!content) return
  const globalsPayload = extractDirectivePayload(content, ['globals', 'global'])
  if (globalsPayload) {
    addGlobalsFromPayload(globalsPayload, directives)
  }
}

function parseGlobalList(payload) {
  if (!payload) return []
  const result = []
  for (const segment of payload.split(',')) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const colonIndex = trimmed.indexOf(':')
    const name = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex).trim()
    if (name) result.push(name)
  }
  return result
}

function parseEnvList(payload) {
  if (!payload) return []
  const result = []
  for (const segment of payload.split(',')) {
    const trimmed = segment.trim()
    if (trimmed) {
      result.push(trimmed)
    }
  }
  return result
}

function extractDirectivePayload(content, directiveNames) {
  for (const name of directiveNames) {
    if (content.startsWith(name) && hasDirectiveBoundary(content, name.length)) {
      return content.slice(name.length).trim()
    }
  }
  return ''
}

function hasDirectiveBoundary(content, index) {
  if (index >= content.length) return true
  const nextChar = content[index]
  return nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || nextChar === '\r'
}

function addGlobalsFromPayload(payload, directives) {
  for (const name of parseGlobalList(payload)) {
    directives.globals.add(name)
  }
}

function addEnvsFromPayload(payload, directives) {
  for (const env of parseEnvList(payload)) {
    directives.envs.add(env)
  }
}

function isWhitespaceChar(char) {
  return char === ' ' || char === '\t' || char === '\r' || char === '\n' || char === '\uFEFF'
}

function consumeDirectivePrologue(source, startIndex, limit) {
  const quote = source[startIndex]
  if (quote !== "'" && quote !== '"') {
    return -1
  }

  let index = startIndex + 1
  while (index < limit) {
    const char = source[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === quote) {
      break
    }
    index += 1
  }

  if (index >= limit || source[index] !== quote) {
    return -1
  }

  const literal = source.slice(startIndex + 1, index)
  if (!literal.startsWith('use ')) {
    return -1
  }

  index += 1

  while (index < limit && (source[index] === ' ' || source[index] === '\t')) {
    index += 1
  }

  if (index < limit && source[index] === ';') {
    index += 1
  }

  while (index < limit && isWhitespaceChar(source[index])) {
    index += 1
  }

  return index
}

function findLineTerminator(source, fromIndex, limit) {
  for (let i = fromIndex; i < limit; i += 1) {
    const char = source[i]
    if (char === '\n') {
      return i + 1
    }
    if (char === '\r') {
      if (i + 1 < limit && source[i + 1] === '\n') {
        return i + 2
      }
      return i + 1
    }
  }
  return -1
}
