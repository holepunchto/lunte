# Changelog

## 1.7.0

### Added
- Add `--stdin` support for piping source into `lunte`.
- Add the `require-await` rule, warning on async non-generator functions that never use `await`, `for await`, or `await using`.

### Changed
- Ignore `constructor-super` checks in TypeScript declaration files.
- Refresh package documentation.
