# TypeScript Parser Plan

## Phase 1 – Plumbing + Opt-In Flag ✅

- [x] Add a `typescript` parser option to `.lunterc` and a matching `--typescript` CLI flag; thread it through `cli.js`, `analyze()`, and `parser.js`.
- [x] Introduce a parser manager module that returns either vanilla Acorn or a TypeScript-capable parser based on file extension plus the new option; for now stub the TS path with a clear "not implemented" error so the flag is testable.
- [x] Update documentation (`README.md`, `docs/vendor.md`) to mention the new config knob and note that TS parsing is behind an experimental flag until the spike lands.

## Phase 2 – Spike: @sveltejs/acorn-typescript ✅

- [x] Install `@sveltejs/acorn-typescript` + `acorn@8.15.0`, extend the parser manager to lazy-load the plugin, and gate it behind the `typescript` flag + `.ts/.tsx/.cts/.mts/.d.ts` extensions.
- [x] Added a `test/typescript-parser.test.js` smoke test plus `.ts` fixture and ran `npm run test --workspace=lunte` to confirm parsing succeeds.
- [x] Document findings from the spike: which rules break, any scope/AST quirks, and rough performance observations.
  - Type-only identifiers originally surfaced as runtime references, so they tripped `no-undef` until we added TypeScript-specific filtering.
  - `.tsx` parsing, enums/namespaces, and type-only imports/exports needed bespoke handling (now largely covered).
  - Vendoring the plugin requires patching its Acorn import to the local `vendor/acorn` tree; the `vendor:acorn-typescript` script automates that.

## Phase 3 – Solidify Parser + Traversal Support

- [x] Replace the temporary stub messaging with real behavior and remove the "experimental" caveat once the spike issues are addressed.
- [x] Expand traversal/scope helpers so type-only constructs don’t trip `no-undef`/`no-unused-vars` (type-only identifier filtering; enums, namespaces, import= handled; `.d.ts` skipped in both rules).
- [x] Add regression tests for enums, namespaces/import=, decorators, TSX parsing, ambient `.d.ts` globals, and JSX component usage.
- [x] Remaining gap: ambient globals from `node_modules` declaration files aren’t auto-loaded yet; experimental dependency scan now exists but is opt-in via `experimental__enableTSAmbientGlobals`.

### Immediate TODOs (Phase 3)

1. **Ambient globals from dependencies** – experimental opt-in (`experimental__enableTSAmbientGlobals`) scans dependency `.d.ts` entry points/global files; keep watching for gaps/false-positives before enabling by default.
2. **TS parser default toggle** – rerun full JS+TS suites under the TS parser to judge flipping the default or adding auto-detect.
3. **Ignore inheritance for build outputs** – ensure root-level `.lunteignore` patterns reliably suppress generated bundles without depending on cwd.

## Parser Strategy Check-In

The JS and TS parser paths still share the same manager (`src/core/parser.js`), but we intentionally keep them split behind the `--typescript` flag for now:

- **Risk containment** – Defaulting to the TS parser for everyone would change AST node shapes (e.g., decorators, TS nodes on class members) even in `.js` files, so gating lets us harden traversal/rules first.
- **Performance knobs** – Plain Acorn remains faster for JS-only projects; once the TS path proves stable we can revisit auto-detection or a unified default.
- **Scoped vendoring** – `@sveltejs/acorn-typescript` is vendored and lazily loaded; a unified parser would force every run to pay that cost even when linting vanilla JS.
- **Future convergence** – After we finish ambient-global ingestion and validate ignores, we can rerun the full suite under the TS parser to consider making it the default.
