import test from 'brittle'
import { spawn } from 'child_process'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const SERVER = fileURLToPath(new URL('../src/server.js', import.meta.url))

test('lints unsaved buffer contents', async (t) => {
  const client = await start(t)
  const uri = client.uri('unsaved.js')

  client.open(uri, 'const unused = 1\n')
  const { diagnostics } = await client.diagnostics(uri)

  t.alike(
    diagnostics.map((d) => d.code),
    ['no-unused-vars']
  )
})

test('re-lints on change', async (t) => {
  const client = await start(t)
  const uri = client.uri('change.js')

  client.open(uri, 'export const used = 1\n')
  t.is((await client.diagnostics(uri)).diagnostics.length, 0)

  client.change(uri, 'export const used = 1\nconst unused = 2\n')
  const { diagnostics } = await client.diagnostics(uri)

  t.alike(
    diagnostics.map((d) => d.code),
    ['no-unused-vars']
  )
})

test('range spans the identifier past the first line', async (t) => {
  const client = await start(t)
  const uri = client.uri('range.js')

  client.open(uri, 'export const a = 1\n\nconst unusedThing = 2\n')
  const [diagnostic] = (await client.diagnostics(uri)).diagnostics

  t.alike(diagnostic.range, {
    start: { line: 2, character: 6 },
    end: { line: 2, character: 17 }
  })
})

test('range handles CRLF line endings', async (t) => {
  const client = await start(t)
  const uri = client.uri('crlf.js')

  client.open(uri, 'export const a = 1\r\nconst b = 2\r\n')
  const [diagnostic] = (await client.diagnostics(uri)).diagnostics

  t.alike(diagnostic.range, {
    start: { line: 1, character: 6 },
    end: { line: 1, character: 7 }
  })
})

async function start(t) {
  const root = mkdtempSync(join(tmpdir(), 'lunte-lsp-'))
  const child = spawn(process.execPath, [SERVER], { cwd: root })
  t.teardown(() => child.kill())

  const waiting = []
  let buffer = Buffer.alloc(0)
  let id = 0

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return
      const length = Number(buffer.subarray(0, headerEnd).toString().match(/\d+/)[0])
      const end = headerEnd + 4 + length
      if (buffer.length < end) return
      const message = JSON.parse(buffer.subarray(headerEnd + 4, end))
      buffer = buffer.subarray(end)
      const i = waiting.findIndex((w) => w.match(message))
      if (i !== -1) waiting.splice(i, 1)[0].resolve(message)
    }
  })

  function send(message) {
    const body = JSON.stringify({ jsonrpc: '2.0', ...message })
    child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
  }

  function next(match) {
    return new Promise((resolve) => waiting.push({ match, resolve }))
  }

  function request(method, params) {
    const current = ++id
    const reply = next((m) => m.id === current)
    send({ id: current, method, params })
    return reply
  }

  await request('initialize', { rootUri: pathToFileURL(root).href, capabilities: {} })
  send({ method: 'initialized', params: {} })

  return {
    uri(name) {
      return pathToFileURL(join(root, name)).href
    },
    open(uri, text) {
      send({
        method: 'textDocument/didOpen',
        params: { textDocument: { uri, languageId: 'javascript', version: 0, text } }
      })
    },
    change(uri, text) {
      send({
        method: 'textDocument/didChange',
        params: { textDocument: { uri, version: 1 }, contentChanges: [{ text }] }
      })
    },
    async diagnostics(uri) {
      const message = await next(
        (m) => m.method === 'textDocument/publishDiagnostics' && m.params.uri === uri
      )
      return message.params
    }
  }
}
