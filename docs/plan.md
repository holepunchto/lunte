# Lunte Linter Development Plan

## Stage 0 – Project Scaffold
- Initialize CLI entry (`bin/lunte`) wired via `package.json`.
- Vendor Acorn parser source under `vendor/acorn`, add build script to refresh vendor copy.
- Configure plain JavaScript project structure with strict lint/test scripts using `node:test`.
- Establish repo conventions: lint rule layout (`src/rules`), shared utilities (`src/core`), and configuration format docs.

## Stage 1 – Minimal Analyzer
- Implement file loader, CLI arg parsing, and glob expansion without extra dependencies.
- Build parsing wrapper around Acorn that outputs ESTree nodes plus location metadata helpers.
- Implement scope tracker and symbol table utilities to support `no-use-before-define` rule.
- Create rule engine interface (`RuleContext`, visitor callbacks) and register the first rule.
- Add console formatter that prints file:line:column, severity, and message counts.

## Stage 2 – Configuration & Reporting
- Design layered config resolution (project root `.luntrc.json`, overrides, inline ignores).
- Add severity levels, rule options, and ability to disable per file or block via comments.
- Extend reporters: stylish default, JSON for tooling integration, quiet mode.
- Document configuration schema and reporter usage in `docs/`.

## Stage 3 – Rule Suite Expansion
- Add core symbol/data-flow helpers for unused vars, undefined vars, shadowing, and simple constant folding.
- Implement autofix primitives and update formatter to show fix hints.
- Provide snapshot-style tests for each rule and regression fixtures for tricky patterns.

## Stage 4 – Incremental & Integration Prep
- Introduce file cache to reuse AST/scope info between runs and enable `--watch` mode.
- Publish public API for programmatic runs (ESM/CJS) with JSDoc annotations for editor tooling.
- Outline LSP server surface (diagnostics, code actions) built on the shared analyzer services.
- Create contributor guide describing how to add new rules and vendor updates to Acorn.

## Stage 5 – LSP Prototype
- Implement thin LSP server wrapping the analyzer; support incremental document updates.
- Map diagnostics to LSP protocol, including related information and quick fixes.
- Integrate with editor samples (VS Code, Neovim) and document setup in `docs/integration.md`.
