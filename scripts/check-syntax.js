#!/usr/bin/env node

import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const roots = ['bin', 'src', 'scripts', 'test'];

async function gatherFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const result = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await gatherFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      result.push(fullPath);
    }
  }
  return result;
}

async function main() {
  const files = (await Promise.all(roots.map(gatherFiles))).flat();

  for (const file of files) {
    await execFileAsync(process.execPath, ['--check', file]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
