# Testing the separated packages

These tests do not publish packages or require version bumps. Run `npm install` in
any repository before testing it. Artifact tests use temporary consumer projects
outside the checkouts, install production dependencies, and remove them afterward.

## Core (`lunte`)

```sh
npm test             # Node and Bare source tests
npm run test:package # npm tarball installed into a clean consumer
```

The package test checks the public API, bundled parsers, executable and exit codes,
configuration, ignore patterns, consumer plugins, and fixes written to disk.

## LSP (`lunte-lsp`)

In the LSP repository:

```sh
npm test
npm run test:package
```

The package test installs the packed server and runs the Node/Bare protocol suites
against its installed executable. By default its core dependency comes from npm.
To test an unpublished core tarball instead:

```sh
LUNTE_TARBALL=/absolute/path/to/lunte.tgz npm run test:package
```

An npm override forces the server to use this tarball rather than silently testing
a published version. `LUNTE_LSP_BIN` can also point the protocol suite directly at
an already-installed server executable.

## VS Code extension (`vscode-lunte`)

In the extension repository:

```sh
npm test
```

This packages a VSIX, installs it into an isolated extensions directory, and runs
real extension-host tests against that installed extension (not the source tree).
It checks activation, diagnostics, unsaved edits, configuration/ignore watching,
LSP document close (by changing language), and successful server shutdown without
an orphan process. VS Code can keep a document cached after its editor tab closes,
so closing a tab alone is not used as proof of a protocol `didClose`.

By default it downloads stable VS Code and installs the published LSP. Set
`LUNTE_LSP_TARBALL` and optionally `LUNTE_TARBALL` to test unpublished artifacts.
Set `LUNTE_TEST_NPX=1` to exercise local `npx` launching instead of a direct Node
command. The `npx` test disables installation/network fallback and adds only a
lifecycle probe to the server.

The watched-file tests require the new LSP handler; published `lunte-lsp@1.8.3`
does not have it. Until that fix is released, use the local tarball or the complete
integration command below rather than the registry default.

Set `VSCODE_EXECUTABLE_PATH` to reuse an installed VS Code executable, or
`VSCODE_VERSION` to download a particular version. For example, on macOS:

```sh
VSCODE_EXECUTABLE_PATH='/Applications/Visual Studio Code.app/Contents/MacOS/Code' npm test
```

Tests may open a separate VS Code window. They use temporary settings and extension
directories; your normal VS Code profile is not used. Linux GUI-less environments
need a display, for example `xvfb-run -a npm test`.

## Complete local integration

With all three repositories installed, run from the core repository:

```sh
npm run test:integration
```

This runs source tests, core artifact smoke tests, LSP artifact protocol tests,
and installed-VSIX extension-host tests with both Node and local `npx` launching.
Both downstream tests use the exact core
and LSP tarballs packed from these checkouts. The default sibling checkouts are
`../lunte-lsp` and `../vscode-lunte`; override them with `LUNTE_LSP_REPO` and
`VSCODE_LUNTE_REPO` if necessary. These paths are development tooling only, not
runtime dependencies. VS Code selection variables are passed through.

## Manual review

The remaining human review is the extension's visual experience:

1. Run `npm run package` in `vscode-lunte` and install the generated VSIX using
   **Extensions: Install from VSIX**.
2. For unpublished changes, set `lunte.lsp.command` to your absolute Node executable
   and `lunte.lsp.args` to an array containing the absolute path to
   `lunte-lsp/bin/lunte-lsp` in the installed LSP package or prepared checkout.
   Avoid the default `npx lunte-lsp` when checking unpublished changes.
3. Open a JavaScript workspace; confirm squiggles and Problems entries are useful,
   errors disappear after unsaved fixes, and reopening/reloading works normally.

The tests validate package behavior, not npm/Marketplace publishing credentials.
