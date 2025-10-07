import test from 'brittle';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['bin/lunte', ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test('CLI reports parse errors', async (t) => {
  const file = join('test/fixtures/invalid.js');
  const result = await runCli([file]);

  t.is(result.code, 1);
  t.ok(/ERROR/.test(result.stdout), 'stdout should contain ERROR');
  t.is(result.stderr, '');
});

test('CLI exits 0 for valid input', async (t) => {
  const file = join('test/fixtures/valid.js');
  const result = await runCli([file]);

  t.is(result.code, 0);
  t.ok(/No issues/.test(result.stdout), 'stdout should report no issues');
  t.is(result.stderr, '');
});

test('CLI respects rule overrides', async (t) => {
  const file = join('test/fixtures/no-unused-vars-invalid.js');
  const result = await runCli(['--rule', 'no-unused-vars=off', file]);

  t.is(result.code, 0);
  t.ok(/No issues/.test(result.stdout), 'warnings should be suppressed when rule disabled');
  t.is(result.stderr, '');
});

test('CLI env flag enables browser globals', async (t) => {
  const file = join('test/fixtures/env-browser.js');
  const result = await runCli(['--env', 'browser', file]);

  t.is(result.code, 0);
  t.ok(/No issues/.test(result.stdout));
  t.is(result.stderr, '');
});

test('CLI expands directory inputs', async (t) => {
  const dir = join('test/fixtures/sample-project');
  const result = await runCli([dir]);

  t.is(result.code, 0);
  t.ok(/No issues/.test(result.stdout));
  t.is(result.stderr, '');
});

test('CLI expands glob patterns', async (t) => {
  const pattern = 'test/fixtures/sample-project/**/*.js';
  const result = await runCli([pattern]);

  t.is(result.code, 0);
  t.ok(/No issues/.test(result.stdout));
  t.is(result.stderr, '');
});
