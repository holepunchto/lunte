# Editor Integration

## LSP Overview

- Entry point: `lunte-lsp` (ships with the package, exports a JSON-RPC 2.0 / LSP endpoint over stdio).
- Capabilities: full document sync (`TextDocumentSyncKind.Full`), diagnostics only.
- Configuration: resolves `.lunterc` / `.lunterc.json` starting from the workspace root passed in `initialize` (`rootUri` or `rootPath`). Inline disable directives and `.lunteignore` behave as in the CLI.
- Limitations: no incremental parsing yet, no code actions or fixes, and diagnostics use minimal range data.

## Neovim Quick Start

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

configs.lunte = configs.lunte or {
  default_config = {
    cmd = { 'npx', 'lunte-lsp' },
    filetypes = { 'javascript' },
    root_dir = lspconfig.util.find_git_ancestor,
    single_file_support = true,
  },
}

lspconfig.lunte.setup({})
```

Once attached, the client streams diagnostics as you edit JavaScript files. The current server expects full-text change notifications; ensure your client is configured accordingly (Neovim’s defaults are compatible).

## VS Code Quick Start

The repository already includes a client implementation at `packages/vscode-lunte`.

1. Install its dependencies:

   ```sh
   cd packages/vscode-lunte
   npm install
   ```

2. Launch VS Code with the extension in development mode:

   ```sh
   code --extensionDevelopmentPath="${PWD}"
   ```

3. Open a JavaScript file. The extension activates and spawns `npx lunte-lsp` from your workspace root. Override the command via the `lunte.lsp.command` / `lunte.lsp.args` settings if you want to pin a specific binary.

## Roadmap

- Support incremental sync and background analysis caches.
- Surface quick fixes (rule suppressions, rewrites) as `codeAction` responses.
- Add command-line debug tracing for easier troubleshooting.
