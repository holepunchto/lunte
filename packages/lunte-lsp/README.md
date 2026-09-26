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
vim.lsp.config['lunte'] = {
  cmd = { 'npx', 'lunte-lsp' },
  filetypes = { 'javascript' },
  root_markers = { '.lunterc', '.lunterc.json' },
  single_file_support = true,
}

vim.lsp.enable('lunte')
```

## Repository

Monorepo: https://github.com/holepunchto/lunte

## License

Apache-2.0
