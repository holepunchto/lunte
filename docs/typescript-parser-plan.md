# TypeScript Parser Plan

## Phase 1 – Plumbing + Opt-In Flag ✅

- [x] Add a `typescript` parser option to `.lunterc` and a matching `--typescript` CLI flag; thread it through `cli.js`, `analyze()`, and `parser.js`.
- [x] Introduce a parser manager module that returns either vanilla Acorn or a TypeScript-capable parser based on file extension plus the new option; for now stub the TS path with a clear "not implemented" error so the flag is testable.
- [x] Update documentation (`README.md`, `docs/vendor.md`) to mention the new config knob and note that TS parsing is behind an experimental flag until the spike lands.

## Phase 2 – Spike: @sveltejs/acorn-typescript ✅

- [x] Install `@sveltejs/acorn-typescript` + `acorn@8.15.0`, extend the parser manager to lazy-load the plugin, and gate it behind the `typescript` flag + `.ts/.tsx/.cts/.mts/.d.ts` extensions.
- [x] Added a `test/typescript-parser.test.js` smoke test plus `.ts` fixture and ran `npm run test --workspace=lunte` to confirm parsing succeeds.
- [x] Document findings from the spike: which rules break, any scope/AST quirks, and rough performance observations.
  - Type-only identifiers (type aliases, interface members, generic params) originally surfaced as runtime references, so they tripped `no-undef` until we added TypeScript-specific filtering.
  - `.tsx` parsing, enums/namespaces, and type-only imports/exports still need bespoke handling (currently they would either parse as plain JS or count toward `no-unused-vars`).
  - Vendoring the plugin requires patching its Acorn import to the local `vendor/acorn` tree; the new `vendor:acorn-typescript` script automates that.

## Phase 3 – Solidify Parser + Traversal Support

- [x] Replace the temporary stub messaging with real behavior and remove the "experimental" caveat once the spike issues are addressed.
- [ ] Expand traversal (`iterateChildren`) and identifier helpers (`isReferenceIdentifier`, scope manager) so type-only constructs no longer trip `no-undef`, `no-unused-vars`, etc. *(Type-only identifier filtering and type-only import handling have landed; scope tweaks for enums/namespaces and `import=` remain.)*
- [ ] Add regression tests for enums, interfaces, decorators, TSX components, and namespaces; fix rules until the suite passes in both JS and TS modes. *(First TS-facing rule test added for `no-undef`; need additional fixtures for enums, namespaces, JSX.)*

## Phase 4 – Polish + Rollout

- [ ] Extend user docs with setup guidance (supported extensions, lazy-loading behavior, optional dependency workflow).
- [ ] Consider auto-enabling the TS parser when the project contains `.ts/.tsx` files, with an opt-out flag for JS-only repos.
- [ ] Collect early-adopter feedback and line up future TS-aware rule ideas (e.g., `no-floating-promises` with type info).
