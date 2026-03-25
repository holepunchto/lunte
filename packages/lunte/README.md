# Lunte Core

A self-contained JavaScript linter for Pear/Bare projects, implementing most non-formatting rules from Standard.js.

[![NPM Version](https://img.shields.io/npm/v/lunte.svg)](https://www.npmjs.com/package/lunte)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

`lunte` is the core CLI and analysis engine. It provides:

- **JavaScript Linting**: Rule-based static analysis matching Standard.js conventions
- **TypeScript Support**: Experimental parsing for `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts` files
- **Pear/Bare Runtime**: Native support for Pear and Bare environments with appropriate globals
- **Plugin Architecture**: Extensible rule system via plugins
- **Inline Directives**: Comment-based suppression of specific findings

## Installation

```sh
npm install --save-dev lunte
```

**Note**: The TypeScript parser is bundled automatically—no additional installation required.

## Quick Start

### CLI Usage

```sh
# Lint current directory
lunte

# Lint specific files or directories
lunte src/

# Use glob patterns
lunte "src/**/*.js"

# Combine with configuration overrides
lunte --env browser --rule no-unused-vars=off src/
```

### Programmatic Usage

```javascript
import { runCli, analyze, builtInRules, registerRule, loadPlugins } from 'lunte';

// Run CLI programmatically
const exitCode = await runCli(['src/', '--rule', 'no-undef=warn']);

// Get analysis results
const results = await analyze('src/', { env: ['node'] });

// Register custom rules
registerRule({
  meta: { name: 'my-rule' },
  create(context) { /* ... */ }
});

// Load plugins
await loadPlugins(['lunte-plugin-pear']);
```

## Built-in Rules

Lunte includes the following built-in linting rules (matching Standard.js non-formatting rules):

| Rule | Description | Default Severity |
|------|-------------|------------------|
| `constructor-super` | Validate calls to `super()` in constructors | Error |
| `curly` | Require braces for all control statements | Error |
| `default-case-last` | Enforce default case in switch statements | Error |
| `eqeqeq` | Require strict equality operators (`===`) | Error |
| `import-no-duplicates` | Prevent duplicate imports | Error |
| `no-case-declarations` | Disallow lexical declarations in case clauses | Error |
| `no-cond-assign` | Disallow assignment in conditional expressions | Error |
| `no-const-assign` | Disallow reassignment of const variables | Error |
| `no-debugger` | Disallow `debugger` statements | Warning |
| `no-dupe-keys` | Prevent duplicate keys in object literals | Error |
| `no-duplicate-case` | Prevent duplicate case labels in switch | Error |
| `no-empty` | Disallow empty statement blocks | Error |
| `no-empty-pattern` | Disallow empty destructuring patterns | Error |
| `no-extra-boolean-cast` | Remove unnecessary double negation | Error |
| `no-fallthrough` | Require `break` or return in switch cases | Error |
| `no-multi-str` | Disallow multiple strings in a single string literal | Error |
| `no-redeclare` | Prevent variable redeclaration | Error |
| `no-return-assign` | Disallow assignment in return statements | Warning |
| `no-undef` | Disallow use of undeclared variables | Error |
| `no-unreachable` | Disallow unreachable code after return/throw | Error |
| `no-unused-vars` | Disallow unused variables and parameters | Warning |
| `no-use-before-define` | Disallow use before declaration | Error |
| `no-var` | Require `const` or `let` instead of `var` | Error |
| `package-json-exports-order` | Enforce correct exports order in package.json | Error |
| `prefer-const` | Prefer `const` over `let` for unassigned variables | Warning |

See individual rule files in the [`src/rules/`](./src/rules/) directory for detailed documentation.

## Configuration

Configuration is optional but recommended for larger projects. Create a `.lunte` or `.lunterc.json` file at your project root:

```json
{
  "env": ["node", "es2021"],
  "globals": ["MY_APP", "window"],
  "plugins": ["./plugins/lunte-plugin-custom.js"],
  "rules": {
    "no-undef": "off",
    "no-unused-vars": "error"
  },
  "disableHolepunchGlobals": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `env` | string[] | `["node"]` | Preset global sets (`node`, `browser`, `es2021`) |
| `globals` | string[] | `[]` | Project-specific globals (case-sensitive) |
| `plugins` | string[] | `[]` | Plugin module IDs or file paths |
| `rules` | object | Default rules | Per-rule severity overrides |
| `disableHolepunchGlobals` | boolean | `false` | Skip Pear/Bare globals when true |

### Environment Presets

- **node**: Node.js environment globals (`process`, `Buffer`, `require`, etc.)
- **browser**: Browser environment globals (`window`, `document`, `fetch`, etc.)
- **es2021**: ES2021 language features and globals

## TypeScript Support

Lunte includes experimental TypeScript parsing via a vendored version of [`@sveltejs/acorn-typescript`](https://github.com/sveltejs/acorn-typescript).

### Supported File Extensions

| Extension | Parser Used |
|-----------|-------------|
| `.ts` | TypeScript |
| `.tsx` | TypeScript + JSX |
| `.mts` | TypeScript (ESM) |
| `.cts` | TypeScript (CommonJS) |
| `.d.ts` | TypeScript declarations |

**Note**: Plain `.js` files with type annotations should be renamed to `.ts`/`.tsx`.

### Type-Aware Rules

The following rules support type information:

- **no-undef**: Recognizes types, interfaces, enums, and namespaces
- **no-unused-vars**: Respects type-only imports and decorators

Other rules run without full type checking.

## Plugin System

Load third-party rule packs via the `plugins` configuration option or CLI flags.

### Creating a Plugin

Plugins must export a `rules` array (or object) of rule definitions:

```javascript
// lunte-plugin-custom.js
export const rules = [
  {
    meta: {
      name: 'custom/no-foo',
      description: 'Prevents use of foo()',
      fixable: true
    },
    create(context) {
      return {
        CallExpression(node) {
          if (node.callee.name === 'foo') {
            context.report({
              node,
              message: 'Avoid using foo() function',
              fix(fixer) {
                return fixer.replaceText(node.callee, 'bar');
              }
            });
          }
        }
      };
    }
  }
];

// Optional: export additional metadata
export const meta = {
  author: 'Your Name',
  version: '1.0.0'
};
```

### Using Plugins

**In .lunterc:**
```json
{
  "plugins": ["./rules/lunte-plugin-custom.js", "lunte-plugin-pear"],
  "rules": {
    "custom/no-foo": "error"
  }
}
```

**Via CLI:**
```sh
lunte --plugin ./rules/lunte-plugin-custom.js src/
```

## Inline Ignore Directives

Suppress specific findings inline with comments:

```javascript
const cached = maybeUndefined(); // lunte-disable-line no-undef

// lunte-disable-next-line
useGlobalResource();

/* eslint-disable no-console */
console.log('This is allowed in this block');
/* eslint-enable no-console */
```

| Directive | Description |
|-----------|-------------|
| `lunte-disable-line` | Suppress rules on the same line (or all if none listed) |
| `lunte-disable-next-line` | Apply to next line only |
| `eslint-disable-*` | ESLint-compatible directives for migration |

## Excluding Files

By default, Lunte skips `node_modules/`. Customize exclusions with `.lunteignore`:

```
# .lunteignore (gitignore-style patterns)
dist/
build/
*.min.js
test/fixtures/
coverage/
```

Patterns support:
- Directory globs (`dist/`)
- File extensions (`*.min.js`)
- Negative patterns (`!**/*.min.js` to include minified files)

## CLI Reference

### Commands

```sh
lunte [options] [<file> | <glob>]
```

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `--env` | Override environment preset | `--env browser` |
| `--global` | Add global variable | `--global MY_VAR` |
| `--rule` | Override rule severity | `--rule no-unused-vars=warn` |
| `--plugin` | Load plugin | `--plugin lunte-plugin-pear` |
| `--typescript` | Force TypeScript parser | `--typescript src/file.js` |
| `--help` | Show help message | - |
| `--version` | Show version number | - |

### Examples

```sh
# Lint with custom environment and rule override
lunte --env browser --rule no-console=off src/

# Force TypeScript parser on a .js file
lunte --typescript src/file.js

# Load multiple plugins
lunte --plugin plugin-a --plugin ./local-plugin.js src/
```

## Testing

Run tests using the `brittle` test framework:

```sh
# Run all tests
npm test

# Node.js tests only
npm run test:node

# Bare runtime tests (requires Bare)
npm run test:bare

# Specific test file
npx brittle-node "test/core/analyzer.test.js"
```

## Project Structure

```
packages/lunte/
├── src/
│   ├── cli.js              # Command-line interface
│   ├── index.js            # Main entry point (exports)
│   ├── config/             # Configuration management
│   │   ├── plugins.js      # Plugin loading
│   │   └── ...
│   ├── core/               # Analysis engine
│   │   ├── analyzer.js     # AST analysis orchestrator
│   │   ├── parser.js       # JavaScript/TypeScript parsing
│   │   ├── rule-runner.js  # Rule execution engine
│   │   ├── reporter.js     # Output formatting
│   │   ├── ignore.js       # .lunteignore handling
│   │   ├── glob.js         # Glob pattern matching
│   │   ├── file-resolver.js# File resolution logic
│   │   ├── file-directives.js # Directive parsing
│   │   ├── inline-ignores.js # Inline comment handling
│   │   ├── rule-context.js # Rule execution context
│   │   └── scope-manager.js # Scope analysis
│   ├── rules/              # Built-in linting rules
│   │   ├── index.js        # Rule registry
│   │   ├── no-undef.js     # Undeclared variable detection
│   │   ├── no-unused-vars.js # Unused variable detection
│   │   └── ... (25+ rules)
│   └── utils/              # Utility functions
├── test/                   # Test suite
│   ├── core/               # Core functionality tests
│   ├── rules/              # Rule-specific tests
│   └── fixtures/           # Test fixtures and sample files
├── vendor/                 # Vendored dependencies
│   ├── acorn/              # JavaScript parser (MIT)
│   └── acorn-typescript/   # TypeScript parser support (MIT)
├── bin/lunte               # CLI executable
├── package.json            # Package metadata
└── README.md               # This file
```

## Dependencies

### Runtime Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `paparam` | ^1.8.6 | Parameter parsing utility |

### Optional Dependencies (Bare Runtime)

When running on Bare, Lunte uses these native modules:

- `bare-events`: Event system
- `bare-fs`: File system access
- `bare-module`: Module resolution
- `bare-os`: Operating system info
- `bare-path`: Path utilities
- `bare-process`: Process information
- `bare-subprocess`: Child process management
- `bare-url`: URL parsing
- `bare-utils`: Utility functions

### Development Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `brittle` | ^3.19.0 | Test framework |

## Vendor Attribution

This package includes vendored code from:

### Acorn (MIT License)

- **Repository**: https://github.com/acornjs/acorn
- **Purpose**: Core JavaScript parser
- **License**: MIT

### @sveltejs/acorn-typescript (MIT License)

- **Repository**: https://github.com/sveltejs/acorn-typescript  
- **Purpose**: TypeScript parsing support for Acorn
- **Version**: Tracks TypeScript 5.7
- **License**: MIT

See `../docs/vendor.md` in the monorepo root for complete attribution details.

## Limitations & Known Issues

### Current Constraints

1. **TypeScript Parser**: Experimental; tracks TS 5.7, may lag behind latest releases
2. **Type Checking**: Limited to `no-undef` and `no-unused-vars`; full type checking not implemented
3. **Performance**: Large projects with many files may experience slower analysis times
4. **Fixable Rules**: Most rules report errors but don't provide automatic fixes

### Future Roadmap

- [ ] Full TypeScript type checking integration
- [ ] Automatic code fixes for common issues
- [ ] Incremental parsing for faster re-analysis
- [ ] Additional environment presets (es2022, esnext)
- [ ] Improved error messages with suggestions

## Contributing

Contributions welcome! Areas of interest:

1. **New Rules**: Implement additional linting rules
2. **Bug Fixes**: Resolve parser or analysis issues
3. **Performance**: Optimize analysis speed for large codebases
4. **Documentation**: Improve rule documentation and examples
5. **Testing**: Increase test coverage for edge cases

### Development Setup

```sh
# Clone repository
git clone https://github.com/holepunchto/lunte.git
cd lunte/packages/lunte

# Install dependencies
npm install

# Run tests
npm test

# Format code (shared with monorepo)
npm run format

# Lint the package itself
npm run lint
```

### Adding a New Rule

1. Create rule file in `src/rules/` (e.g., `my-new-rule.js`)
2. Implement rule following existing patterns:
   - Export a `meta` object with name, description, fixable flag
   - Implement `create(context)` function returning visitor object
3. Register rule in `src/rules/index.js`
4. Add comprehensive tests in `test/rules/`

See existing rules for implementation examples.

## Resources

- [Monorepo README](../../README.md) - Full project documentation
- [Editor Integration Guide](../../docs/integration.md) - LSP setup instructions
- [Standard.js Rules](https://standardjs.com/rules.html) - Rule reference
- [GitHub Repository](https://github.com/holepunchto/lunte)

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

**Built with ❤️ for the Pear/Bare ecosystem**

For questions or issues, please open a ticket on [GitHub](https://github.com/holepunchto/lunte/issues).
