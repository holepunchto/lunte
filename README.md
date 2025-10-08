# Lunte

This repository hosts a small vendorable JavaScript linter and its editor integrations. It is split into three workspaces:

- `lunte` – the CLI and core analysis engine.
- `lunte-lsp` – a stdio Language Server Protocol wrapper around the core.
- `vscode-lunte` – a minimal VS Code extension that spawns the LSP server.

The CLI parses with Acorn, runs a focused rule suite, and emits console diagnostics.

## Installation

```sh
npm install --save-dev lunte
```

## Usage

Lint specific files or directories:

```sh
npx lunte src/ test/utils.js
```

Globs are supported:

```sh
npx lunte "src/**/*.js"
```

By default Lunte skips `node_modules/`. Manage additional exclusions with `.lunteignore` (uses gitignore-style patterns).

## Configuration

Configuration is optional, but when needed create a `.lunterc` (or `.lunterc.json`) at the project root. A minimal example:

```json
{
  "env": ["node"],
  "globals": ["MY_APP"],
  "rules": {
    "no-unused-vars": "warn",
    "no-undef": "error"
  }
}
```

- `env` enables preset global sets (`node`, `browser`, `es2021`).
- `globals` adds project-specific globals (strings are case-sensitive).
- `rules` sets severities per rule (`"off"`, `"warn"`, `"error"`, or `0/1/2`).

Command-line overrides are available for ad-hoc runs:

```sh
npx lunte --env browser --global MY_GLOBAL --rule no-unused-vars=off src/
```

### Inline Ignores

Silence specific findings inline without touching configuration:

```js
const cached = maybeUndefined() // lunte-disable-line no-undef

// lunte-disable-next-line
useGlobalResource()
```

- `lunte-disable-line` suppresses the listed rules (or all rules when none are listed) on the same source line.
- `lunte-disable-next-line` applies to the following line with the same rule targeting behaviour.

## Status

The project is under active development. Expect rule APIs, configuration formats, and CLI options to evolve.

## Editor Integration (LSP)

A lightweight Language Server Protocol endpoint ships as `lunte-lsp`. It reuses the CLI analyser, honours `.lunterc` / `.lunterc.json`, and streams diagnostics for open buffers.

Start it manually:

```sh
npx lunte-lsp
```

### Neovim

Use the built-in LSP client (via `lspconfig`) to surface errors in buffers:

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

The v0 server performs full-document sync and does not yet support code actions or autofix.

### VS Code

The repository ships a ready-made client in `packages/vscode-lunte`. To try it in development mode:

```sh
cd packages/vscode-lunte
npm install
code --extensionDevelopmentPath="${PWD}"
```

By default the extension runs `npx lunte-lsp`. Adjust `lunte.lsp.command` / `lunte.lsp.args` in VS Code settings to point at another binary (for example a globally installed `lunte-lsp`).
