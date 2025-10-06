import test from 'brittle';

import { run } from '../src/cli.js';

test('shows help when requested', async (t) => {
  const exitCode = await run(['--help']);
  t.is(exitCode, 0, 'expected exit code 0 when showing help');
});
