import test from 'brittle';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { analyze } from '../src/core/analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixturePath(file) {
  return join(__dirname, 'fixtures', file);
}

test('returns parse error for invalid syntax', async (t) => {
  const result = await analyze({ files: [fixturePath('invalid.js')] });
  t.is(result.diagnostics.length, 1, 'should emit one diagnostic');
  const [diagnostic] = result.diagnostics;
  t.is(diagnostic.severity, 'error');
  t.ok(diagnostic.message.includes('Unexpected token'), 'message should mention unexpected token');
});

test('returns empty diagnostics for valid file', async (t) => {
  const result = await analyze({ files: [fixturePath('valid.js')] });
  t.is(result.diagnostics.length, 0);
});
