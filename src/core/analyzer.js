import { parse } from './parser.js';

export async function analyze({ files }) {
  for (const file of files) {
    await analyzeFile(file);
  }
}

async function analyzeFile(filePath) {
  // Placeholder: real implementation will read file contents and run rules.
  const source = await readFileText(filePath);
  parse(source, { sourceFile: filePath });
}

async function readFileText(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}
