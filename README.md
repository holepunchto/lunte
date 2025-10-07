# Lunte

Lunte is a work-in-progress JavaScript linter focused on a small, vendorable core. It parses with Acorn, runs a minimal rule suite, and reports findings via a simple CLI.

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
