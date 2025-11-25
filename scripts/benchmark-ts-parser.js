#!/usr/bin/env node

/**
 * Benchmarks the linter with and without the TypeScript parser forced for JS/JSX.
 *
 * By default it:
 * - samples 10 random sibling projects (directories with a package.json one level above the repo)
 * - runs each scenario ITERATIONS times (set ITERATIONS env, default 2)
 *
 * The script prints a summary table with average timings and overhead.
 */

const { readdir, access } = require('fs/promises')
const { spawn } = require('child_process')
const { join, resolve } = require('path')

const ITERATIONS = parseInt(process.env.ITERATIONS || '2', 10)
const SAMPLE_SIZE = parseInt(process.env.SAMPLE_SIZE || '10', 10)
const SEED = parseInt(process.env.SEED || '1337', 10)

const repoRoot = resolve(__dirname, '..')
const parentDir = resolve(repoRoot, '..')
const lunteBin = resolve(repoRoot, 'packages/lunte/bin/lunte')

function seededShuffle(array, seed) {
  const result = [...array]
  let state = seed >>> 0
  const rand = () => {
    state = (1664525 * state + 1013904223) % 0xffffffff
    return state / 0xffffffff
  }
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

async function findCandidateProjects() {
  const entries = await readdir(parentDir, { withFileTypes: true })
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(parentDir, entry.name)
    if (entry.name === 'lunte') continue // skip the current repo
    try {
      await access(join(dir, 'package.json'))
      candidates.push(dir)
    } catch {
      /* ignore */
    }
  }
  return candidates
}

function sampleProjects(candidates) {
  if (candidates.length === 0) {
    throw new Error('No candidate projects with package.json found in parent directory')
  }
  const shuffled = seededShuffle(candidates, SEED)
  return shuffled.slice(0, Math.min(SAMPLE_SIZE, shuffled.length))
}

function formatMs(value) {
  return value.toFixed(1).padStart(8)
}

function formatPct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1).padStart(5)}%`
}

function runCommand(cmd, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint()
    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6
      resolve({ code, durationMs, stderr })
    })
  })
}

async function benchmarkProject(dir) {
  const baseline = []
  const forced = []

  for (let i = 0; i < ITERATIONS; i += 1) {
    baseline.push(await runCommand('node', [lunteBin, '--typescript', '.'], { cwd: dir }))
    forced.push(await runCommand('node', [lunteBin, '.'], { cwd: dir, env: { ...process.env, LUNTE_FORCE_TS_PARSER: '1' } }))
  }

  const average = (runs) => runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length

  return {
    dir,
    baseline,
    forced,
    avgBaseline: average(baseline),
    avgForced: average(forced)
  }
}

async function main() {
  const candidates = await findCandidateProjects()
  const projects = sampleProjects(candidates)

  console.log(`Found ${candidates.length} candidate projects; sampling ${projects.length}.`)
  console.log(`ITERATIONS=${ITERATIONS}, SAMPLE_SIZE=${SAMPLE_SIZE}, SEED=${SEED}\n`)

  const results = []
  for (const dir of projects) {
    console.log(`Benchmarking ${dir}...`)
    const result = await benchmarkProject(dir)
    results.push(result)
    for (const [label, runs] of [
      ['baseline (--typescript)', result.baseline],
      ['forced   (LUNTE_FORCE_TS_PARSER=1)', result.forced]
    ]) {
      const codes = runs.map((r) => r.code).join(', ')
      const durations = runs.map((r) => `${r.durationMs.toFixed(1)}ms`).join(', ')
      console.log(`  ${label}: codes [${codes}] times [${durations}]`)
      const failed = runs.find((r) => r.code !== 0)
      if (failed && failed.stderr) {
        console.log(`    stderr (first failure): ${failed.stderr.slice(0, 500).trimEnd()}`)
      }
    }
  }

  console.log('\nSummary (averages)')
  console.log('project'.padEnd(28), 'base ms', 'forced ms', 'diff ms', 'overhead')
  for (const r of results) {
    const diff = r.avgForced - r.avgBaseline
    const overhead = (diff / r.avgBaseline) * 100
    const label = r.dir.split('/').pop()
    console.log(
      label.padEnd(28),
      formatMs(r.avgBaseline),
      formatMs(r.avgForced),
      formatMs(diff),
      formatPct(overhead)
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
