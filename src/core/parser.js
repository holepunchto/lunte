import { parse as acornParse } from '../../vendor/acorn/dist/acorn.mjs';

export const DEFAULT_OPTIONS = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true,
  ranges: true,
  allowHashBang: true,
};

export function parse(sourceText, options = {}) {
  if (typeof sourceText !== 'string') {
    throw new TypeError('Parser input must be a string.');
  }

  return acornParse(sourceText, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}
