#!/usr/bin/env node

import process from 'process'
import { rm, mkdir, rename, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { execFile } from 'child_process'

const execFileAsync = promisify(execFile)
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

async function main() {
  const versionArg = process.argv.slice(2).find((arg) => !arg.startsWith('-'))
  const spec = versionArg
    ? `@sveltejs/acorn-typescript@${versionArg}`
    : '@sveltejs/acorn-typescript'

  console.log(`Vendoring ${spec}...`)

  const vendorDir = join(projectRoot, 'vendor')
  await mkdir(vendorDir, { recursive: true })

  const { stdout } = await execFileAsync('npm', ['pack', spec, '--silent'], {
    cwd: projectRoot
  })
  const tarballName = stdout.trim().split('\n').pop().trim()
  const tarballPath = join(projectRoot, tarballName)

  await execFileAsync('tar', ['-xzf', tarballPath, '-C', vendorDir], {
    cwd: projectRoot
  })

  const targetDir = join(vendorDir, 'acorn-typescript')
  await rm(targetDir, { recursive: true, force: true })
  await rename(join(vendorDir, 'package'), targetDir)
  await rm(tarballPath, { force: true })

  await patchImports(join(targetDir, 'index.js'), '../acorn/dist/acorn.mjs')
  await patchImports(join(targetDir, 'index.d.ts'), '../acorn/dist/acorn.d.mts')
  await patchSource(join(targetDir, 'index.js'), SOURCE_PATCHES)

  console.log(`Vendored @sveltejs/acorn-typescript from ${tarballName}`)
}

async function patchImports(filePath, newSpecifier) {
  try {
    const original = await readFile(filePath, 'utf8')
    const updated = original.replace(/from\s+['"]acorn['"];?/g, (match) =>
      match.replace(/['"]acorn['"]/, `"${newSpecifier}"`)
    )
    if (updated === original) {
      console.warn(`No acorn import found in ${filePath}; manual update may be required.`)
    } else {
      await writeFile(filePath, updated, 'utf8')
    }
  } catch (error) {
    console.warn(`Failed to patch ${filePath}: ${error.message}`)
  }
}

const SOURCE_PATCHES = [
  {
    name: 'typed default parameter loc.start',
    search: 'this.parseMaybeDefault(left["start"], left["loc"], left)',
    replace: 'this.parseMaybeDefault(left["start"], left["loc"] && left["loc"].start, left)',
    fixed: 'left["loc"].start, left)'
  }
]

async function patchSource(filePath, patches) {
  try {
    let source = await readFile(filePath, 'utf8')
    for (const patch of patches) {
      if (source.includes(patch.search)) {
        source = source.replace(patch.search, patch.replace)
      } else if (!source.includes(patch.fixed)) {
        console.warn(`Patch "${patch.name}" did not apply to ${filePath}; manual update may be required.`)
      }
    }
    await writeFile(filePath, source, 'utf8')
  } catch (error) {
    console.warn(`Failed to patch ${filePath}: ${error.message}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
