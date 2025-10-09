# Vendored Dependencies

## Acorn

- Version: 8.15.0
- Source: `npm pack acorn@8.15.0`
- Files stored under `vendor/acorn/`

### Updating Acorn

1. Run `npm run vendor:acorn -- <version>` (omit `<version>` to grab the latest release).
2. Review the diff under `vendor/acorn/` and update parser defaults if the upstream API changes.
3. Update this document with the new version number.
4. Run `npm run check` and `npm test` to verify the vendored copy.
