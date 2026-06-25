#!/usr/bin/env node
// Transforms Nitro's dist/ output into Vercel Build Output API v3 layout
// under .vercel/output/.
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.cwd())
const dist = join(root, 'dist')
const out = join(root, '.vercel', 'output')

if (!existsSync(dist)) {
  console.error('[vercel-postbuild] dist/ not found — did vite build run?')
  process.exit(1)
}

// Reset .vercel/output
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// 1. config.json
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/__server' },
      ],
    },
    null,
    2,
  ),
)

// 2. static assets — copy dist/client/* -> .vercel/output/static
const staticDir = join(out, 'static')
mkdirSync(staticDir, { recursive: true })
const clientDir = join(dist, 'client')
if (existsSync(clientDir)) {
  for (const entry of readdirSync(clientDir)) {
    cpSync(join(clientDir, entry), join(staticDir, entry), { recursive: true })
  }
} else {
  // Fallback: copy any non-server files at dist root
  for (const entry of readdirSync(dist)) {
    if (entry === 'server') continue
    cpSync(join(dist, entry), join(staticDir, entry), { recursive: true })
  }
}

// 3. server function — copy dist/server/* -> .vercel/output/functions/__server.func
const funcDir = join(out, 'functions', '__server.func')
mkdirSync(funcDir, { recursive: true })
const serverDir = join(dist, 'server')
if (!existsSync(serverDir)) {
  console.error('[vercel-postbuild] dist/server not found — Nitro vercel preset did not emit a server bundle')
  process.exit(1)
}
for (const entry of readdirSync(serverDir)) {
  cpSync(join(serverDir, entry), join(funcDir, entry), { recursive: true })
}

// Ensure the function has an index.mjs entry. Nitro vercel preset typically emits index.mjs.
if (!existsSync(join(funcDir, 'index.mjs'))) {
  // try common alternates
  const candidates = ['server.mjs', 'index.js']
  let chosen = null
  for (const c of candidates) {
    if (existsSync(join(funcDir, c))) { chosen = c; break }
  }
  if (chosen) {
    writeFileSync(join(funcDir, 'index.mjs'), `export { default } from './${chosen}'\n`)
  } else {
    console.warn('[vercel-postbuild] No index.mjs found in server bundle; deployment may fail.')
  }
}

// .vc-config.json
writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
)

console.log('[vercel-postbuild] .vercel/output ready')