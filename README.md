# Lunte

A self-contained JavaScript linter, mostly matching non-formatting rules of Standard.

- `lunte` – the CLI and core analysis engine.
- `lunte-lsp` – a stdio Language Server Protocol wrapper around the core.
- `vscode-lunte` – a minimal VS Code extension that spawns the LSP server.

## Installation

```sh
npm install --save-dev lunte
```

## Usage

```sh
$ lunte [optional: dir or glob]
```

Globs are supported:

```sh
lunte "src/**/*.js"
```

By default Lunte skips `node_modules/`. Manage additional exclusions with `.lunteignore` (uses gitignore-style patterns).

## Configuration

Configuration is optional, but when needed create a `.lunterc` (or `.lunterc.json`) at the project root.

```json
{
  "env": ["node"],
  "globals": ["MY_APP"],
  "plugins": ["lunte-plugin-pear"],
  "rules": {
    "no-undef": "off",
    "pear/no-apples": "error"
  },
  "disableHolepunchGlobals": true
}
```

- `env` enables preset global sets (`node`, `browser`, `es2021`).
- `globals` adds project-specific globals (strings are case-sensitive).
- `rules` sets severities per rule (`"off"`, `"warn"`, `"error"`, or `0/1/2`).
- `disableHolepunchGlobals` skips adding `Pear`/`Bare` globals.

Command-line overrides are available for ad-hoc runs:

```sh
lunte --env browser --global Pear --rule no-unused-vars=off src/
```

### TypeScript

- Experimental parser is bundled via vendored `@sveltejs/acorn-typescript` (tracks TS 5.7); no extra install needed.
- Files ending `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts` (and `.jsx` when present) automatically switch to the TS parser. Plain `.js` with type annotations still error—rename to `.ts`/`.tsx`.
- Type-aware handling currently exists for `no-undef` and `no-unused-vars` (covers enums, namespaces, `import =`, decorators, and ignores type-only imports); other rules run without type checking.
- `.d.ts` files are parsed to harvest ambient globals but skip runtime-only checks, so declaration files do not emit unused/undef noise.
- Ambient globals declared in your checked-in `.d.ts` files are applied automatically; opt in to scanning dependency declarations (e.g. `@types/*`) by adding `experimental__enableTSAmbientGlobals` to your `.lunterc`:

```json
{
  "experimental__enableTSAmbientGlobals": true
}
```

### Plugins

Load third-party rule packs by listing module IDs under `plugins`. Each plugin should export a `rules` array (or object) of rule definitions with unique `meta.name` values. Lunte will call `registerRule` for you:

```json
{
  "plugins": ["./rules/lunte-plugin-pear.js", "lunte-plugin-pear"],
  "rules": {
    "pear/no-apples": "error"
  }
}
```

For ad-hoc runs, `lunte --plugin lunte-plugin-pear --plugin ./rules/lunte-plugin-pear.js src/` applies the same modules.

### Inline Ignores

Silence specific findings inline:

```js
const cached = maybeUndefined() // lunte-disable-line no-undef

// lunte-disable-next-line
useGlobalResource()
```

- `lunte-disable-line` suppresses the listed rules (or all rules when none are listed) on the same source line.
- `lunte-disable-next-line` applies to the following line with the same rule targeting behaviour.

`eslint-disable-*` rules are also supported for compatibility.

## Editor Integration (LSP)

A lightweight Language Server Protocol endpoint ships as `lunte-lsp`. It reuses the CLI analyser, honours `.lunterc` / `.lunterc.json`, and streams diagnostics for open buffers.

Start it manually:

```sh
lunte-lsp
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

### Attribution

Lunte comes bundled with [Acorn](https://github.com/acornjs/acorn) (MIT).

### License

Apache-2.0

![lunte](/docs/lunte.webp)
