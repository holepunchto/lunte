import process from 'process'
import { TextEncoder } from 'util'
import { fileURLToPath } from 'url'
import { normalize } from 'path'

import { analyze } from 'lunte'
import { Severity } from 'lunte/src/core/constants.js'
import { loadConfig } from 'lunte/src/config/loader.js'
import { loadPlugins } from 'lunte/src/config/plugins.js'
import { loadIgnore } from 'lunte/src/core/ignore.js'

const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
}

const DiagnosticSeverity = {
  error: 1,
  warning: 2
}

const connection = createConnection(process.stdin, process.stdout)

const documents = new Map()
let rootPath = process.cwd()
let shuttingDown = false

let cachedRuleOverrides = []
let cachedEnvOverrides = []
let cachedGlobalOverrides = []
let cachedPlugins = []
let cachedEnableTypeScriptParser = false
let cachedEnableTypeScriptParserForJS = false
let cachedEnableDependencyAmbientGlobals = false
let ignoreMatcher = createIgnoreMatcher()

connection.onRequest('initialize', handleInitialize)
connection.onRequest('shutdown', handleShutdown)

connection.onNotification('initialized', handleInitialized)
connection.onNotification('exit', handleExit)
connection.onNotification('textDocument/didOpen', handleDidOpen)
connection.onNotification('textDocument/didChange', handleDidChange)
connection.onNotification('textDocument/didClose', handleDidClose)
connection.onNotification('workspace/didChangeConfiguration', handleWorkspaceDidChangeConfiguration)

async function handleInitialize(params = {}) {
  if (typeof params.rootUri === 'string' && params.rootUri.length > 0) {
    const resolved = uriToFilePath(params.rootUri)
    if (resolved) {
      rootPath = resolved
    }
  } else if (typeof params.rootPath === 'string' && params.rootPath.length > 0) {
    rootPath = normalize(params.rootPath)
  }

  await refreshWorkspaceState()

  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: 1,
        save: { includeText: false }
      }
    },
    serverInfo: {
      name: 'lunte'
    }
  }
}

async function handleShutdown() {
  shuttingDown = true
  return null
}

function handleInitialized() {
  // No-op for now. Placeholder for future file watchers or telemetry.
}

function handleExit() {
  process.exit(shuttingDown ? 0 : 1)
}

async function handleWorkspaceDidChangeConfiguration() {
  await refreshWorkspaceState()
  await revalidateAllDocuments()
}

async function handleDidOpen({ textDocument }) {
  if (!textDocument?.uri) {
    return
  }
  const filePath = uriToFilePath(textDocument.uri)
  if (!filePath) {
    return
  }

  const text = typeof textDocument.text === 'string' ? textDocument.text : ''
  documents.set(textDocument.uri, {
    uri: textDocument.uri,
    filePath,
    text,
    version: textDocument.version ?? 0
  })

  await validateDocument(textDocument.uri)
}

async function handleDidChange({ textDocument, contentChanges }) {
  if (!textDocument?.uri || !Array.isArray(contentChanges)) {
    return
  }

  const existing = documents.get(textDocument.uri)
  if (!existing) {
    return
  }

  // The server advertises `TextDocumentSyncKind.Full`, so expect a single full-content change.
  const change = contentChanges[contentChanges.length - 1]
  if (change && typeof change.text === 'string') {
    existing.text = change.text
  }
  if (typeof textDocument.version === 'number') {
    existing.version = textDocument.version
  }

  await validateDocument(textDocument.uri)
}

async function handleDidClose({ textDocument }) {
  if (!textDocument?.uri) {
    return
  }
  documents.delete(textDocument.uri)
  publishDiagnostics(textDocument.uri, [])
}

