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

## @sveltejs/acorn-typescript

- Version: 1.0.7
- Source: `npm pack @sveltejs/acorn-typescript@1.0.7`
- Files stored under `vendor/acorn-typescript/`

### Updating @sveltejs/acorn-typescript

1. Run `npm run vendor:acorn-typescript -- <version>` (omit `<version>` for latest).
2. The script patches the plugin to import our vendored Acorn build; review the resulting diff to ensure the replacement succeeded.
3. Re-run `npm test` to confirm the combined parser still works.
4. Update this document with the new version number if it changed.
