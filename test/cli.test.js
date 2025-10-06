import test from 'node:test';
import assert from 'node:assert/strict';

import { run } from '../src/cli.js';

test('shows help when requested', async () => {
  const exitCode = await run(['--help']);
  assert.equal(exitCode, 0);
});
