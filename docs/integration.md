# Editor Integration

## LSP Overview

- Install the separate [`lunte-lsp`](https://github.com/holepunchto/lunte-lsp) package with `npm install --save-dev lunte-lsp`.
- Entry point: `lunte-lsp` (exports a JSON-RPC 2.0 / LSP endpoint over stdio).
- Capabilities: full document sync (`TextDocumentSyncKind.Full`), diagnostics only.
- Configuration: resolves `.lunterc` / `.lunterc.json` starting from the workspace root passed in `initialize` (`rootUri` or `rootPath`). Inline disable directives and `.lunteignore` behave as in the CLI.
- Limitations: no incremental parsing yet, no code actions or fixes, and diagnostics use minimal range data.

## VS Code Quick Start

The extension lives in [`vscode-lunte`](https://github.com/holepunchto/vscode-lunte).

1. Clone the extension repository and install its dependencies:

   ```sh
   git clone https://github.com/holepunchto/vscode-lunte.git
   cd vscode-lunte
   npm install
   ```

2. Launch VS Code with the extension in development mode:

   ```sh
   code --extensionDevelopmentPath="${PWD}"
   ```

3. Open a JavaScript file. The extension activates and spawns `npx lunte-lsp` from your workspace root. Override the command via the `lunte.lsp.command` / `lunte.lsp.args` settings if you want to pin a specific binary.

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

### lazy.nvim config

```lua
return {
  {
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      local lspconfig = require("lspconfig")
      local configs = require("lspconfig.configs")

      if not configs.lunte then
        configs.lunte = {
          default_config = {
            cmd = { "npx", "lunte-lsp" },
            filetypes = { "javascript" },
            root_dir = lspconfig.util.root_pattern("package.json", ".git"),
            single_file_support = true,
          },
        }
      end

      lspconfig.lunte.setup({})
    end,
  },
}
```
