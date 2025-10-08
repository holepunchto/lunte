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

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      index += 1
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
      const end = source.indexOf('\n', index + 2)
      const content = source.slice(index + 2, end === -1 ? length : end).trim()
      handleLineDirective(content, directives)
      index = end === -1 ? length : end + 1
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
