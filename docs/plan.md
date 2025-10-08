# Lunte Linter Development Plan

## Stage 0 – Project Scaffold ✅ (complete)

- CLI entry wired via the `lunte` workspace, Acorn vendored under `packages/lunte/vendor`, and the repository managed via npm workspaces.
- Shared layout for core utilities (`packages/lunte/src/core`), rules (`packages/lunte/src/rules`), and docs is in place.
- Companion workspaces `lunte-lsp` and `vscode-lunte` host the editor-facing integration points.

## Stage 1 – Minimal Analyzer ✅ (complete)

- File resolution, CLI argument parsing (including glob support), AST parsing, scope tracking, and the base reporter are shipped.
- Initial rule engine and the first rules (`no-use-before-define`, `no-undef`, `no-unused-vars`) are active.

## Stage 2 – Configuration & Reporting ⚙️ (in progress)

- DONE: `.lunterc` / `.lunterc.json` loading with CLI merge, gitignore-style `.lunteignore`, default env/globals, improved console formatting, and inline disable directives (`lunte-disable-line`, `lunte-disable-next-line`).
- TODO: per-rule options surfaced via config, additional reporters (stylish/JSON/SARIF), quiet mode, and documentation of config keys.

## Stage 3 – Rule Suite Expansion ⚙️ (in progress)

- DONE: Core helpers now recognise exports, module-level hoisting, DOM globals, and destructuring.
- TODO: add more semantic rules (shadowing, unused params, constant folding), begin autofix infrastructure, expand fixture coverage.

## Stage 4 – Incremental & Integration Prep 🛣️ (not started)

- Introduce an analysis cache / `--watch` mode.
- Publish a small programmatic API with typings/JSDoc and author contributor docs.
- Design LSP-ready service interfaces (diagnostics, code actions).

## Stage 5 – LSP Prototype 🧭 (in progress)

- DONE: Build the lightweight LSP server on top of the shared analyzer.
- DONE: Document editor integration (Neovim + VS Code) in `docs/integration.md`.
- TODO: Emit code actions (suppressions, quick fixes) and run manual smoke tests in both VS Code and Neovim.

## Near-Term Next Steps

- Finish Stage 2 deliverables (reporters + config docs).
- Add rule options/overrides documentation and expose severity toggles via config.
- Plan incremental analysis work (API sketch + cache semantics).
- Expand LSP server capabilities (incremental sync, diagnostics metadata, code actions) and harden the VS Code client bootstrap.
