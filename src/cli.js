import { analyze } from './core/analyzer.js';
import { formatConsoleReport } from './core/reporter.js';

export async function run(argv = []) {
  const options = parseArguments(argv);

  if (options.showHelp) {
    printHelp();
    return 0;
  }

  // Placeholder: wire the analyzer once file reading is implemented.
  if (options.files.length === 0) {
    console.error('No input files specified.');
    return 1;
  }

  const result = await analyze({ files: options.files });
  const output = formatConsoleReport(result);
  console.log(output);

  const hasErrors = result.diagnostics.some((d) => d.severity === 'error');
  return hasErrors ? 1 : 0;
}

function parseArguments(argv) {
  const files = [];
  let showHelp = false;

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      showHelp = true;
    } else {
      files.push(arg);
    }
  }

  return { files, showHelp };
}

function printHelp() {
  console.log('Usage: lunte [options] <file ...>');
  console.log('  --help, -h    Show this usage information.');
}
