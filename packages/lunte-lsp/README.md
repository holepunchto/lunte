# lunte-lsp

Language Server Protocol wrapper for Lunte.

## Installation

```sh
npm install --save-dev lunte lunte-lsp
```

## Usage

```sh
lunte-lsp
```

The server reuses Lunte's analyzer, reads `.lunterc` / `.lunterc.json`, and streams diagnostics over stdio.

## Neovim

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

## Repository

Monorepo: https://github.com/holepunchto/lunte

## License

Apache-2.0
