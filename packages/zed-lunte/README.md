# zed-lunte

Zed extension that runs `lunte-lsp` for JavaScript, TypeScript and TSX.

## Install (dev)

Requires Rust via `rustup` (Zed compiles the extension to WASM).

1. In Zed, open the command palette and run `zed: install dev extension`.
2. Select this directory (`packages/zed-lunte`).

To restart the server after changing it, use the language servers (lightning bolt) button in the status bar and pick "Restart All Servers".

## Server resolution

The extension picks the first of:

1. `lsp.lunte.binary` in Zed settings.
2. `node_modules/lunte-lsp` in the project root, so the version matches the CLI.
3. `lunte-lsp` on `PATH`.
4. The latest `lunte-lsp` from npm, installed into the extension's work dir.

Local and managed installs run on Zed's bundled Node.

## Settings

```json
{
  "lsp": {
    "lunte": {
      "binary": { "path": "npx", "arguments": ["lunte-lsp"] }
    }
  }
}
```

To turn it off for a language:

```json
{
  "languages": {
    "TypeScript": { "language_servers": ["!lunte", "..."] }
  }
}
```
