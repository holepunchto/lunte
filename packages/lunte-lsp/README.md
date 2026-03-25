# Lunte LSP

A Language Server Protocol (LSP) wrapper for the Lunte JavaScript linter.

[![NPM Version](https://img.shields.io/npm/v/lunte-lsp.svg)](https://www.npmjs.com/package/lunte-lsp)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

`lunte-lsp` provides a standards-compliant Language Server Protocol implementation that powers editor integration for the Lunte linter. It exposes a JSON-RPC 2.0 / LSP endpoint over stdio, enabling real-time diagnostics in editors and IDEs.

### Key Features

- **Full Document Sync**: Complete document synchronization with `TextDocumentSyncKind.Full`
- **Diagnostics Only**: Provides linting errors and warnings to the editor
- **Configuration Support**: Resolves `.lunterc` / `.lunterc.json` from workspace root
- **Inline Directives**: Honors `lunte-disable-*` and `eslint-disable-*` comments
- **Ignore Files**: Supports `.lunteignore` patterns for file exclusion
- **Standard Compliance**: Uses the same rule engine as the Lunte CLI

## Installation

```sh
npm install --save-dev lunte-lsp
```

**Note**: This package requires `lunte` as a peer dependency. The easiest way to use it is via `npx`:

```sh
npx lunte-lsp
```

## Quick Start

### Starting the Server Manually

Run the LSP server directly from your terminal:

```sh
# Using npx (recommended)
npx lunte-lsp

# Or install globally and run
npm install -g lunte-lsp
lunte-lsp
```

The server will listen on stdio for JSON-RPC messages. Keep it running in the background while you work in your editor.

## Editor Integration

### Neovim (nvim-lspconfig)

#### Minimal Configuration

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Define lunte if not already defined
configs.lunte = configs.lunte or {
  default_config = {
    cmd = { 'npx', 'lunte-lsp' },
    filetypes = { 'javascript', 'typescript' },
    root_dir = lspconfig.util.find_git_ancestor,
    single_file_support = true,
  },
}

-- Enable the server
lspconfig.lunte.setup({})
```

#### Lazy.nvim Plugin Configuration

For users of [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
return {
  {
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      local lspconfig = require("lspconfig")
      local configs = require("lspconfig.configs")

      -- Initialize lunte if not already configured
      if not configs.lunte then
        configs.lunte = {
          default_config = {
            cmd = { "npx", "lunte-lsp" },
            filetypes = { "javascript", "typescript" },
            root_dir = lspconfig.util.root_pattern("package.json", ".git"),
            single_file_support = true,
          },
        }
      end

      -- Setup with custom options if needed
      lspconfig.lunte.setup({
        on_attach = function(bufnr)
          -- Custom keybindings can be added here
          vim.keymap.set('n', 'gd', vim.lsp.buf.definition, {buffer=bufnr})
        end,
      })
    end,
  },
}
```

#### Keybindings for Diagnostics

Add these to your Neovim config for easy diagnostic navigation:

```lua
-- Navigate between diagnostics
vim.keymap.set('n', '[d', vim.lsp.buf.prev_diag, { noremap = true })
vim.keymap.set('n', ']d', vim.lsp.buf.next_diag, { noremap = true })

-- Show diagnostic hover information
vim.keymap.set('n', 'K', vim.lsp.buf.hover, { noremap = true })
```

### VS Code

The repository includes a dedicated VS Code extension at `packages/vscode-lunte`. To use it in development:

1. **Install dependencies**:
   ```sh
   cd packages/vscode-lunte
   npm install
   ```

2. **Launch in development mode**:
   ```sh
   code --extensionDevelopmentPath="${PWD}"
   ```

3. **Open a JavaScript/TypeScript file** - the extension will activate and connect to `lunte-lsp` automatically.

#### Configuration Options

Customize LSP behavior via VS Code settings (`Preferences > Open Settings (JSON)`):

```json
{
  "lunte.lsp.command": "npx",
  "lunte.lsp.args": ["lunte-lsp"]
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `lunte.lsp.command` | string | `"npx"` | Command to launch the language server |
| `lunte.lsp.args` | array | `["lunte-lsp"]` | Arguments passed to the command |

**Example**: Pin a specific binary installation:
```json
{
  "lunte.lsp.command": "/usr/local/bin/lunte-lsp",
  "lunte.lsp.args": []
}
```

### Other Editors

Lunte LSP follows the Language Server Protocol specification, so it should work with any LSP-compatible editor. Common editors that support JavaScript/TypeScript LSP:

- **Vim/Neovim**: Via [vim-lsc](https://github.com/rhysd/vim-lsc) or [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- **Emacs**: Via [lsp-mode](https://github.com/emacs-lsp/lsp-mode) or [eglot](https://github.com/joaotavora/eglot)
- **Sublime Text**: Via [LSP package](https://packagecontrol.io/packages/LSP)
- **Atom**: Via [language-lsp-client](https://atom.io/packages/language-lsp-client) (deprecated)
- **Zed**: Via LSP support

**Configuration pattern** for most editors:
```json
{
  "command": "npx",
  "args": ["lunte-lsp"],
  "filetypes": ["javascript", "typescript"]
}
```

## Protocol Details

### Server Capabilities

The Lunte LSP server advertises the following capabilities during initialization:

| Capability | Value | Description |
|------------|-------|-------------|
| `textDocumentSync` | `TextDocumentSyncKind.Full` | Full document synchronization |
| `hoverProvider` | `true` | Hover information for symbols |
| `definitionProvider` | `false` | Not implemented |
| `referencesProvider` | `false` | Not implemented |
| `diagnosticProvider` | `true` | Diagnostics on save and change |
| `codeActionProvider` | `false` | No code actions yet |

### Supported LSP Methods

#### Document Events

- **`textDocument/didOpen`**: Opens a document for analysis
- **`textDocument/didChange`**: Updates document content (triggers re-analysis)
- **`textDocument/didClose`**: Closes and stops analyzing a document
- **`workspace/didChangeConfiguration`**: Configuration changes (not yet implemented)

#### Diagnostic Events

- **`textDocument/publishDiagnostics`**: Sends diagnostic results to client
  - Includes line/column positions for all errors and warnings
  - Supports `lunte-disable-*` directive suppression

#### Information Events

- **`textDocument/hover`**: Shows documentation on hover (basic symbol info)

### Request/Response Pattern

The server uses JSON-RPC 2.0 over stdio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "processId": 12345,
    "rootUri": "file:///path/to/project",
    "capabilities": { ... }
  }
}
```

## Configuration Resolution

The LSP server resolves configuration using the same rules as the CLI:

### Search Path

Configuration files are searched in this order starting from the workspace root (`rootUri` or `rootPath`):

1. `.lunterc` (JavaScript/JSON module)
2. `.lunterc.json`
3. No configuration (uses defaults)

### Workspace Root Detection

- **VS Code**: Uses the opened folder as workspace root
- **Neovim**: Defaults to Git ancestor or manual `root_dir` setting
- **Manual Start**: Current working directory at server launch

### Configuration Precedence

1. `.lunterc` / `.lunterc.json` file in project root
2. Command-line arguments (when started manually)
3. Default Lunte configuration

## Limitations & Known Issues

### Current Constraints

| Feature | Status | Notes |
|---------|--------|-------|
| **Incremental Parsing** | ❌ Not Implemented | Full document sync only; slower for large files |
| **Code Actions** | ❌ Not Implemented | No quick fixes or suggestions yet |
| **Autofix Support** | ❌ Not Implemented | Diagnostics are read-only |
| **Hover Documentation** | ⚠️ Basic Only | Shows symbol info, not full docs |
| **Go to Definition** | ❌ Not Implemented | Symbol navigation unavailable |
| **Find References** | ❌ Not Implemented | Cross-file reference search unavailable |

### Performance Considerations

- **Large Files**: Full document sync may cause delays in files >10KB
- **Multiple Documents**: Each document is analyzed independently (no shared state)
- **Startup Time**: Initial analysis includes parsing all project files for configuration resolution

### Future Roadmap

- [ ] Incremental parsing for faster re-analysis
- [ ] Code actions with automatic fixes
- [ ] Enhanced hover documentation from rule descriptions
- [ ] Go to definition and find references support
- [ ] Workspace-wide symbol search
- [ ] Configuration hot-reload without restart

## Development

### Running Tests

```sh
# Run all tests
npm test

# Test specific file
npx brittle-node "test/server.test.js"
```

### Building for Production

The package is already built (ES modules with native imports). For Bare runtime optimization:

```sh
# Install Bare dependencies
npm install --save-optional bare-path bare-process bare-url bare-utils

# Build for Bare environment
bare build packages/lunte-lsp/bin/lunte-lsp -o lunte-lsp-bare
```

### Debugging the LSP Server

Enable verbose logging in your editor:

#### Neovim (nvim-lspconfig)

Add to your configuration:

```lua
lspconfig.lunte.setup({
  log_level = lsp.log_levels.TRACE,
  settings = {
    lunte = {
      debug = true
    }
  }
})
```

Or use environment variable when starting manually:

```sh
export LSP_TRACE=1
npx lunte-lsp > lsp-debug.log 2>&1
```

#### VS Code (Development)

Add to your extension launch configuration in `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Launch LSP Server",
  "cwd": "${workspaceFolder}",
  "runtimeExecutable": "npx",
  "args": ["lunte-lsp"],
  "outFiles": ["${workspaceFolder}/**/*.js"],
  "debugServer": 4711
}
```

### Architecture Overview

```
packages/lunte-lsp/
├── src/
│   └── server.js           # Main LSP server implementation
├── bin/
│   └── lunte-lsp           # CLI entry point (executes server)
├── test/                   # Test suite
├── package.json            # Package metadata
└── README.md               # This file
```

### Server Implementation Details

The LSP server (`src/server.js`) provides:

1. **Initialization Handler**: Sets up capabilities and workspace configuration
2. **Document Manager**: Tracks open documents and their contents
3. **Analysis Queue**: Schedules linting tasks for changed documents
4. **Diagnostic Emitter**: Formats and sends diagnostics to client
5. **Configuration Resolver**: Loads `.lunterc` from workspace root

### Adding New LSP Features

To add a new capability (e.g., code actions):

1. Update `initialize` response in `src/server.js`:
   ```javascript
   capabilities.codeActionProvider = true;
   ```

2. Implement handler for the new method:
   ```javascript
   connection.onRequest('textDocument/codeAction', async (params) => {
     // Return code actions array
     return [{
       title: 'Fix this issue',
       kind: CodeActionKind.QuickFix,
       diagnostics: params.context.diagnostics
     }];
   });
   ```

3. Add corresponding tests in `test/`

## Dependencies

### Runtime Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `lunte` | ^1.6.0 | Core linter engine and rule definitions |

### Optional Dependencies (Bare Runtime)

When running on Bare runtime, uses these native modules:

- `bare-path`: Path utilities
- `bare-process`: Process information
- `bare-url`: URL parsing for file URIs
- `bare-utils`: Utility functions

### LSP Protocol Implementation

The server implements the Language Server Protocol specification using JSON-RPC 2.0 over stdio. No additional dependencies required for protocol handling.

## Comparison with Other JavaScript Linters

| Feature | Lunte-LSP | ESLint | Standard |
|---------|-----------|--------|----------|
| **Setup Complexity** | Low (zero config) | High (config required) | Medium |
| **TypeScript Support** | Experimental | Native | Limited |
| **Fixable Rules** | None | Extensive | Some |
| **Performance** | Fast (native parser) | Variable | Fast |
| **Editor Integration** | LSP | LSP + Plugins | CLI only |
| **Configuration Format** | `.lunterc` JSON | `.eslintrc` / ESLint config | None |

## Troubleshooting

### Server Won't Start

**Problem**: Editor shows "LSP server failed to start" error.

**Solutions**:
1. Ensure `npx lunte-lsp` works from terminal:
   ```sh
   npx lunte-lsp  # Should start and wait for input
   ```
2. Check Node.js version (v16+ recommended)
3. Verify `lunte` is installed in project dependencies

### Diagnostics Not Appearing

**Problem**: Editor shows no linting errors despite code issues.

**Solutions**:
1. Check `.lunterc` configuration for disabled rules
2. Verify file isn't excluded by `.lunteignore`
3. Ensure LSP server is attached to the correct workspace root
4. Try reopening files after server restart

### Performance Issues

**Problem**: Editor lags when editing JavaScript/TypeScript files.

**Solutions**:
1. Disable LSP for very large files (>50KB) in editor settings
2. Use `.lunteignore` to exclude unnecessary directories
3. Consider using `lunte` CLI directly instead of LSP for one-off checks
4. Wait for incremental parsing implementation (future release)

### Configuration Not Applied

**Problem**: Custom rules or settings from `.lunterc` not applied.

**Solutions**:
1. Verify `.lunterc` is in workspace root (Git ancestor for Neovim)
2. Check JSON syntax validity with `jsonlint .lunterc`
3. Restart LSP server after configuration changes
4. Use `--rule` CLI overrides to test individual settings

## Resources

- [Lunte Monorepo README](../../README.md) - Full project documentation
- [Editor Integration Guide](../../docs/integration.md) - Detailed editor setup instructions
- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/) - LSP spec reference
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) - RPC protocol details

## Contributing

Contributions welcome! Areas of interest:

1. **Incremental Parsing**: Implement document delta analysis for faster updates
2. **Code Actions**: Add automatic fixes and suggestions
3. **Symbol Navigation**: Go to definition, find references
4. **Hover Documentation**: Rich documentation on symbol hover
5. **Workspace Features**: Symbol search, workspace diagnostics
6. **Performance Optimization**: Reduce memory usage and startup time

### Development Setup

```sh
# Clone repository
git clone https://github.com/holepunchto/lunte.git
cd lunte/packages/lunte-lsp

# Install dependencies
npm install

# Run tests
npm test

# Format code (shared with monorepo)
npm run format
```

## License

Apache-2.0

```
Copyright 2026 Holepunch <support@holepunch.to>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

**Built with ❤️ for better editor experiences**

For questions, issues, or feature requests, please visit [GitHub Issues](https://github.com/holepunchto/lunte/issues).
