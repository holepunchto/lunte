const DIRECTIVE_COMMENT_MAX = 16_384;

export function extractFileDirectives(source) {
  const directives = {
    globals: new Set(),
    envs: new Set(),
  };

  let index = 0;
  const length = Math.min(source.length, DIRECTIVE_COMMENT_MAX);

  while (index < length) {
    const char = source[index];

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      index += 1;
      continue;
    }

    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) break;
      const content = source.slice(index + 2, end).trim();
      handleBlockDirective(content, directives);
      index = end + 2;
      continue;
    }

    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      const content = source.slice(index + 2, end === -1 ? length : end).trim();
      handleLineDirective(content, directives);
      index = end === -1 ? length : end + 1;
      continue;
    }

    break;
  }

  return directives;
}

function handleBlockDirective(content, directives) {
  if (!content) return;
  if (content.startsWith('global')) {
    const payload = content.slice('global'.length).trim();
    for (const name of parseGlobalList(payload)) {
      directives.globals.add(name);
    }
    return;
  }

  if (content.startsWith('eslint-env')) {
    const payload = content.slice('eslint-env'.length).trim();
    for (const env of parseEnvList(payload)) {
      directives.envs.add(env);
    }
  }
}

function handleLineDirective(content, directives) {
  if (!content) return;
  if (content.startsWith('global')) {
    const payload = content.slice('global'.length).trim();
    for (const name of parseGlobalList(payload)) {
      directives.globals.add(name);
    }
  }
}

function parseGlobalList(payload) {
  if (!payload) return [];
  return payload
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((entry) => entry.split(':')[0].trim())
    .filter(Boolean);
}

function parseEnvList(payload) {
  if (!payload) return [];
  return payload
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}
