import test from 'brittle';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { analyze } from '../src/core/analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixturePath(name) {
  return join(__dirname, 'fixtures', name);
}

test('flags identifier used before definition', async (t) => {
  const result = await analyze({
    files: [fixturePath('use-before-define-invalid.js')],
    ruleOverrides: [
      { name: 'no-undef', severity: 'off' },
    ],
  });
  t.is(result.diagnostics.length, 1);
  const [diagnostic] = result.diagnostics;
  t.ok(
    diagnostic.message.includes('before it was defined') ||
    diagnostic.message.includes('is not defined'),
  );
});

test('allows identifier defined before use', async (t) => {
  const result = await analyze({
    files: [fixturePath('use-before-define-valid.js')],
    ruleOverrides: [
      { name: 'no-undef', severity: 'off' },
    ],
  });
  t.is(result.diagnostics.length, 0);
});

test('allows hoisted function declarations', async (t) => {
  const result = await analyze({
    files: [fixturePath('function-hoist.js')],
    ruleOverrides: [
      { name: 'no-undef', severity: 'off' },
    ],
  });
  t.is(result.diagnostics.length, 0);
});
