#!/usr/bin/env node

import { rm, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const versionArg = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
  const spec = versionArg ? `acorn@${versionArg}` : 'acorn';

  console.log(`Vendoring ${spec}...`);

  const vendorDir = join(projectRoot, 'vendor');
  await mkdir(vendorDir, { recursive: true });

  const { stdout } = await execFileAsync('npm', ['pack', spec, '--silent'], {
    cwd: projectRoot,
  });
  const tarballName = stdout.trim().split('\n').pop().trim();
  const tarballPath = join(projectRoot, tarballName);

  await execFileAsync('tar', ['-xzf', tarballPath, '-C', vendorDir], {
    cwd: projectRoot,
  });

  await rm(join(vendorDir, 'acorn'), { recursive: true, force: true });
  await rename(join(vendorDir, 'package'), join(vendorDir, 'acorn'));

  await rm(tarballPath, { force: true });

  console.log(`Vendored Acorn from ${tarballName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
