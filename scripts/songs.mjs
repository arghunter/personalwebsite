#!/usr/bin/env node
// Host pending songs from the secret dashboard using yt-dlp on this machine.
//
// Songs added from a YouTube link are "pending" (◌ in the player) until their
// audio is hosted. The worker tries to do that itself, but public YouTube
// download services break often. This script is the reliable path: it downloads
// each pending song with yt-dlp, uploads it to the worker (R2), and marks it ready.
//
//   npm run songs                 host every pending song
//   npm run songs -- --migrate    also re-host songs still on catbox.moe into R2
//   npm run songs -- --dry-run    list what would be done
//
// Needs yt-dlp on PATH and the worker credentials, either in the environment or
// in a .env.songs file at the repo root (gitignored):
//   SECRET_WORKER_URL=https://your-worker.workers.dev
//   SECRET_API_KEY=...
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = join(root, '.env.songs')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const WORKER = (process.env.SECRET_WORKER_URL || '').replace(/\/$/, '')
const KEY = process.env.SECRET_API_KEY || ''
const args = new Set(process.argv.slice(2))
const MIGRATE = args.has('--migrate')
const DRY = args.has('--dry-run')

if (!WORKER || !KEY) {
  console.error('Set SECRET_WORKER_URL and SECRET_API_KEY (in the environment or .env.songs).')
  process.exit(1)
}

async function api(path, opts = {}) {
  const res = await fetch(`${WORKER}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY, ...(opts.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function upload(buf, contentType, name) {
  const { url } = await api(`/api/upload?name=${encodeURIComponent(name)}`, {
    method: 'PUT', body: buf, headers: { 'Content-Type': contentType },
  })
  return url
}

function ytdlp(videoId, dir) {
  // Prefer m4a: plays everywhere (including iOS) and needs no ffmpeg re-encode.
  const r = spawnSync('yt-dlp', [
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist', '--quiet', '--no-warnings',
    '-o', join(dir, '%(id)s.%(ext)s'),
    `https://www.youtube.com/watch?v=${videoId}`,
  ], { stdio: ['ignore', 'inherit', 'inherit'] })
  if (r.error?.code === 'ENOENT') throw new Error('yt-dlp not found on PATH')
  if (r.status !== 0) throw new Error(`yt-dlp exited with ${r.status}`)
  const file = readdirSync(dir).find(f => f.startsWith(videoId + '.'))
  if (!file) throw new Error('yt-dlp produced no file')
  return join(dir, file)
}

const MIME = { m4a: 'audio/mp4', mp3: 'audio/mpeg', webm: 'audio/webm', opus: 'audio/ogg', ogg: 'audio/ogg' }

const playlists = await api('/api/playlists')
const tracks = playlists.flatMap(p => p.tracks.map(t => ({ ...t, playlist: p.name })))

// One job per YouTube video, even if it appears in several playlists.
const pending = new Map()
for (const t of tracks) if (t.id && !t.url && !pending.has(t.id)) pending.set(t.id, t)

const catbox = new Map()
if (MIGRATE) for (const t of tracks) if (t.url?.includes('catbox.moe') && !catbox.has(t.url)) catbox.set(t.url, t)

console.log(`${pending.size} pending song(s)` + (MIGRATE ? `, ${catbox.size} catbox file(s) to move` : ''))
if (DRY) {
  for (const t of pending.values()) console.log(`  pending  ${t.title} — ${t.artist}  (${t.playlist})`)
  for (const t of catbox.values()) console.log(`  catbox   ${t.title} — ${t.artist}`)
  process.exit(0)
}

let ok = 0, failed = 0

for (const [videoId, t] of pending) {
  const dir = mkdtempSync(join(tmpdir(), 'songs-'))
  try {
    process.stdout.write(`↓ ${t.title} — ${t.artist}\n`)
    const file = ytdlp(videoId, dir)
    const ext = file.split('.').pop()
    const url = await upload(readFileSync(file), MIME[ext] || 'application/octet-stream', `${t.title}.${ext}`)
    const { updated } = await api('/api/resolve', { method: 'POST', body: JSON.stringify({ videoId, url }) })
    console.log(`  ✓ hosted (${updated} track${updated === 1 ? '' : 's'} updated)`)
    ok++
  } catch (e) {
    console.log(`  ✗ ${e.message}`)
    failed++
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (MIGRATE && catbox.size) {
  // Rewrite every track URL in one PUT once all files are moved.
  const moved = new Map()
  for (const [oldUrl, t] of catbox) {
    try {
      process.stdout.write(`⇢ ${t.title}\n`)
      const res = await fetch(oldUrl)
      if (!res.ok) throw new Error(`catbox ${res.status}`)
      const ct = res.headers.get('content-type') || 'audio/mpeg'
      const newUrl = await upload(Buffer.from(await res.arrayBuffer()), ct, oldUrl.split('/').pop())
      if (!newUrl.includes('/song/')) throw new Error('worker has no R2 bucket bound (got a catbox url back)')
      moved.set(oldUrl, newUrl)
      ok++
    } catch (e) {
      console.log(`  ✗ ${e.message}`)
      failed++
      if (/R2/.test(e.message)) break
    }
  }
  if (moved.size) {
    const fresh = await api('/api/playlists')
    for (const pl of fresh) for (const tr of pl.tracks) if (moved.has(tr.url)) tr.url = moved.get(tr.url)
    await api('/api/playlists', { method: 'PUT', body: JSON.stringify(fresh) })
    console.log(`  ✓ moved ${moved.size} file(s) to R2`)
  }
}

console.log(`done: ${ok} ok, ${failed} failed`)
process.exit(failed ? 1 : 0)
