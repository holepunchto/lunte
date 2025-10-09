const vscode = require('vscode')
const { LanguageClient } = require('vscode-languageclient/node')

/** @type {LanguageClient | null} */
let client = null

function activate(context) {
  const configuration = vscode.workspace.getConfiguration('lunte.lsp')
  const command = configuration.get('command') || 'npx'
  const args = configuration.get('args') || ['lunte-lsp']

  const serverOptions = {
    command,
    args,
    options: {
      cwd: vscode.workspace.rootPath || process.cwd()
    }
  }

  const clientOptions = {
    documentSelector: [{ language: 'javascript', scheme: 'file' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.lunterc*')
    }
  }

  client = new LanguageClient('lunte', 'Lunte LSP', serverOptions, clientOptions)
  context.subscriptions.push(client.start())
}

function deactivate() {
  if (!client) {
    return undefined
  }
  return client.stop()
}

module.exports = { activate, deactivate }
