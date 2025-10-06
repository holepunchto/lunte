import { parse } from './parser.js';
import { runRules } from './rule-runner.js';

export async function analyze({ files }) {
  const diagnostics = [];

  for (const file of files) {
    const result = await analyzeFile(file);
    diagnostics.push(...result.diagnostics);
  }

  return { diagnostics };
}

async function analyzeFile(filePath) {
  const diagnostics = [];
  let source;

  try {
    source = await readFileText(filePath);
  } catch (error) {
    diagnostics.push({
      filePath,
      message: error.code === 'ENOENT' ? 'File not found' : error.message,
      severity: 'error',
    });
    return { diagnostics };
  }

  try {
    const ast = parse(source, { sourceFile: filePath });
    const ruleDiagnostics = runRules({ ast, filePath, source });
    diagnostics.push(...ruleDiagnostics);
  } catch (error) {
    diagnostics.push(
      buildParseErrorDiagnostic({ error, filePath, source }),
    );
  }

  return { diagnostics };
}

async function readFileText(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}

function buildParseErrorDiagnostic({ error, filePath, source }) {
  const { loc } = error;
  return {
    filePath,
    message: error.message,
    severity: 'error',
    line: loc?.line ?? inferLineFromError(error, source),
    column: loc?.column != null ? loc.column + 1 : undefined,
  };
}

function inferLineFromError(error, source) {
  if (typeof error.pos !== 'number') {
    return undefined;
  }

  const upToPos = source.slice(0, error.pos);
  return upToPos.split(/\r?\n/).length;
}
