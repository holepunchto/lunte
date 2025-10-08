import test from 'brittle'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(__dirname)

test('LSP server publishes diagnostics for open document', async (t) => {
  const client = await createLspClient(t)

  const rootUri = pathToFileURL(projectRoot).href
  const initResult = await client.sendRequest('initialize', { rootUri })
  t.is(initResult.capabilities?.textDocumentSync?.change, 1, 'server should request full document sync')

  client.sendNotification('initialized', {})

  const fixturePath = join(__dirname, 'fixtures', 'lsp-diagnostic.js')
  const documentUri = pathToFileURL(fixturePath).href
  const text = await readFile(fixturePath, 'utf8')

  client.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: documentUri,
      languageId: 'javascript',
      version: 1,
      text
    }
  })

  let diagnostics = []
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const message = await client.waitForNotification('textDocument/publishDiagnostics')
    diagnostics = message.params?.diagnostics ?? []
    if (diagnostics.length > 0) {
      break
    }
  }

  t.ok(diagnostics.length > 0, 'should emit diagnostics')
  t.ok(
    diagnostics.some((d) => d.code === 'no-unused-vars'),
    'should include rule id in diagnostics'
  )

  await client.shutdown()
})

async function createLspClient(t) {
  const child = spawn(process.execPath, ['../lunte-lsp/bin/lunte-lsp'], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  t.teardown(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await once(child, 'exit').catch(() => {})
    }
  })

  const messageQueue = []
  const pendingResolvers = []
  let nextId = 0

  let buffer = Buffer.alloc(0)
  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    processBuffer()
  })

  child.stderr.on('data', (chunk) => {
    // Forward server logs to stderr to aid debugging when tests fail.
    process.stderr.write(chunk)
  })

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

      try {
        const message = JSON.parse(body)
        if (pendingResolvers.length > 0) {
          const resolve = pendingResolvers.shift()
          resolve(message)
        } else {
          messageQueue.push(message)
        }
      } catch (error) {
        t.fail(`Failed to parse message: ${error.message}`)
      }
    }
  }

  function send(payload) {
    const json = JSON.stringify({ jsonrpc: '2.0', ...payload })
    const bufferPayload = Buffer.from(json, 'utf8')
    const header = `Content-Length: ${bufferPayload.byteLength}\r\n\r\n`
    child.stdin.write(header)
    child.stdin.write(bufferPayload)
  }

  function sendRequest(method, params) {
    const id = nextId += 1
    send({ method, params, id })
    return waitForResponse(id)
  }

  function sendNotification(method, params) {
    send({ method, params })
  }

  function waitForResponse(id) {
    return new Promise((resolve, reject) => {
      function poll() {
        for (let i = 0; i < messageQueue.length; i += 1) {
          const message = messageQueue[i]
          if (message.id === id) {
            messageQueue.splice(i, 1)
            if (message.error) {
              reject(new Error(message.error.message))
              return
            }
            resolve(message.result)
            return
          }
        }
        pendingResolvers.push((message) => {
          if (message.id === id) {
            if (message.error) {
              reject(new Error(message.error.message))
            } else {
              resolve(message.result)
            }
            return
          }
          messageQueue.push(message)
          poll()
        })
      }
      poll()
    })
  }

  async function waitForNotification(method) {
    // First check queued messages in case the notification already arrived.
    for (let i = 0; i < messageQueue.length; i += 1) {
      const message = messageQueue[i]
      if (message.method === method) {
        messageQueue.splice(i, 1)
        return message
      }
    }

    return new Promise((resolve) => {
      pendingResolvers.push((message) => {
        if (message.method === method) {
          resolve(message)
          return
        }
        messageQueue.push(message)
      })
    })
  }

  async function shutdown() {
    try {
      await sendRequest('shutdown')
      sendNotification('exit')
    } finally {
      child.stdin.end()
      if (child.exitCode === null) {
        await once(child, 'exit').catch(() => {})
      }
    }
  }

  return {
    sendRequest,
    sendNotification,
    waitForNotification,
    shutdown
  }
}
