# Lunte

A self-contained JavaScript linter, mostly matching non-formatting rules of Standard.

## Installation

```sh
npm install --save-dev lunte
```

## Usage

```sh
lunte [optional: dir or glob]
```

Globs are supported:

```sh
lunte "src/**/*.js"
```

By default Lunte skips `node_modules/`. Manage additional exclusions with `.lunteignore` (gitignore-style patterns).

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
- `globals` adds project-specific globals.
- `rules` sets severities per rule (`"off"`, `"warn"`, `"error"`, or `0/1/2`).
- `disableHolepunchGlobals` skips adding `Pear`/`Bare` globals.

Command-line overrides are available for ad-hoc runs:

```sh
lunte --env browser --global Pear --rule no-unused-vars=off src/
```

## TypeScript

- Experimental parser is bundled via vendored `@sveltejs/acorn-typescript`; no extra install needed.
- Files ending `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts` (and `.jsx` when present) automatically switch to the TS parser.
- Type-aware handling currently exists for `no-undef` and `no-unused-vars`; other rules run without type checking.

## Plugins

Load third-party rule packs by listing module IDs under `plugins`. Each plugin should export a `rules` array (or object) of rule definitions with unique `meta.name` values.

```json
{
  "plugins": ["./rules/lunte-plugin-pear.js", "lunte-plugin-pear"],
  "rules": {
    "pear/no-apples": "error"
  }
}
```

For ad-hoc runs, `lunte --plugin lunte-plugin-pear --plugin ./rules/lunte-plugin-pear.js src/` applies the same modules.

## Inline Ignores

```js
const cached = maybeUndefined() // lunte-disable-line no-undef

// lunte-disable-next-line
useGlobalResource()
```

- `lunte-disable-line` suppresses the listed rules, or all rules when none are listed, on the same line.
- `lunte-disable-next-line` applies to the following line.
- `eslint-disable-*` directives are also supported for compatibility.

## Editor Integration

Lunte ships with a separate LSP package: [`lunte-lsp`](https://www.npmjs.com/package/lunte-lsp).

## Repository

Monorepo: https://github.com/holepunchto/lunte

![lunte](https://raw.githubusercontent.com/holepunchto/lunte/main/docs/lunte.webp)

## License

Apache-2.0
