import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import { globToRegExp, toPosix } from './glob.js';

const DEFAULT_IGNORE_FILE = '.lunteignore';

export async function loadIgnore({ cwd = process.cwd(), ignorePath } = {}) {
  const patterns = [];
  const files = [];

  if (ignorePath) {
    files.push(isAbsolute(ignorePath) ? ignorePath : join(cwd, ignorePath));
  } else {
    files.push(join(cwd, DEFAULT_IGNORE_FILE));
  }

  for (const filePath of files) {
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      let negated = false;
      let pattern = line;
      if (pattern.startsWith('!')) {
        negated = true;
        pattern = pattern.slice(1);
      }

      let directoryOnly = false;
      if (pattern.endsWith('/')) {
        directoryOnly = true;
        pattern = pattern.slice(0, -1);
      }

      const anchored = pattern.startsWith('/');
      if (anchored) {
        pattern = pattern.slice(1);
      }

      if (!pattern) {
        continue;
      }

      const globPattern = anchored ? pattern : ensureLeadingDoubleStar(pattern);
      const regex = globToRegExp(globPattern);
      patterns.push({ regex, negated, directoryOnly });
    }
  }

  return {
    ignores(targetPath, { isDir = false } = {}) {
      if (patterns.length === 0) {
        return false;
      }

      const rel = toPosixPath(relative(cwd, targetPath));
      if (rel.startsWith('..')) {
        return false;
      }

      const value = rel === '' ? '.' : rel;
      let ignored = false;
      for (const pattern of patterns) {
        const match = pattern.regex.test(value) || (isDir && pattern.regex.test(`${value}/`));
        if (!match) continue;
        ignored = !pattern.negated;
      }
      return ignored;
    },
  };
}

function ensureLeadingDoubleStar(pattern) {
  if (pattern.startsWith('**/')) {
    return pattern;
  }
  return `**/${pattern}`;
}

function toPosixPath(path) {
  return toPosix(path.split(sep).join('/'));
}
