import { createContentLoader, defineConfig, SiteConfig } from 'vitepress'
import { Feed } from 'feed'
import { writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path/posix";
import type { Plugin } from 'vite'

// ── Site graph Vite plugin ────────────────────────────────────────────────────

interface GraphNode { id: string; label: string; type: 'internal' | 'external'; url: string; domain?: string }
interface GraphEdge { from: string; to: string }

function* walkMd(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory() && !['node_modules', '.vitepress', 'cache', 'public'].includes(entry.name))
      yield* walkMd(full)
    else if (entry.name.endsWith('.md'))
      yield full
  }
}

const FRIENDLY: Record<string, string> = {
  'ext:github.com':           'GitHub',
  'ext:www.outercloud.dev':   'Outer Cloud',
  'ext:outercloud.dev':       'Outer Cloud',
  'ext:www.changchang.me':    'Kevin Chang',
  'ext:changchang.me':        'Kevin Chang',
  'ext:www.youtube.com':      'YouTube',
  'ext:youtube.com':          'YouTube',
  'ext:www.mit.edu':          'MIT',
  'ext:mit.edu':              'MIT',
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home', '/blog': 'Blog', '/projects': 'Projects',
  '/experience': 'Experience', '/contact': 'Contact', '/now': 'Now', '/graph': 'Graph',
}

function resolveHref(href: string, relSrc: string): GraphNode | null {
  const h = href.split('#')[0].trim()
  if (!h || h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('javascript:')) return null

  if (h.startsWith('http://') || h.startsWith('https://')) {
    try {
      const u = new URL(h)
      const { hostname } = u
      // GitHub repos get individual nodes keyed by owner/repo
      if (hostname === 'github.com') {
        const parts = u.pathname.split('/').filter(Boolean)
        if (parts.length >= 2) {
          const repo = `${parts[0]}/${parts[1]}`
          return { id: `ext:github.com/${repo}`, label: parts[1], type: 'external', url: h, domain: hostname }
        }
      }
      const id = `ext:${hostname}`
      return { id, label: FRIENDLY[id] ?? hostname, type: 'external', url: h, domain: hostname }
    } catch { return null }
  }

  let norm = h
  if (!norm.startsWith('/')) {
    const dir = relSrc.substring(0, relSrc.lastIndexOf('/'))
    const parts = `${dir}/${norm}`.split('/')
    const out: string[] = []
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p) }
    norm = out.join('/')
  }
  if (norm.endsWith('.md')) norm = norm.slice(0, -3)
  if (norm.endsWith('/index')) norm = norm.slice(0, -6)
  if (!norm.startsWith('/')) norm = '/' + norm
  return { id: norm, label: PAGE_LABELS[norm] ?? norm.split('/').pop() ?? norm, type: 'internal', url: norm }
}

function buildSiteGraph(srcRoot: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>()
  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  for (const file of walkMd(srcRoot)) {
    const content = readFileSync(file, 'utf-8')
    const relSrc = file.slice(srcRoot.length)
    let pageId = relSrc.replace(/\.md$/, '').replace(/\/index$/, '') || '/'
    if (!pageId.startsWith('/')) pageId = '/' + pageId

    if (!nodes.has(pageId)) {
      const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)
      const label = PAGE_LABELS[pageId] ?? titleMatch?.[1] ?? pageId.split('/').pop() ?? pageId
      nodes.set(pageId, { id: pageId, label, type: 'internal', url: pageId })
    }

    const patterns = [/\[[^\]]*\]\(([^)]+)\)/g, /[^:]href=["']([^"']+)["']/g]
    for (const pat of patterns) {
      let m
      while ((m = pat.exec(content)) !== null) {
        const target = resolveHref(m[1], relSrc)
        if (!target || target.id === pageId) continue
        if (!nodes.has(target.id)) nodes.set(target.id, target)
        const key = `${pageId}→${target.id}`
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ from: pageId, to: target.id }) }
      }
    }
  }

  // Ensure all known pages always exist even if not linked to
  for (const [id, label] of Object.entries(PAGE_LABELS)) {
    if (!nodes.has(id)) nodes.set(id, { id, label, type: 'internal', url: id })
  }

  return { nodes: [...nodes.values()], edges }
}

function siteGraphPlugin(): Plugin {
  const vid = 'virtual:site-graph', rid = '\0' + vid
  return {
    name: 'vitepress-site-graph',
    resolveId: (id) => id === vid ? rid : undefined,
    load(id) {
      if (id !== rid) return
      const graph = buildSiteGraph(`${process.cwd()}/src`)
      return `export default ${JSON.stringify(graph)}`
    },
  }
}

const hostname = 'https://arghunter.github.io'

export default defineConfig({
  title: "Armaan Gomes",
  description: 'Hi! I\'m Armaan Gomes. I like to build things.',
  srcDir: './src',
  head: [
    ['script', {}, `(function(){if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')})()`],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { 
      href: 'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Fira+Code:wght@300..700&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap',
      rel: 'stylesheet'
    }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'manifest', href: '/manifest.json' }],
    ['link', { rel: 'apple-touch-icon', href: '/agi-icon-512.png' }],
    ['meta', { name: 'theme-color', content: '#a78bfa' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }],
    ['meta', { name: 'apple-mobile-web-app-title', content: 'AGI' }]
  ],
  vite: { plugins: [siteGraphPlugin()] },
  cleanUrls: true,
  markdown: {
    config(md) {
        md.disable('emoji')
    },
    theme: {
      light: 'material-theme-darker',
      dark: 'material-theme-darker',
    }
  },
  buildEnd: async (config: SiteConfig) => {
    const feed = new Feed({
      title: 'Armaan Gomes',
      description: 'Welcome to my feed!',
      id: hostname,
      link: hostname,
      language: 'en',
      image: `${hostname}/favicon.png`,
      favicon: `${hostname}/favicon.png`,
    })

    const posts = await createContentLoader('blogs/*/index.md', {
      transform(rawData) {
        return rawData
          .sort((a, b) => {
            return +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date)
          })
          .filter(page => !page.frontmatter.hidden)
          .map(page => {
            return {
              title: page.frontmatter.title,
              description: page.frontmatter.longDescription ?? page.frontmatter.description,
              date: page.frontmatter.date,
              url: page.url,
            }
          })
      },
    }).load()
  
    for (const { url, description, title, date } of posts) {
      feed.addItem({
        title: title,
        id: `${hostname}${url}`,
        link: `${hostname}${url}`,
        description: description,
        date: new Date(date)
      })
    }
  
    writeFileSync(path.join(config.outDir, 'rss.xml'), feed.rss2())
  }
})
