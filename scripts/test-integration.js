import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lsp = resolve(process.env.LUNTE_LSP_REPO || join(root, '../lunte-lsp'))
const extension = resolve(process.env.VSCODE_LUNTE_REPO || join(root, '../vscode-lunte'))
const temporary = await mkdtemp(join(tmpdir(), 'lunte-integration-'))

function npm(cwd, args, env = {}) {
  execFileSync('npm', args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' })
}

function pack(cwd) {
  const [artifact] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd,
      encoding: 'utf8'
    })
  )
  return join(temporary, artifact.filename)
}

try {
  npm(root, ['test'])
  npm(root, ['run', 'test:package'])
  npm(lsp, ['test'])
  const artifacts = { LUNTE_TARBALL: pack(root), LUNTE_LSP_TARBALL: pack(lsp) }
  npm(lsp, ['run', 'test:package'], artifacts)
  npm(extension, ['test'], { ...artifacts, LUNTE_TEST_NPX: '' })
  npm(extension, ['test'], { ...artifacts, LUNTE_TEST_NPX: '1' })
} finally {
  await rm(temporary, { recursive: true, force: true })
}
