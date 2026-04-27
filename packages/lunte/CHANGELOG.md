# Changelog

## 1.8.0

### Added
- Lint generic `.json` files with strict JSON parsing.

### Changed
- Run structural rules such as `no-dupe-keys` against JSON files.
- Keep `package-json/exports-order` scoped to `package.json`.

## 1.7.0

### Added
- Add `--stdin` support for piping source into `lunte`.
- Add the `require-await` rule, warning on async non-generator functions that never use `await`, `for await`, or `await using`.

### Changed
- Ignore `constructor-super` checks in TypeScript declaration files.
- Refresh package documentation.