async function refreshWorkspaceState() {
  try {
    const { config } = await loadConfig({ cwd: rootPath })
    cachedEnvOverrides = Array.isArray(config?.env) ? config.env : []
    cachedGlobalOverrides = Array.isArray(config?.globals) ? config.globals : []
    cachedRuleOverrides = config?.rules
      ? Object.entries(config.rules).map(([name, severity]) => ({ name, severity }))
      : []
    cachedPlugins = Array.isArray(config?.plugins) ? config.plugins : []

    const forceTypeScriptParserForJS = parseEnvBoolean(process.env.LUNTE_FORCE_TS_PARSER)
    cachedEnableTypeScriptParserForJS = forceTypeScriptParserForJS
    cachedEnableTypeScriptParser = forceTypeScriptParserForJS || Boolean(config?.typescript)
    cachedEnableDependencyAmbientGlobals = Boolean(config?.experimental__enableTSAmbientGlobals)
  } catch (error) {
    // Surfacing config failures via diagnostics would be noisy; log to stderr for now.
    log(`Failed to load config: ${error.message}`)
    cachedEnvOverrides = []
    cachedGlobalOverrides = []
    cachedRuleOverrides = []
    cachedPlugins = []
    cachedEnableTypeScriptParser = false
    cachedEnableTypeScriptParserForJS = false
    cachedEnableDependencyAmbientGlobals = false
  }

  await loadPlugins(cachedPlugins, {
    cwd: rootPath,
    onError: (message) => log(message)
  })

  try {
    ignoreMatcher = await loadIgnore({ cwd: rootPath })
  } catch (error) {
    log(`Failed to load ignore file: ${error.message}`)
    ignoreMatcher = createIgnoreMatcher()
  }
}

async function validateDocument(uri) {
  const doc = documents.get(uri)
  if (!doc) {
    return
  }

  if (ignoreMatcher.ignores(doc.filePath)) {
    publishDiagnostics(uri, [])
    return
  }

  try {
    const { diagnostics } = await analyze({
      files: [doc.filePath],
      ruleOverrides: cachedRuleOverrides,
      envOverrides: cachedEnvOverrides,
      globalOverrides: cachedGlobalOverrides,
      sourceText: new Map([[doc.filePath, doc.text]]),
      enableTypeScriptParser: cachedEnableTypeScriptParser,
      enableTypeScriptParserForJS: cachedEnableTypeScriptParserForJS,
      enableDependencyAmbientGlobals: cachedEnableDependencyAmbientGlobals
    })

    const lspDiagnostics = diagnostics.map((diagnostic) =>
      convertToLspDiagnostic(diagnostic, doc.text)
    )
    publishDiagnostics(uri, lspDiagnostics)
  } catch (error) {
    log(`Failed to analyze ${doc.filePath}: ${error.message}`)
  }
}

async function revalidateAllDocuments() {
  const uris = Array.from(documents.keys())
  for (const uri of uris) {
    await validateDocument(uri)
  }
}

function publishDiagnostics(uri, diagnostics) {
  connection.sendNotification('textDocument/publishDiagnostics', {
    uri,
    diagnostics
  })
}

