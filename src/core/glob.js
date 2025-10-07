const SPECIAL_CHARS = /[.+^${}()|\\]/g;
const MAGIC_CHARS = /[*?[]/;

export function hasMagic(pattern) {
  return MAGIC_CHARS.test(pattern);
}

export function globToRegExp(glob) {
  const normalized = toPosix(glob);
  let re = '^';
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];

    if (char === '*') {
      const next = normalized[i + 1];
      if (next === '*') {
        // Collapse consecutive *
        while (normalized[i + 1] === '*') {
          i += 1;
        }
        const after = normalized[i + 1];
        if (after === '/') {
          re += '(?:.*\/)?';
          i += 2;
        } else {
          re += '.*';
          i += 2;
        }
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }

    if (char === '?') {
      re += '[^/]';
      i += 1;
      continue;
    }

    if (char === '[') {
      const { segment, length } = readCharacterClass(normalized.slice(i));
      if (segment) {
        re += segment;
        i += length;
        continue;
      }
      // Treat as literal if malformed
      re += '\\[';
      i += 1;
      continue;
    }

    re += escapeRegExp(char);
    i += 1;
  }

  re += '$';
  return new RegExp(re);
}

export function toPosix(path) {
  return path.replace(/\\+/g, '/');
}

function escapeRegExp(char) {
  return char.replace(SPECIAL_CHARS, '\\$&');
}

function readCharacterClass(input) {
  let i = 1;
  if (input[i] === '!' || input[i] === '^') {
    i += 1;
  }
  if (input[i] === ']') {
    i += 1;
  }
  while (i < input.length && input[i] !== ']') {
    if (input[i] === '\\') {
      i += 1;
      if (i < input.length) {
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  if (i >= input.length) {
    return { segment: null, length: 0 };
  }
  const content = input.slice(0, i + 1);
  return { segment: content, length: i + 1 };
}