function parseEnvBoolean(value) {
  if (value === undefined) return false
  const normalized = String(value).toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function convertToLspDiagnostic(diagnostic, sourceText) {
  const lineIndex = Math.max(0, (diagnostic.line ?? 1) - 1)
  const columnIndex = Math.max(0, (diagnostic.column ?? 1) - 1)
  const lineLength = getLineLength(sourceText, lineIndex)
  const endCharacter = Math.min(lineLength, columnIndex + 1)

  const severity =
    diagnostic.severity === Severity.error ? DiagnosticSeverity.error : DiagnosticSeverity.warning

  return {
    range: {
      start: { line: lineIndex, character: columnIndex },
      end: { line: lineIndex, character: Math.max(endCharacter, columnIndex) }
    },
    severity,
    message: diagnostic.message,
    code: diagnostic.ruleId ?? undefined,
    source: 'lunte'
  }
}

function getLineLength(text, lineIndex) {
  if (typeof text !== 'string' || text.length === 0) {
    return 0
  }
  let currentLine = 0
  let lastIndex = 0
  while (currentLine < lineIndex) {
    const nextBreak = findNextLineBreak(text, lastIndex)
    if (nextBreak === -1) {
      return Math.max(text.length - lastIndex, 0)
    }
    lastIndex = nextBreak
    currentLine += 1
  }
  const endOfLine = findNextLineBreak(text, lastIndex)
  const endIndex = endOfLine === -1 ? text.length : endOfLine
  return Math.max(endIndex - lastIndex, 0)
}

function findNextLineBreak(text, startIndex) {
  for (let i = startIndex; i < text.length; i += 1) {
    const char = text.charCodeAt(i)
    if (char === 10 /* \n */) {
      return i
    }
    if (char === 13 /* \r */) {
      if (i + 1 < text.length && text.charCodeAt(i + 1) === 10) {
        return i + 1
      }
      return i
    }
  }
  return -1
}

function uriToFilePath(uri) {
  try {
    if (uri.startsWith('file://')) {
      return normalize(fileURLToPath(uri))
    }
    return normalize(uri)
  } catch (error) {
    log(`Failed to resolve URI ${uri}: ${error.message}`)
    return null
  }
}

function createIgnoreMatcher() {
  return {
    ignores() {
      return false
    }
  }
}

function createConnection(input, output) {
  const encoder = new TextEncoder()
  let buffer = Buffer.alloc(0)
  const requestHandlers = new Map()
  const notificationHandlers = new Map()

  input.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    processBuffer()
  })

  input.on('close', () => {
    process.exit(0)
  })

  input.resume()

  function processBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) {
        return
      }

      const header = buffer.slice(0, headerEnd).toString('utf8')
      const lengthMatch = header.match(/Content-Length: (\d+)/i)
      if (!lengthMatch) {
        buffer = Buffer.alloc(0)
        return
      }

      const messageLength = Number.parseInt(lengthMatch[1], 10)
      const totalLength = headerEnd + 4 + messageLength
      if (buffer.length < totalLength) {
        return
      }

      const body = buffer.slice(headerEnd + 4, totalLength).toString('utf8')
      buffer = buffer.slice(totalLength)

      let message
      try {
        message = JSON.parse(body)
      } catch (error) {
        sendErrorResponse(null, ErrorCodes.ParseError, `Invalid JSON: ${error.message}`)
        continue
      }

      handleMessage(message)
    }
  }

  function handleMessage(message) {
    if (message === null || message === undefined || typeof message !== 'object') {
      sendErrorResponse(null, ErrorCodes.InvalidRequest, 'Invalid message')
      return
    }

    if (message.method && message.id !== undefined) {
      const handler = requestHandlers.get(message.method)
      if (!handler) {
        sendErrorResponse(
          message.id,
          ErrorCodes.MethodNotFound,
          `Unsupported method ${message.method}`
        )
        return
      }

      Promise.resolve()
        .then(() => handler(message.params))
        .then((result) => {
          sendResponse(message.id, result)
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : String(error)
          sendErrorResponse(message.id, ErrorCodes.InternalError, errorMessage)
        })
      return
    }

    if (message.method) {
      const handler = notificationHandlers.get(message.method)
      if (!handler) {
        return
      }
      try {
        handler(message.params)
      } catch (error) {
        log(`Notification handler for ${message.method} failed: ${error.message}`)
      }
    }
  }

  function sendResponse(id, result) {
    sendMessage({ jsonrpc: '2.0', id, result })
  }

  function sendErrorResponse(id, code, message) {
    sendMessage({ jsonrpc: '2.0', id, error: { code, message } })
  }

  function sendNotification(method, params) {
    sendMessage({ jsonrpc: '2.0', method, params })
  }

  function sendMessage(payload) {
    const json = JSON.stringify(payload)
    const body = encoder.encode(json)
    const header = `Content-Length: ${body.byteLength}\r\n\r\n`
    output.write(header)
    output.write(body)
  }

  return {
    onRequest(method, handler) {
      requestHandlers.set(method, handler)
    },
    onNotification(method, handler) {
      notificationHandlers.set(method, handler)
    },
    sendNotification,
    sendResponse
  }
}

function log(message) {
  if (!message) return
  const line = `[lunte-lsp] ${message}`
  try {
    process.stderr.write(`${line}\n`)
  } catch {
    // ignore
  }
}

// Handle uncaught exceptions to avoid silent failures.
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.stack ?? error.message}`)
})

process.on('unhandledRejection', (reason) => {
  log(
    `Unhandled rejection: ${
      reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    }`
  )
})
