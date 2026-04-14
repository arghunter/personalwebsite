<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'
import { marked } from 'marked'
import SecretPlayer from './SecretPlayer.vue'

const router = useRouter()

// ── Auth ───────────────────────────────────────────────────────────────────────
const ready      = ref(false)
const showSetup  = ref(false)
const workerUrl  = ref('')
const apiKey     = ref('')
const setupErr   = ref('')
const setupBusy  = ref(false)

// ── Mobile tabs ────────────────────────────────────────────────────────────────
type Tab = 'music' | 'notes' | 'ideas' | 'later' | 'sleep' | 'feeds' | 'ama' | 'projects'
const tab  = ref<Tab>('music')
const tabs = [
  { id: 'music'    as Tab, icon: '♪', label: 'music' },
  { id: 'notes'    as Tab, icon: '✎', label: 'notes' },
  { id: 'projects' as Tab, icon: '◈', label: 'projects' },
  { id: 'ideas'    as Tab, icon: '✦', label: 'ideas' },
  { id: 'later'    as Tab, icon: '○', label: 'later' },
  { id: 'sleep'    as Tab, icon: '◑', label: 'sleep' },
  { id: 'feeds'    as Tab, icon: '⊞', label: 'feeds' },
  { id: 'ama'      as Tab, icon: '?', label: 'ama' },
]

// ── Notes ──────────────────────────────────────────────────────────────────────
interface NoteItem { id: string; title: string; body: string; createdAt: string; updatedAt: string }
const notes         = ref<NoteItem[]>([])
const activeNote    = ref<NoteItem | null>(null)
const editTitle     = ref('')
const editBody      = ref('')
const editorOpen    = ref(false)
const noteView      = ref<'edit' | 'split' | 'preview'>('edit')
const noteDirty     = ref(false)
const noteSaveBusy  = ref(false)
const noteErr       = ref('')
const mobileNoteView = ref<'list' | 'editor'>('list')
const mobilePreview  = ref(false)
const noteSearch     = ref('')
let lastFocused: HTMLTextAreaElement | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

// ── Ideas + voice ──────────────────────────────────────────────────────────────
interface IdeaItem { id: string; text: string; createdAt: string }
const ideas       = ref<IdeaItem[]>([])
const ideaText    = ref('')
const ideaBusy    = ref(false)
const ideaErr     = ref('')
const interimText = ref('')
const isListening = ref(false)
const voiceErr    = ref('')
let recognition: any = null

function setupRecognition() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) { voiceErr.value = 'speech recognition not supported in this browser'; return null }
  const r = new SR()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-US'
  r.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) {
        ideaText.value += (ideaText.value && !ideaText.value.endsWith(' ') ? ' ' : '') + t
      } else { interim += t }
    }
    interimText.value = interim
  }
  r.onend = () => { isListening.value = false; interimText.value = '' }
  r.onerror = (e: any) => {
    if (e.error !== 'aborted') voiceErr.value = `mic error: ${e.error}`
    isListening.value = false; interimText.value = ''
  }
  return r
}

function toggleVoice() {
  voiceErr.value = ''
  if (isListening.value) {
    recognition?.stop(); isListening.value = false; interimText.value = ''
  } else {
    if (!recognition) recognition = setupRecognition()
    if (!recognition) return
    try { recognition.start(); isListening.value = true }
    catch { voiceErr.value = 'could not start mic — try again' }
  }
}

// ── Read later ─────────────────────────────────────────────────────────────────
interface LaterItem { id: string; url: string; title: string; addedAt: string; read: boolean }
const laterItems = ref<LaterItem[]>([])
const laterUrl   = ref('')
const laterBusy  = ref(false)
const laterErr   = ref('')

// ── Sleep ──────────────────────────────────────────────────────────────────────
interface SleepEntry { id: string; type: 'sleep' | 'wake'; ts: string }
const sleepLog  = ref<SleepEntry[]>([])
const sleepBusy = ref(false)
const sleepErr  = ref('')

// ── Feeds ──────────────────────────────────────────────────────────────────────
interface FeedSource { id: string; url: string; title: string; addedAt: string }
interface FeedItem { title: string; link: string; summary: string; pubDate: string }
const feeds              = ref<FeedSource[]>([])
const feedItems          = ref<Record<string, FeedItem[]>>({})
const activeFeedId       = ref<string>('')
const feedLoading        = ref<Record<string, boolean>>({})
const newFeedUrl         = ref('')
const newFeedBusy        = ref(false)
const feedErr            = ref('')
const editingFeedId      = ref('')
const editingFeedTitle   = ref('')
let readSet              = new Set<string>()
const mobileFeedView     = ref<'list' | 'articles'>('list')
const feedUnreadOnly     = ref(false)
const feedSearch         = ref('')
const focusedArticleIndex = ref(-1)
const feedSavedLinks     = ref<Set<string>>(new Set())
let feedAutoRefreshTimer: ReturnType<typeof setInterval> | null = null

// ── Projects ───────────────────────────────────────────────────────────────────
type ProjectStatus = 'active' | 'paused' | 'done' | 'idea'
interface ProjectLink  { id: string; url: string }
interface ProjectItem  { id: string; name: string; status: ProjectStatus; description: string; nextStep: string; links: ProjectLink[]; createdAt: string; updatedAt: string }
const projects          = ref<ProjectItem[]>([])
const activeProject     = ref<ProjectItem | null>(null)
const projectFilter     = ref<ProjectStatus | 'all'>('all')
const projectSearch     = ref('')
const projectEditName   = ref('')
const projectEditStatus = ref<ProjectStatus>('active')
const projectEditDesc   = ref('')
const projectEditNext   = ref('')
const projectEditLinks  = ref<ProjectLink[]>([])
const projectLinkInput  = ref('')
const projectLinkBusy   = ref(false)
const projectDirty      = ref(false)
const projectSaveBusy   = ref(false)
const projectErr        = ref('')
const newProjectName    = ref('')
const newProjectBusy    = ref(false)
const mobileProjectView = ref<'list' | 'detail'>('list')
let projectSaveTimer: ReturnType<typeof setTimeout> | null = null

// ── AMA ────────────────────────────────────────────────────────────────────────
interface AMAItem { id: string; question: string; name: string; answer: string; answered: boolean; askedAt: string; answeredAt: string }
const amaItems   = ref<AMAItem[]>([])
const amaAnswers = ref<Record<string, string>>({})
const amaBusy    = ref<Record<string, boolean>>({})
const amaErr     = ref('')

// ── API ────────────────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${workerUrl.value}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.value, ...(opts.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Setup ──────────────────────────────────────────────────────────────────────
async function testAndSave() {
  setupBusy.value = true; setupErr.value = ''
  try {
    const url = workerUrl.value.trim().replace(/\/$/, '')
    const res = await fetch(`${url}/api/notes`, { headers: { 'X-API-Key': apiKey.value.trim() } })
    if (!res.ok) throw new Error(`${res.status}`)
    localStorage.setItem('sd_w', url); localStorage.setItem('sd_k', apiKey.value.trim())
    workerUrl.value = url; apiKey.value = apiKey.value.trim()
    showSetup.value = false; ready.value = true
    loadAll()
  } catch (e: any) {
    setupErr.value = e.message === '401' ? 'wrong api key' : `could not reach worker (${e.message})`
  }
  setupBusy.value = false
}

// ── Data loaders ───────────────────────────────────────────────────────────────
async function loadNotes() {
  try {
    const raw = await apiFetch('/api/notes')
    notes.value = raw.map((n: any) => ({
      id: n.id,
      title: n.title ?? (n.text?.split('\n')[0]?.slice(0, 60) ?? 'untitled'),
      body: n.body ?? n.text ?? '',
      createdAt: n.createdAt,
      updatedAt: n.updatedAt ?? n.createdAt,
    }))
  } catch {}
}
async function loadIdeas() { try { ideas.value = await apiFetch('/api/ideas') } catch {} }
async function loadLater() { try { laterItems.value = await apiFetch('/api/readlater') } catch {} }
async function loadSleep() { try { sleepLog.value = await apiFetch('/api/sleep') } catch {} }
async function loadFeeds() {
  try { feeds.value = await apiFetch('/api/feeds') } catch {}
}
async function loadAma() {
  try { amaItems.value = await apiFetch('/api/ama') } catch {}
}
async function loadProjects() {
  try { projects.value = await apiFetch('/api/projects') } catch {}
}
function loadAll() { loadNotes(); loadIdeas(); loadLater(); loadSleep(); loadFeeds(); loadAma(); loadProjects(); startFeedAutoRefresh() }

const mobileLoaded = ref<Record<Tab, boolean>>({ music: true, notes: false, ideas: false, later: false, sleep: false, feeds: false, ama: false, projects: false })
async function switchTab(t: Tab) {
  const prev = tab.value
  tab.value = t
  if (prev === 'feeds' && t !== 'feeds') {
    stopFeedAutoRefresh()
    document.removeEventListener('keydown', onFeedKeydown)
  }
  if (t === 'feeds' && prev !== 'feeds') {
    startFeedAutoRefresh()
    document.addEventListener('keydown', onFeedKeydown)
  }
  if (mobileLoaded.value[t]) return
  mobileLoaded.value[t] = true
  if (t === 'notes') await loadNotes()
  else if (t === 'ideas') await loadIdeas()
  else if (t === 'later') await loadLater()
  else if (t === 'sleep') await loadSleep()
  else if (t === 'feeds') await loadFeeds()
  else if (t === 'ama') await loadAma()
  else if (t === 'projects') await loadProjects()
}

// ── AMA CRUD ───────────────────────────────────────────────────────────────────
async function answerAma(id: string) {
  const answer = amaAnswers.value[id]?.trim()
  if (!answer) return
  amaBusy.value = { ...amaBusy.value, [id]: true }
  try {
    await apiFetch(`/api/ama/${id}`, { method: 'PATCH', body: JSON.stringify({ answer }) })
    const idx = amaItems.value.findIndex(i => i.id === id)
    if (idx >= 0) amaItems.value[idx] = { ...amaItems.value[idx], answer, answered: true, answeredAt: new Date().toISOString() }
  } catch (e: any) { amaErr.value = e.message }
  amaBusy.value = { ...amaBusy.value, [id]: false }
}

async function deleteAma(id: string) {
  try {
    await apiFetch(`/api/ama/${id}`, { method: 'DELETE' })
    amaItems.value = amaItems.value.filter(i => i.id !== id)
  } catch {}
}

function amaDate(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Projects CRUD ──────────────────────────────────────────────────────────────
const filteredProjects = computed(() => {
  let list = projectFilter.value === 'all' ? projects.value : projects.value.filter(p => p.status === projectFilter.value)
  const q = projectSearch.value.trim().toLowerCase()
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.nextStep.toLowerCase().includes(q))
  return list
})

const projectStatusCounts = computed(() => {
  const c: Record<string, number> = { all: projects.value.length }
  for (const s of STATUS_ORDER) c[s] = projects.value.filter(p => p.status === s).length
  return c
})

function isStale(p: ProjectItem) {
  if (p.status === 'done') return false
  return Date.now() - new Date(p.updatedAt || p.createdAt).getTime() > 14 * 86400 * 1000
}

function openProject(p: ProjectItem) {
  if (projectSaveTimer) clearTimeout(projectSaveTimer)
  if (projectDirty.value) saveProject()
  activeProject.value = p
  projectEditName.value = p.name
  projectEditStatus.value = p.status
  projectEditDesc.value = p.description
  projectEditNext.value = p.nextStep
  projectEditLinks.value = [...(p.links || [])]
  projectDirty.value = false
  mobileProjectView.value = 'detail'
}

function scheduleProjectSave() {
  projectDirty.value = true
  if (projectSaveTimer) clearTimeout(projectSaveTimer)
  projectSaveTimer = setTimeout(() => { if (projectDirty.value) saveProject() }, 1800)
}

async function saveProject() {
  if (!activeProject.value) return
  if (projectSaveTimer) clearTimeout(projectSaveTimer)
  projectSaveBusy.value = true
  try {
    const patch = { name: projectEditName.value.trim() || activeProject.value.name, status: projectEditStatus.value, description: projectEditDesc.value, nextStep: projectEditNext.value }
    await apiFetch(`/api/projects/${activeProject.value.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    const updated = { ...activeProject.value, ...patch, updatedAt: new Date().toISOString() }
    activeProject.value = updated
    const idx = projects.value.findIndex(p => p.id === updated.id)
    if (idx >= 0) projects.value[idx] = updated
    projectDirty.value = false
  } catch (e: any) { projectErr.value = e.message }
  projectSaveBusy.value = false
}

async function addProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  newProjectBusy.value = true; projectErr.value = ''
  try {
    const item = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name, status: 'active' }) })
    projects.value.unshift(item)
    newProjectName.value = ''
    openProject(item)
  } catch (e: any) { projectErr.value = e.message }
  newProjectBusy.value = false
}

async function deleteProject(id: string) {
  try {
    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== id)
    if (activeProject.value?.id === id) {
      activeProject.value = null; projectDirty.value = false
      mobileProjectView.value = 'list'
    }
  } catch {}
}

const STATUS_LABELS: Record<string, string> = { active: 'active', paused: 'paused', done: 'done', idea: 'idea' }
const STATUS_ORDER: ProjectStatus[] = ['active', 'paused', 'idea', 'done']

async function cycleStatus(p: ProjectItem, e: Event) {
  e.stopPropagation()
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(p.status) + 1) % STATUS_ORDER.length]
  try {
    await apiFetch(`/api/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
    p.status = next
    if (activeProject.value?.id === p.id) { projectEditStatus.value = next }
    const idx = projects.value.findIndex(x => x.id === p.id)
    if (idx >= 0) projects.value[idx] = { ...projects.value[idx], status: next, updatedAt: new Date().toISOString() }
  } catch {}
}

async function addProjectLink() {
  const url = projectLinkInput.value.trim()
  if (!url || !activeProject.value) return
  projectLinkBusy.value = true
  const link: ProjectLink = { id: Math.random().toString(36).slice(2, 10), url }
  const links = [...projectEditLinks.value, link]
  try {
    await apiFetch(`/api/projects/${activeProject.value.id}`, { method: 'PATCH', body: JSON.stringify({ links }) })
    projectEditLinks.value = links
    activeProject.value = { ...activeProject.value, links }
    const idx = projects.value.findIndex(p => p.id === activeProject.value!.id)
    if (idx >= 0) projects.value[idx] = { ...projects.value[idx], links }
    projectLinkInput.value = ''
  } catch {}
  projectLinkBusy.value = false
}

async function removeProjectLink(linkId: string) {
  if (!activeProject.value) return
  const links = projectEditLinks.value.filter(l => l.id !== linkId)
  try {
    await apiFetch(`/api/projects/${activeProject.value.id}`, { method: 'PATCH', body: JSON.stringify({ links }) })
    projectEditLinks.value = links
    activeProject.value = { ...activeProject.value, links }
    const idx = projects.value.findIndex(p => p.id === activeProject.value!.id)
    if (idx >= 0) projects.value[idx] = { ...projects.value[idx], links }
  } catch {}
}

function openProjectPage(p: ProjectItem, e?: Event) {
  e?.stopPropagation()
  if (projectDirty.value) saveProject()
  localStorage.setItem('sd_active_proj', p.id)
  router.go('/project')
}

function linkHostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// ── Feeds CRUD ─────────────────────────────────────────────────────────────────
function loadReadSet() {
  try { const raw = localStorage.getItem('sd_read'); if (raw) readSet = new Set(JSON.parse(raw)) } catch {}
}
function saveReadSet() {
  try { localStorage.setItem('sd_read', JSON.stringify([...readSet])) } catch {}
}
function isRead(link: string) { return readSet.has(link) }
function markRead(link: string) { readSet.add(link); saveReadSet() }
function unreadCount(feedId: string) {
  if (feedId === '__all__') {
    return feeds.value.reduce((sum, f) => {
      const items = feedItems.value[f.id]
      return sum + (items ? items.filter(i => i.link && !isRead(i.link)).length : 0)
    }, 0)
  }
  const items = feedItems.value[feedId]
  if (!items) return 0
  return items.filter(i => i.link && !isRead(i.link)).length
}

const allFeedItems = computed<FeedItem[]>(() => {
  const all: FeedItem[] = []
  for (const f of feeds.value) {
    const items = feedItems.value[f.id]
    if (items) all.push(...items)
  }
  return [...all].sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return db - da
  })
})

const activeArticles = computed<FeedItem[]>(() => {
  let items: FeedItem[]
  if (activeFeedId.value === '__all__') {
    items = allFeedItems.value
  } else {
    items = feedItems.value[activeFeedId.value] ?? []
  }
  if (feedUnreadOnly.value) items = items.filter(i => !isRead(i.link))
  if (feedSearch.value.trim()) {
    const q = feedSearch.value.trim().toLowerCase()
    items = items.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q)
    )
  }
  return items
})

async function selectFeed(feedId: string) {
  activeFeedId.value = feedId
  focusedArticleIndex.value = -1
  mobileFeedView.value = 'articles'
  if (feedId === '__all__') return
  if (feedItems.value[feedId]) return
  feedLoading.value = { ...feedLoading.value, [feedId]: true }
  try {
    feedItems.value = { ...feedItems.value, [feedId]: await apiFetch(`/api/feeds/${feedId}/items`) }
  } catch {}
  feedLoading.value = { ...feedLoading.value, [feedId]: false }
}

async function refreshFeed(feedId: string) {
  if (feedId === '__all__') {
    const ids = feeds.value.map(f => f.id)
    for (const id of ids) {
      const copy = { ...feedItems.value }; delete copy[id]; feedItems.value = copy
      feedLoading.value = { ...feedLoading.value, [id]: true }
      try {
        feedItems.value = { ...feedItems.value, [id]: await apiFetch(`/api/feeds/${id}/items`) }
      } catch {}
      feedLoading.value = { ...feedLoading.value, [id]: false }
    }
    return
  }
  const copy = { ...feedItems.value }; delete copy[feedId]; feedItems.value = copy
  feedLoading.value = { ...feedLoading.value, [feedId]: true }
  try {
    feedItems.value = { ...feedItems.value, [feedId]: await apiFetch(`/api/feeds/${feedId}/items`) }
  } catch {}
  feedLoading.value = { ...feedLoading.value, [feedId]: false }
}

async function autoRefreshLoadedFeeds() {
  const ids = feeds.value.filter(f => feedItems.value[f.id]).map(f => f.id)
  for (const id of ids) {
    const copy = { ...feedItems.value }; delete copy[id]; feedItems.value = copy
    try {
      feedItems.value = { ...feedItems.value, [id]: await apiFetch(`/api/feeds/${id}/items`) }
    } catch {}
  }
}

function startFeedAutoRefresh() {
  stopFeedAutoRefresh()
  feedAutoRefreshTimer = setInterval(() => { autoRefreshLoadedFeeds() }, 5 * 60 * 1000)
}

function stopFeedAutoRefresh() {
  if (feedAutoRefreshTimer) { clearInterval(feedAutoRefreshTimer); feedAutoRefreshTimer = null }
}

function markAllRead() {
  for (const item of activeArticles.value) {
    if (item.link) markRead(item.link)
  }
}

async function saveToReadLater(item: FeedItem) {
  try {
    const saved = await apiFetch('/api/readlater', { method: 'POST', body: JSON.stringify({ url: item.link, title: item.title }) })
    if (saved) laterItems.value.unshift(saved)
    feedSavedLinks.value = new Set([...feedSavedLinks.value, item.link])
    setTimeout(() => {
      feedSavedLinks.value = new Set([...feedSavedLinks.value].filter(l => l !== item.link))
    }, 2000)
  } catch {}
}

function onFeedKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const items = activeArticles.value
  if (!items.length) return
  if (e.key === 'j') {
    e.preventDefault()
    focusedArticleIndex.value = Math.min(focusedArticleIndex.value + 1, items.length - 1)
  } else if (e.key === 'k') {
    e.preventDefault()
    focusedArticleIndex.value = Math.max(focusedArticleIndex.value - 1, 0)
  } else if (e.key === 'o' || e.key === 'Enter') {
    const item = items[focusedArticleIndex.value]
    if (item?.link) { window.open(item.link, '_blank', 'noopener'); markRead(item.link) }
  } else if (e.key === 'm') {
    const item = items[focusedArticleIndex.value]
    if (item?.link) markRead(item.link)
  } else if (e.key === 'r') {
    if (activeFeedId.value) refreshFeed(activeFeedId.value)
  }
}

async function addFeed() {
  const url = newFeedUrl.value.trim()
  if (!url) return
  newFeedBusy.value = true; feedErr.value = ''
  try {
    const item = await apiFetch('/api/feeds', { method: 'POST', body: JSON.stringify({ url }) })
    feeds.value.push(item)
    newFeedUrl.value = ''
  } catch (e: any) { feedErr.value = e.message }
  newFeedBusy.value = false
}

function startEditFeed(f: FeedSource, e: Event) {
  e.stopPropagation()
  editingFeedId.value = f.id
  editingFeedTitle.value = f.title
  nextTick(() => (document.getElementById('feed-rename-' + f.id) as HTMLInputElement)?.select())
}

async function commitRenameFeed(f: FeedSource) {
  const title = editingFeedTitle.value.trim()
  editingFeedId.value = ''
  if (!title || title === f.title) return
  try {
    await apiFetch(`/api/feeds/${f.id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    f.title = title
  } catch {}
}

function cancelRenameFeed() { editingFeedId.value = '' }

async function deleteFeed(id: string) {
  try {
    await apiFetch(`/api/feeds/${id}`, { method: 'DELETE' })
    feeds.value = feeds.value.filter(f => f.id !== id)
    if (activeFeedId.value === id) activeFeedId.value = ''
    const copy = { ...feedItems.value }; delete copy[id]; feedItems.value = copy
  } catch {}
}

function feedItemDate(pubDate: string) {
  if (!pubDate) return ''
  const d = new Date(pubDate)
  if (isNaN(d.getTime())) return pubDate
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// ── Notes editor ───────────────────────────────────────────────────────────────
const renderedBody = computed(() => {
  if (!editBody.value.trim()) return '<p style="opacity:0.35; font-style:italic; margin:0;">nothing here yet…</p>'
  return marked.parse(editBody.value, { breaks: true, gfm: true } as any) as string
})

function stripMd(text: string) {
  return (text || '').replace(/[#*`_~\[\]()>!]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Fuzzy search ───────────────────────────────────────────────────────────────
function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase(), n = needle.toLowerCase()
  const sub = h.indexOf(n)
  if (sub >= 0) return 200 - sub  // exact substring wins, earlier = better
  let hi = 0, score = 0, run = 0
  for (let ni = 0; ni < n.length; ni++) {
    let found = false
    while (hi < h.length) {
      if (h[hi++] === n[ni]) { score += 1 + run * 3; run++; found = true; break }
      run = 0
    }
    if (!found) return 0
  }
  return score
}

const filteredNotes = computed(() => {
  const q = noteSearch.value.trim()
  if (!q) return notes.value
  return notes.value
    .map(n => ({ n, s: Math.max(fuzzyScore(n.title, q) * 2, fuzzyScore(n.body, q)) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({ n }) => n)
})

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function highlightFuzzy(text: string, query: string): string {
  if (!query.trim()) return esc(text)
  const h = text.toLowerCase(), n = query.toLowerCase()
  const sub = h.indexOf(n)
  if (sub >= 0) {
    return esc(text.slice(0, sub)) +
      `<mark>${esc(text.slice(sub, sub + n.length))}</mark>` +
      esc(text.slice(sub + n.length))
  }
  let result = '', hi = 0
  for (let ni = 0; ni < n.length; ni++) {
    while (hi < text.length && text[hi].toLowerCase() !== n[ni]) result += esc(text[hi++])
    if (hi < text.length) { result += `<mark>${esc(text[hi++])}</mark>` }
  }
  result += esc(text.slice(hi))
  return result
}

function scheduleAutoSave() {
  noteDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { if (noteDirty.value) saveNote() }, 1800)
}

function openNote(note: NoteItem) {
  if (saveTimer) clearTimeout(saveTimer)
  if (noteDirty.value) saveNote()
  activeNote.value = note
  editTitle.value = note.title
  editBody.value = note.body
  noteDirty.value = false
  editorOpen.value = true
  mobileNoteView.value = 'editor'
  mobilePreview.value = false
  nextTick(() => {
    const el = document.querySelector<HTMLTextAreaElement>('.sd-md-editor')
    if (el) { lastFocused = el }
  })
}

function newNote() {
  if (saveTimer) clearTimeout(saveTimer)
  if (noteDirty.value) saveNote()
  activeNote.value = null
  editTitle.value = ''
  editBody.value = ''
  noteDirty.value = false
  editorOpen.value = true
  mobileNoteView.value = 'editor'
  mobilePreview.value = false
  nextTick(() => {
    const el = document.querySelector<HTMLTextAreaElement>('.sd-md-editor')
    if (el) { el.focus(); lastFocused = el }
  })
}

async function saveNote() {
  const title = editTitle.value.trim() || 'untitled'
  const body = editBody.value
  if (!title && !body.trim() && !activeNote.value) return
  if (saveTimer) clearTimeout(saveTimer)
  noteSaveBusy.value = true; noteErr.value = ''
  try {
    if (activeNote.value?.id) {
      await apiFetch(`/api/notes/${activeNote.value.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, body }),
      })
      const updated = { ...activeNote.value, title, body, updatedAt: new Date().toISOString() }
      activeNote.value = updated
      const idx = notes.value.findIndex(n => n.id === updated.id)
      if (idx >= 0) notes.value[idx] = updated
    } else {
      const item = await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ title, body }) })
      notes.value.unshift(item)
      activeNote.value = item
    }
    noteDirty.value = false
  } catch (e: any) { noteErr.value = e.message }
  noteSaveBusy.value = false
}

async function delNote(id: string) {
  try {
    await apiFetch(`/api/notes/${id}`, { method: 'DELETE' })
    notes.value = notes.value.filter(n => n.id !== id)
    if (activeNote.value?.id === id) {
      activeNote.value = null; editorOpen.value = false
      editTitle.value = ''; editBody.value = ''; noteDirty.value = false
    }
  } catch {}
}

async function delNoteAndBack(id: string) {
  await delNote(id)
  mobileNoteView.value = 'list'
}

function backFromEditor() {
  if (noteDirty.value) saveNote()
  mobileNoteView.value = 'list'
}

function insertMd(before: string, after = '') {
  const el = lastFocused
  if (!el) return
  const s = el.selectionStart, e = el.selectionEnd
  editBody.value = editBody.value.slice(0, s) + before + editBody.value.slice(s, e) + after + editBody.value.slice(e)
  scheduleAutoSave()
  nextTick(() => { el.focus(); el.setSelectionRange(s + before.length, e + before.length) })
}

function insertLine(prefix: string) {
  const el = lastFocused
  if (!el) return
  const s = el.selectionStart
  const lineStart = editBody.value.lastIndexOf('\n', s - 1) + 1
  editBody.value = editBody.value.slice(0, lineStart) + prefix + editBody.value.slice(lineStart)
  scheduleAutoSave()
  nextTick(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length) })
}

// ── Ideas CRUD ─────────────────────────────────────────────────────────────────
async function addIdea() {
  const text = ideaText.value.trim() || interimText.value.trim()
  if (!text) return
  recognition?.stop(); isListening.value = false; interimText.value = ''
  ideaBusy.value = true; ideaErr.value = ''
  try {
    const item = await apiFetch('/api/ideas', { method: 'POST', body: JSON.stringify({ text }) })
    ideas.value.unshift(item); ideaText.value = ''
  } catch (e: any) { ideaErr.value = e.message }
  ideaBusy.value = false
}

async function delIdea(id: string) {
  try { await apiFetch(`/api/ideas/${id}`, { method: 'DELETE' }); ideas.value = ideas.value.filter(i => i.id !== id) } catch {}
}

function noteDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

function noteShortDate(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// ── Read later ─────────────────────────────────────────────────────────────────
async function addLater() {
  if (!laterUrl.value.trim()) return
  laterBusy.value = true; laterErr.value = ''
  try {
    const item = await apiFetch('/api/readlater', { method: 'POST', body: JSON.stringify({ url: laterUrl.value.trim() }) })
    laterItems.value.unshift(item); laterUrl.value = ''
  } catch (e: any) { laterErr.value = e.message }
  laterBusy.value = false
}
async function toggleRead(item: LaterItem) {
  try { await apiFetch(`/api/readlater/${item.id}`, { method: 'PATCH', body: JSON.stringify({ read: !item.read }) }); item.read = !item.read } catch {}
}
async function delLater(id: string) {
  try { await apiFetch(`/api/readlater/${id}`, { method: 'DELETE' }); laterItems.value = laterItems.value.filter(i => i.id !== id) } catch {}
}

// ── Sleep ──────────────────────────────────────────────────────────────────────
async function logSleep(type: 'sleep' | 'wake') {
  sleepBusy.value = true; sleepErr.value = ''
  try { const e = await apiFetch('/api/sleep', { method: 'POST', body: JSON.stringify({ type }) }); sleepLog.value.push(e) }
  catch (e: any) { sleepErr.value = e.message }
  sleepBusy.value = false
}
async function delSleepEntry(id: string) {
  try { await apiFetch(`/api/sleep/${id}`, { method: 'DELETE' }); sleepLog.value = sleepLog.value.filter(i => i.id !== id) } catch {}
}

const lastSleepType = computed(() => sleepLog.value.length ? sleepLog.value[sleepLog.value.length - 1].type : null)

interface DayBar { label: string; hours: number; pct: number }
const sleepChart = computed<DayBar[]>(() => {
  const sorted = [...sleepLog.value].sort((a, b) => +new Date(a.ts) - +new Date(b.ts))
  const sessions: { start: Date; end: Date }[] = []
  let pending: SleepEntry | null = null
  for (const e of sorted) {
    if (e.type === 'sleep') { pending = e }
    else if (e.type === 'wake' && pending) { sessions.push({ start: new Date(pending.ts), end: new Date(e.ts) }); pending = null }
  }
  const now = new Date(); const days: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()), e = new Date(+s + 86_400_000)
    let hrs = 0
    for (const sess of sessions) { const ov = Math.min(+sess.end, +e) - Math.max(+sess.start, +s); if (ov > 0) hrs += ov / 3_600_000 }
    days.push({ label: s.toLocaleDateString('en', { weekday: 'short' }), hours: hrs, pct: 0 })
  }
  const max = Math.max(...days.map(d => d.hours), 8)
  days.forEach(d => { d.pct = (d.hours / max) * 100 })
  return days
})

// ── Mount / unmount ────────────────────────────────────────────────────────────
onMounted(() => {
  if (localStorage.getItem('sd_s') !== '1') { router.go('/'); return }
  loadReadSet()
  const w = localStorage.getItem('sd_w'), k = localStorage.getItem('sd_k')
  if (w && k) { workerUrl.value = w; apiKey.value = k; ready.value = true; loadAll() }
  else { showSetup.value = true }
  // Desktop: feeds panel always visible, so keyboard nav is always active
  document.addEventListener('keydown', onFeedKeydown)
})

onUnmounted(() => {
  recognition?.stop()
  if (saveTimer) clearTimeout(saveTimer)
  stopFeedAutoRefresh()
  document.removeEventListener('keydown', onFeedKeydown)
})
</script>

<template>
  <!-- Setup overlay ─────────────────────────────────────────────────────────── -->
  <Transition name="sd-fade">
    <div v-if="showSetup || !ready" class="sd-overlay" @click.self="ready && (showSetup = false)">
      <div class="sd-setup-card">
        <div class="sd-setup-hd">
          <span class="sd-setup-label">{{ ready ? 'reconfigure' : 'connect worker' }}</span>
          <button v-if="ready" class="sd-icon-btn" @click="showSetup = false">×</button>
        </div>
        <div class="sd-field">
          <label class="sd-label">worker url</label>
          <input v-model="workerUrl" class="sd-input" placeholder="https://your-worker.workers.dev" @keydown.enter="testAndSave" />
        </div>
        <div class="sd-field">
          <label class="sd-label">api key</label>
          <input v-model="apiKey" class="sd-input" type="password" placeholder="secret" @keydown.enter="testAndSave" />
        </div>
        <p v-if="setupErr" class="sd-err">{{ setupErr }}</p>
        <button class="sd-connect-btn" @click="testAndSave" :disabled="setupBusy">{{ setupBusy ? '…' : 'connect' }}</button>
      </div>
    </div>
  </Transition>

  <!-- Dashboard ────────────────────────────────────────────────────────────── -->
  <div v-if="ready" class="sd-wrap">

    <!-- ── Desktop grid ──────────────────────────────────────────────────────── -->
    <div class="sd-grid">

      <!-- Music -->
      <div class="sd-card sd-area-music">
        <div class="sd-card-hd">
          <span class="sd-card-title">music</span>
          <button class="sd-icon-btn sd-cfg-btn" @click="showSetup = true" title="Settings">⚙</button>
        </div>
        <div class="sd-card-body sd-music-body"><SecretPlayer /></div>
      </div>

      <!-- Notes — two-pane markdown editor -->
      <div class="sd-card sd-area-notes">
        <div class="sd-card-hd">
          <span class="sd-card-title">notes</span>
          <div v-if="editorOpen" class="sd-view-toggle">
            <button :class="['sd-view-btn', { active: noteView === 'edit' }]" @click="noteView = 'edit'">edit</button>
            <button :class="['sd-view-btn', { active: noteView === 'split' }]" @click="noteView = 'split'">split</button>
            <button :class="['sd-view-btn', { active: noteView === 'preview' }]" @click="noteView = 'preview'">preview</button>
          </div>
        </div>
        <div class="sd-notes-body">
          <div class="sd-notes-layout">

            <!-- Sidebar -->
            <div class="sd-notes-sidebar">
              <button class="sd-new-note-btn" @click="newNote">+ new note</button>
              <div class="sd-notes-search-wrap">
                <input v-model="noteSearch" class="sd-notes-search" placeholder="search…" autocomplete="off" />
                <button v-if="noteSearch" class="sd-search-clear" @click="noteSearch = ''">×</button>
              </div>
              <div class="sd-notes-list-desktop">
                <button v-for="n in filteredNotes" :key="n.id"
                  :class="['sd-note-list-item', { active: activeNote?.id === n.id }]"
                  @click="openNote(n)">
                  <div class="sd-note-list-title" v-html="highlightFuzzy(n.title || 'untitled', noteSearch)"></div>
                  <div class="sd-note-list-date">{{ noteShortDate(n.updatedAt || n.createdAt) }}</div>
                </button>
                <div v-if="notes.length && !filteredNotes.length" class="sd-empty" style="padding: 1.25rem 0.75rem; font-size: 0.8rem;">no matches</div>
                <div v-if="!notes.length" class="sd-empty" style="padding: 1.25rem 0.75rem; font-size: 0.8rem;">no notes</div>
              </div>
            </div>

            <!-- Editor pane -->
            <div class="sd-notes-editor-pane">
              <!-- Empty state -->
              <div v-if="!editorOpen" class="sd-notes-empty-state">
                <span>select a note or</span>
                <button class="sd-text-btn sd-new-inline" @click="newNote">create one</button>
              </div>

              <!-- Active editor -->
              <template v-else>
                <input
                  class="sd-note-title-input"
                  v-model="editTitle"
                  placeholder="note title"
                  @input="scheduleAutoSave"
                />
                <div class="sd-md-toolbar">
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('**', '**')" title="Bold"><b>B</b></button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('*', '*')" title="Italic"><i>I</i></button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('`', '`')" title="Inline code">⌨</button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('\n```\n', '\n```')" title="Code block">{ }</button>
                  <div class="sd-tb-sep"></div>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('## ')" title="Heading">H</button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('- ')" title="Bullet">•</button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('> ')" title="Quote">❝</button>
                  <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('[', '](url)')" title="Link">⇱</button>
                  <div class="sd-tb-sep"></div>
                  <span class="sd-tb-spacer"></span>
                  <p v-if="noteErr" class="sd-err" style="margin: 0; font-size: 0.75rem;">{{ noteErr }}</p>
                  <button v-if="noteDirty" class="sd-save-btn" @click="saveNote" :disabled="noteSaveBusy">
                    {{ noteSaveBusy ? 'saving…' : 'save' }}
                  </button>
                  <span v-else class="sd-saved-text">saved</span>
                  <button v-if="activeNote?.id" class="sd-tb-del-btn" @mousedown.prevent @click="delNote(activeNote.id)" title="Delete note">×</button>
                </div>
                <div :class="['sd-md-panes', `sd-view-${noteView}`]">
                  <textarea v-if="noteView !== 'preview'"
                    class="sd-md-editor"
                    v-model="editBody"
                    placeholder="write in markdown…"
                    @input="scheduleAutoSave"
                    @focus="lastFocused = $event.target as HTMLTextAreaElement"
                  ></textarea>
                  <div v-if="noteView !== 'edit'" class="sd-md-preview" v-html="renderedBody"></div>
                </div>
              </template>
            </div>

          </div>
        </div>
      </div>

      <!-- Sleep -->
      <div class="sd-card sd-area-sleep">
        <div class="sd-card-hd"><span class="sd-card-title">sleep</span></div>
        <div class="sd-card-body">
          <div class="sd-pair-btns">
            <button :class="['sd-pair-btn', { active: lastSleepType === 'sleep' }]" @click="logSleep('sleep')" :disabled="sleepBusy">sleep</button>
            <button :class="['sd-pair-btn', { active: lastSleepType === 'wake' }]" @click="logSleep('wake')" :disabled="sleepBusy">wake</button>
          </div>
          <p v-if="sleepErr" class="sd-err">{{ sleepErr }}</p>
          <div class="sd-chart">
            <div v-for="day in sleepChart" :key="day.label" class="sd-bar-col">
              <div class="sd-bar-val">{{ day.hours > 0 ? day.hours.toFixed(1) : '' }}</div>
              <div class="sd-bar-track">
                <div class="sd-bar" :style="{ height: day.pct + '%' }"
                  :class="{ 'sd-bar-low': day.hours > 0 && day.hours < 6, 'sd-bar-ok': day.hours >= 6 }"></div>
              </div>
              <div class="sd-bar-lbl">{{ day.label }}</div>
            </div>
          </div>
          <div class="sd-list">
            <div v-for="e in [...sleepLog].reverse().slice(0, 5)" :key="e.id" class="sd-row">
              <span class="sd-row-primary">{{ e.type }}</span>
              <span class="sd-row-sub sd-row-sub-push">{{ new Date(e.ts).toLocaleString() }}</span>
              <button class="sd-del-btn" @click="delSleepEntry(e.id)">×</button>
            </div>
            <div v-if="!sleepLog.length" class="sd-empty">no log yet</div>
          </div>
        </div>
      </div>

      <!-- Read later -->
      <div class="sd-card sd-area-later">
        <div class="sd-card-hd"><span class="sd-card-title">read later</span></div>
        <div class="sd-card-body">
          <div class="sd-inline-form">
            <input v-model="laterUrl" class="sd-input sd-input-grow" placeholder="https://…" @keydown.enter="addLater" />
            <button class="sd-submit-btn" @click="addLater" :disabled="laterBusy">{{ laterBusy ? '…' : 'save' }}</button>
          </div>
          <p v-if="laterErr" class="sd-err">{{ laterErr }}</p>
          <div class="sd-list sd-list-scroll">
            <div v-for="item in laterItems" :key="item.id" :class="['sd-row sd-later-row', { 'sd-row-read': item.read }]">
              <div class="sd-row-body">
                <a :href="item.url" target="_blank" rel="noopener" class="sd-row-link">{{ item.title }}</a>
                <span class="sd-row-sub">{{ item.url }}</span>
              </div>
              <div class="sd-row-actions">
                <button class="sd-text-btn" @click="toggleRead(item)">{{ item.read ? 'unread' : 'read' }}</button>
                <button class="sd-del-btn" @click="delLater(item.id)">×</button>
              </div>
            </div>
            <div v-if="!laterItems.length" class="sd-empty">nothing saved yet</div>
          </div>
        </div>
      </div>

      <!-- Ideas -->
      <div class="sd-card sd-area-ideas">
        <div class="sd-card-hd"><span class="sd-card-title">ideas</span></div>
        <div class="sd-card-body">
          <div class="sd-idea-compose">
            <div class="sd-idea-input-row">
              <textarea v-model="ideaText" class="sd-textarea" placeholder="write an idea…" rows="2"
                @keydown.ctrl.enter="addIdea" @keydown.meta.enter="addIdea"></textarea>
              <button :class="['sd-mic-btn', { listening: isListening }]" @click="toggleVoice"
                :title="isListening ? 'stop listening' : 'voice input'">
                {{ isListening ? '⏹' : '🎤' }}
              </button>
            </div>
            <div v-if="interimText" class="sd-interim">{{ interimText }}…</div>
            <p v-if="voiceErr" class="sd-err">{{ voiceErr }}</p>
            <button class="sd-submit-btn" style="align-self:flex-end" @click="addIdea" :disabled="ideaBusy">
              {{ ideaBusy ? '…' : 'add idea' }}
            </button>
          </div>
          <p v-if="ideaErr" class="sd-err">{{ ideaErr }}</p>
          <div class="sd-ideas-grid">
            <div v-for="idea in ideas" :key="idea.id" class="sd-idea-card">
              <div class="sd-idea-text">{{ idea.text }}</div>
              <div class="sd-idea-footer">
                <span class="sd-idea-date">{{ noteDate(idea.createdAt) }}</span>
                <button class="sd-del-btn" @click="delIdea(idea.id)">×</button>
              </div>
            </div>
            <div v-if="!ideas.length" class="sd-empty">no ideas yet</div>
          </div>
        </div>
      </div>

      <!-- Feeds -->
      <div class="sd-card sd-area-feeds">
        <div class="sd-card-hd">
          <span class="sd-card-title">feeds</span>
        </div>
        <div class="sd-feeds-layout">

          <!-- Feed sidebar -->
          <div class="sd-feeds-sidebar">
            <div class="sd-feeds-sidebar-hd">
              <span class="sd-feeds-sidebar-title">sources</span>
              <button class="sd-feeds-refresh-btn" @click="activeFeedId ? refreshFeed(activeFeedId) : null" title="Refresh current feed">↺</button>
            </div>
            <div class="sd-feeds-list">
              <!-- All pseudo-feed -->
              <button :class="['sd-feed-item', { active: activeFeedId === '__all__' }]" @click="selectFeed('__all__')">
                <span class="sd-feed-name">All</span>
                <span v-if="unreadCount('__all__')" class="sd-feed-badge">{{ unreadCount('__all__') }}</span>
              </button>
              <div v-for="f in feeds" :key="f.id"
                :class="['sd-feed-item', { active: activeFeedId === f.id }]"
                @click="selectFeed(f.id)">
                <template v-if="editingFeedId === f.id">
                  <input :id="'feed-rename-' + f.id" v-model="editingFeedTitle" class="sd-feed-rename-input"
                    @click.stop @keydown.enter.stop="commitRenameFeed(f)"
                    @keydown.escape.stop="cancelRenameFeed" @blur="commitRenameFeed(f)" />
                </template>
                <template v-else>
                  <span class="sd-feed-name" @dblclick.stop="startEditFeed(f, $event)" title="Double-click to rename">{{ f.title }}</span>
                </template>
                <span v-if="unreadCount(f.id)" class="sd-feed-badge">{{ unreadCount(f.id) }}</span>
                <button class="sd-feeds-item-refresh" @click.stop="refreshFeed(f.id)" title="Refresh">↺</button>
                <button class="sd-del-btn" @click.stop="deleteFeed(f.id)" title="Remove feed">×</button>
              </div>
              <div v-if="!feeds.length" class="sd-empty" style="padding: 1rem 0.75rem; font-size: 0.8rem;">no feeds yet</div>
            </div>
            <div class="sd-feeds-add">
              <input v-model="newFeedUrl" class="sd-input" placeholder="rss feed url…" @keydown.enter="addFeed" />
              <button class="sd-submit-btn" @click="addFeed" :disabled="newFeedBusy">{{ newFeedBusy ? '…' : 'add' }}</button>
              <p v-if="feedErr" class="sd-err" style="margin: 0.4rem 0 0; grid-column: 1/-1;">{{ feedErr }}</p>
            </div>
          </div>

          <!-- Articles pane -->
          <div class="sd-feeds-articles">
            <div v-if="!activeFeedId" class="sd-empty" style="height:100%; display:flex; align-items:center; justify-content:center;">select a feed</div>
            <template v-else>
              <!-- Articles header -->
              <div class="sd-articles-hd">
                <input v-model="feedSearch" class="sd-feeds-search" placeholder="search articles…" autocomplete="off" />
                <button :class="['sd-feeds-filter-btn', { active: feedUnreadOnly }]" @click="feedUnreadOnly = !feedUnreadOnly">unread only</button>
                <button class="sd-feeds-markall-btn" @click="markAllRead">mark all read</button>
                <button class="sd-feeds-refresh-btn" @click="refreshFeed(activeFeedId)" title="Refresh">↺</button>
              </div>
              <div v-if="feedLoading[activeFeedId] && activeFeedId !== '__all__'" class="sd-empty" style="padding:2rem; text-align:center;">loading…</div>
              <div v-else-if="!activeArticles.length" class="sd-empty" style="padding:2rem; text-align:center;">{{ feedSearch || feedUnreadOnly ? 'no results' : 'no articles' }}</div>
              <div v-else class="sd-articles-list">
                <div v-for="(item, idx) in activeArticles" :key="item.link || item.title"
                  :class="['sd-article-row', { 'sd-article-read': isRead(item.link), 'sd-article-focused': focusedArticleIndex === idx }]"
                  @mouseenter="focusedArticleIndex = idx">
                  <div class="sd-article-row-main">
                    <a :href="item.link" target="_blank" rel="noopener" class="sd-article-link" @click="markRead(item.link)">
                      <div class="sd-article-title">{{ item.title }}</div>
                      <div v-if="item.summary" class="sd-article-summary">{{ item.summary }}</div>
                      <div class="sd-article-meta">{{ feedItemDate(item.pubDate) }}</div>
                    </a>
                  </div>
                  <div class="sd-article-actions">
                    <button class="sd-article-later-btn" @click.prevent="saveToReadLater(item)" :title="feedSavedLinks.has(item.link) ? 'saved!' : 'save to read later'">
                      {{ feedSavedLinks.has(item.link) ? 'saved' : '→later' }}
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>

        </div>
      </div>

      <!-- AMA -->
      <div class="sd-card sd-area-ama">
        <div class="sd-card-hd"><span class="sd-card-title">ask me anything</span></div>
        <div class="sd-card-body sd-ama-body">
          <p v-if="amaErr" class="sd-err">{{ amaErr }}</p>
          <div v-if="!amaItems.length" class="sd-empty">no questions yet</div>
          <div class="sd-ama-list">
            <div v-for="item in [...amaItems].reverse()" :key="item.id" :class="['sd-ama-item', { 'sd-ama-answered': item.answered }]">
              <div class="sd-ama-q-row">
                <div class="sd-ama-question">{{ item.question }}</div>
                <div class="sd-ama-meta">
                  <span v-if="item.name" class="sd-ama-name">{{ item.name }}</span>
                  <span class="sd-ama-date">{{ amaDate(item.askedAt) }}</span>
                  <button class="sd-del-btn" @click="deleteAma(item.id)">×</button>
                </div>
              </div>
              <div v-if="item.answered" class="sd-ama-existing-answer">{{ item.answer }}</div>
              <div class="sd-ama-answer-row">
                <textarea
                  v-model="amaAnswers[item.id]"
                  class="sd-textarea sd-ama-textarea"
                  :placeholder="item.answered ? 'edit answer…' : 'write answer…'"
                  rows="2"
                ></textarea>
                <button class="sd-submit-btn" @click="answerAma(item.id)" :disabled="amaBusy[item.id] || !amaAnswers[item.id]?.trim()">
                  {{ amaBusy[item.id] ? '…' : item.answered ? 'update' : 'publish' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects -->
      <div class="sd-card sd-area-projects">
        <div class="sd-card-hd">
          <span class="sd-card-title">projects</span>
          <div class="sd-proj-filters">
            <button v-for="f in ['all', ...STATUS_ORDER]" :key="f"
              :class="['sd-proj-filter-btn', { active: projectFilter === f }]"
              @click="projectFilter = f as any">
              {{ f }}<span v-if="projectStatusCounts[f]" class="sd-proj-filter-count">{{ projectStatusCounts[f] }}</span>
            </button>
          </div>
        </div>
        <div class="sd-proj-layout">

          <!-- Sidebar -->
          <div class="sd-proj-sidebar">
            <div class="sd-proj-add">
              <input v-model="newProjectName" class="sd-input" placeholder="new project…" @keydown.enter="addProject" />
              <button class="sd-submit-btn" @click="addProject" :disabled="newProjectBusy">{{ newProjectBusy ? '…' : '+' }}</button>
            </div>
            <div class="sd-proj-search-wrap">
              <input v-model="projectSearch" class="sd-proj-search" placeholder="search…" autocomplete="off" />
              <button v-if="projectSearch" class="sd-search-clear" @click="projectSearch = ''">×</button>
            </div>
            <p v-if="projectErr" class="sd-err" style="margin: 0.4rem 0.6rem 0; font-size: 0.75rem;">{{ projectErr }}</p>
            <div class="sd-proj-list">
              <div v-for="p in filteredProjects" :key="p.id"
                :class="['sd-proj-item', { active: activeProject?.id === p.id, 'sd-proj-item-stale': isStale(p) }]"
                @click="openProject(p)">
                <span :class="['sd-proj-dot', `sd-proj-dot-${p.status}`]" @click="cycleStatus(p, $event)" title="Click to cycle status"></span>
                <span class="sd-proj-item-name">{{ p.name }}</span>
                <button class="sd-proj-page-btn" @click="openProjectPage(p, $event)" title="Open project page">↗</button>
              </div>
              <div v-if="!filteredProjects.length" class="sd-empty" style="padding: 1rem 0.75rem; font-size: 0.8rem;">
                {{ projects.length ? 'no matches' : 'no projects yet' }}
              </div>
            </div>
          </div>

          <!-- Detail pane -->
          <div class="sd-proj-detail">
            <div v-if="!activeProject" class="sd-notes-empty-state">
              <span>select a project or</span>
              <button class="sd-text-btn sd-new-inline" @click="newProjectName = ''; nextTick(() => (document.querySelector('.sd-proj-add .sd-input') as HTMLInputElement)?.focus())">create one</button>
            </div>
            <template v-else>
              <div class="sd-proj-detail-hd">
                <input class="sd-proj-name-input" v-model="projectEditName" placeholder="project name" @input="scheduleProjectSave" />
                <div class="sd-proj-status-row">
                  <button v-for="s in STATUS_ORDER" :key="s"
                    :class="['sd-proj-status-btn', `sd-proj-status-btn-${s}`, { active: projectEditStatus === s }]"
                    @click="projectEditStatus = s; scheduleProjectSave()">{{ s }}</button>
                  <span class="sd-tb-spacer"></span>
                  <button class="sd-proj-open-page-btn" @click="openProjectPage(activeProject)" title="Open full markdown page">↗ page</button>
                  <span class="sd-saved-text" style="font-size:0.7rem;">{{ projectSaveBusy ? 'saving…' : projectDirty ? '' : 'saved' }}</span>
                  <button v-if="projectDirty" class="sd-save-btn" @click="saveProject" :disabled="projectSaveBusy">save</button>
                  <button class="sd-tb-del-btn" @click="deleteProject(activeProject.id)" title="Delete project">×</button>
                </div>
              </div>
              <div class="sd-proj-detail-body">
                <label class="sd-proj-field-label">next step</label>
                <textarea class="sd-textarea sd-proj-nextstep" v-model="projectEditNext" placeholder="what needs to happen next…" rows="3" @input="scheduleProjectSave"></textarea>
                <label class="sd-proj-field-label" style="margin-top: 0.75rem;">description</label>
                <textarea class="sd-textarea sd-proj-desc" v-model="projectEditDesc" placeholder="background, goals, notes…" rows="3" @input="scheduleProjectSave"></textarea>
                <div class="sd-proj-links-section">
                  <label class="sd-proj-field-label">links</label>
                  <div class="sd-proj-links-list">
                    <div v-for="l in projectEditLinks" :key="l.id" class="sd-proj-link-row">
                      <a :href="l.url" target="_blank" rel="noopener" class="sd-proj-link-text">{{ linkHostname(l.url) }}</a>
                      <button class="sd-del-btn" @click="removeProjectLink(l.id)" style="opacity:0.4">×</button>
                    </div>
                    <div class="sd-proj-link-add">
                      <input v-model="projectLinkInput" class="sd-input" placeholder="https://…" style="font-size:0.8rem; padding:0.3rem 0.5rem;" @keydown.enter="addProjectLink" />
                      <button class="sd-submit-btn" @click="addProjectLink" :disabled="projectLinkBusy" style="font-size:0.8rem; padding:0.3rem 0.6rem;">{{ projectLinkBusy ? '…' : 'add' }}</button>
                    </div>
                  </div>
                </div>
                <div class="sd-proj-updated">last updated {{ noteShortDate(activeProject.updatedAt || activeProject.createdAt) }}</div>
              </div>
            </template>
          </div>

        </div>
      </div>

    </div><!-- /sd-grid -->

    <!-- ── Mobile panels ──────────────────────────────────────────────────────── -->
    <div class="sd-mobile">
      <div class="sd-mobile-hd" v-show="!(tab === 'projects' && mobileProjectView === 'detail')">
        <template v-if="tab === 'notes' && mobileNoteView === 'editor'">
          <button class="sd-back-btn" @click="backFromEditor">←</button>
          <input class="sd-note-title-hd-input" v-model="editTitle" placeholder="title" @input="scheduleAutoSave" />
          <span class="sd-hd-save-status">{{ noteSaveBusy ? '…' : noteDirty ? 'saving' : '✓' }}</span>
        </template>
        <template v-else>
          <span class="sd-card-title">{{ tabs.find(t => t.id === tab)?.label }}</span>
          <button v-if="tab === 'music'" class="sd-icon-btn sd-cfg-btn" @click="showSetup = true">⚙</button>
        </template>
      </div>

      <div v-show="tab === 'music'" class="sd-mobile-panel"><SecretPlayer /></div>

      <!-- Notes mobile -->
      <div v-if="mobileLoaded.notes" v-show="tab === 'notes'" class="sd-mobile-panel sd-mobile-panel-notes">

        <!-- List view -->
        <template v-if="mobileNoteView === 'list'">
          <div class="sd-notes-search-wrap sd-notes-search-mobile">
            <input v-model="noteSearch" class="sd-notes-search" placeholder="search notes…" autocomplete="off" />
            <button v-if="noteSearch" class="sd-search-clear" @click="noteSearch = ''">×</button>
          </div>
          <div class="sd-notes-list-mobile">
            <button v-for="n in filteredNotes" :key="n.id" class="sd-note-list-item-mobile" @click="openNote(n)">
              <div class="sd-note-list-title" v-html="highlightFuzzy(n.title || 'untitled', noteSearch)"></div>
              <div class="sd-note-list-preview" v-if="n.body">{{ stripMd(n.body).slice(0, 90) }}</div>
              <div class="sd-note-list-date">{{ noteShortDate(n.updatedAt || n.createdAt) }}</div>
            </button>
            <div v-if="notes.length && !filteredNotes.length" class="sd-empty sd-notes-empty-mobile">no matches</div>
            <div v-if="!notes.length" class="sd-empty sd-notes-empty-mobile">
              no notes yet<br><small>tap + to write your first note</small>
            </div>
          </div>
          <button class="sd-mobile-fab" @click="newNote" title="New note">+</button>
        </template>

        <!-- Editor view -->
        <template v-else>
          <div class="sd-mobile-md-toolbar">
            <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('**', '**')"><b>B</b></button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('*', '*')"><i>I</i></button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('`', '`')">⌨</button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('## ')">H</button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('- ')">•</button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertLine('> ')">❝</button>
            <button class="sd-tb-btn" @mousedown.prevent @click="insertMd('[', '](url)')">⇱</button>
            <span class="sd-tb-spacer"></span>
            <button :class="['sd-tb-btn', 'sd-preview-toggle', { active: mobilePreview }]"
              @mousedown.prevent @click="mobilePreview = !mobilePreview">
              {{ mobilePreview ? 'edit' : 'preview' }}
            </button>
          </div>
          <div class="sd-mobile-editor-body">
            <textarea v-if="!mobilePreview"
              class="sd-md-editor sd-mobile-editor-ta"
              v-model="editBody"
              placeholder="write in markdown…"
              @input="scheduleAutoSave"
              @focus="lastFocused = $event.target as HTMLTextAreaElement"
            ></textarea>
            <div v-else class="sd-md-preview sd-mobile-preview" v-html="renderedBody"></div>
          </div>
          <div class="sd-mobile-editor-footer">
            <button v-if="activeNote?.id" class="sd-del-note-mobile" @click="delNoteAndBack(activeNote.id)">delete note</button>
            <span v-else class="sd-new-note-hint">unsaved — tap save in header</span>
          </div>
        </template>

      </div>

      <div v-if="mobileLoaded.ideas" v-show="tab === 'ideas'" class="sd-mobile-panel">
        <div class="sd-idea-compose">
          <div class="sd-idea-input-row">
            <textarea v-model="ideaText" class="sd-textarea" placeholder="write an idea…" rows="2"
              @keydown.ctrl.enter="addIdea" @keydown.meta.enter="addIdea"></textarea>
            <button :class="['sd-mic-btn', { listening: isListening }]" @click="toggleVoice">{{ isListening ? '⏹' : '🎤' }}</button>
          </div>
          <div v-if="interimText" class="sd-interim">{{ interimText }}…</div>
          <p v-if="voiceErr" class="sd-err">{{ voiceErr }}</p>
          <button class="sd-submit-btn" style="align-self:flex-end" @click="addIdea" :disabled="ideaBusy">{{ ideaBusy ? '…' : 'add idea' }}</button>
        </div>
        <p v-if="ideaErr" class="sd-err">{{ ideaErr }}</p>
        <div class="sd-list">
          <div v-for="idea in ideas" :key="idea.id" class="sd-note-item">
            <div class="sd-note-text">{{ idea.text }}</div>
            <div class="sd-note-footer">
              <span class="sd-note-date">{{ noteDate(idea.createdAt) }}</span>
              <button class="sd-del-btn" @click="delIdea(idea.id)">×</button>
            </div>
          </div>
          <div v-if="!ideas.length" class="sd-empty">no ideas yet</div>
        </div>
      </div>

      <div v-if="mobileLoaded.later" v-show="tab === 'later'" class="sd-mobile-panel">
        <div class="sd-inline-form">
          <input v-model="laterUrl" class="sd-input sd-input-grow" placeholder="https://…" @keydown.enter="addLater" />
          <button class="sd-submit-btn" @click="addLater" :disabled="laterBusy">{{ laterBusy ? '…' : 'save' }}</button>
        </div>
        <p v-if="laterErr" class="sd-err">{{ laterErr }}</p>
        <div class="sd-list">
          <div v-for="item in laterItems" :key="item.id" :class="['sd-row sd-later-row', { 'sd-row-read': item.read }]">
            <div class="sd-row-body">
              <a :href="item.url" target="_blank" rel="noopener" class="sd-row-link">{{ item.title }}</a>
              <span class="sd-row-sub">{{ item.url }}</span>
            </div>
            <div class="sd-row-actions">
              <button class="sd-text-btn" @click="toggleRead(item)">{{ item.read ? 'unread' : 'read' }}</button>
              <button class="sd-del-btn" @click="delLater(item.id)">×</button>
            </div>
          </div>
          <div v-if="!laterItems.length" class="sd-empty">nothing saved yet</div>
        </div>
      </div>

      <div v-if="mobileLoaded.sleep" v-show="tab === 'sleep'" class="sd-mobile-panel">
        <div class="sd-pair-btns">
          <button :class="['sd-pair-btn', { active: lastSleepType === 'sleep' }]" @click="logSleep('sleep')" :disabled="sleepBusy">sleep</button>
          <button :class="['sd-pair-btn', { active: lastSleepType === 'wake' }]" @click="logSleep('wake')" :disabled="sleepBusy">wake</button>
        </div>
        <p v-if="sleepErr" class="sd-err">{{ sleepErr }}</p>
        <div class="sd-chart">
          <div v-for="day in sleepChart" :key="day.label" class="sd-bar-col">
            <div class="sd-bar-val">{{ day.hours > 0 ? day.hours.toFixed(1) : '' }}</div>
            <div class="sd-bar-track">
              <div class="sd-bar" :style="{ height: day.pct + '%' }"
                :class="{ 'sd-bar-low': day.hours > 0 && day.hours < 6, 'sd-bar-ok': day.hours >= 6 }"></div>
            </div>
            <div class="sd-bar-lbl">{{ day.label }}</div>
          </div>
        </div>
        <div class="sd-list">
          <div v-for="e in [...sleepLog].reverse().slice(0, 8)" :key="e.id" class="sd-row">
            <span class="sd-row-primary">{{ e.type }}</span>
            <span class="sd-row-sub sd-row-sub-push">{{ new Date(e.ts).toLocaleString() }}</span>
            <button class="sd-del-btn" @click="delSleepEntry(e.id)">×</button>
          </div>
          <div v-if="!sleepLog.length" class="sd-empty">no log yet</div>
        </div>
      </div>

      <!-- Feeds mobile -->
      <div v-if="mobileLoaded.feeds" v-show="tab === 'feeds'" class="sd-mobile-panel sd-mobile-panel-feeds">
        <template v-if="mobileFeedView === 'list'">
          <div class="sd-feeds-mobile-add">
            <input v-model="newFeedUrl" class="sd-input" placeholder="rss feed url…" @keydown.enter="addFeed" />
            <button class="sd-submit-btn" @click="addFeed" :disabled="newFeedBusy">{{ newFeedBusy ? '…' : 'add' }}</button>
          </div>
          <p v-if="feedErr" class="sd-err" style="padding: 0 0 0.5rem;">{{ feedErr }}</p>
          <div class="sd-list">
            <!-- All pseudo-feed -->
            <div class="sd-row" @click="selectFeed('__all__')" style="cursor:pointer">
              <div class="sd-row-body">
                <span class="sd-row-primary">All</span>
              </div>
              <span v-if="unreadCount('__all__')" class="sd-feed-badge">{{ unreadCount('__all__') }}</span>
            </div>
            <div v-for="f in feeds" :key="f.id" class="sd-row" @click="selectFeed(f.id)" style="cursor:pointer">
              <div class="sd-row-body">
                <template v-if="editingFeedId === f.id">
                  <input :id="'feed-rename-m-' + f.id" v-model="editingFeedTitle" class="sd-feed-rename-input"
                    @click.stop @keydown.enter.stop="commitRenameFeed(f)"
                    @keydown.escape.stop="cancelRenameFeed" @blur="commitRenameFeed(f)" />
                </template>
                <span v-else class="sd-row-primary" @dblclick.stop="startEditFeed(f, $event)" title="Double-click to rename">{{ f.title }}</span>
              </div>
              <span v-if="unreadCount(f.id)" class="sd-feed-badge">{{ unreadCount(f.id) }}</span>
              <button class="sd-feeds-refresh-btn" @click.stop="refreshFeed(f.id)" title="Refresh">↺</button>
              <button class="sd-del-btn" @click.stop="deleteFeed(f.id)">×</button>
            </div>
            <div v-if="!feeds.length" class="sd-empty">no feeds yet</div>
          </div>
        </template>
        <template v-else>
          <div class="sd-feeds-mobile-articles-hd">
            <button class="sd-feeds-back-btn" @click="mobileFeedView = 'list'">← back</button>
            <div class="sd-feeds-mobile-controls">
              <input v-model="feedSearch" class="sd-feeds-search" placeholder="search…" autocomplete="off" />
              <button :class="['sd-feeds-filter-btn', { active: feedUnreadOnly }]" @click="feedUnreadOnly = !feedUnreadOnly">unread</button>
              <button class="sd-feeds-markall-btn" @click="markAllRead">✓ all</button>
              <button class="sd-feeds-refresh-btn" @click="refreshFeed(activeFeedId)" title="Refresh">↺</button>
            </div>
          </div>
          <div v-if="feedLoading[activeFeedId] && activeFeedId !== '__all__'" class="sd-empty">loading…</div>
          <div v-else-if="!activeArticles.length" class="sd-empty">{{ feedSearch || feedUnreadOnly ? 'no results' : 'no articles' }}</div>
          <div v-else class="sd-articles-list">
            <div v-for="(item, idx) in activeArticles" :key="item.link || item.title"
              :class="['sd-article-row', { 'sd-article-read': isRead(item.link), 'sd-article-focused': focusedArticleIndex === idx }]">
              <div class="sd-article-row-main">
                <a :href="item.link" target="_blank" rel="noopener" class="sd-article-link" @click="markRead(item.link)">
                  <div class="sd-article-title">{{ item.title }}</div>
                  <div v-if="item.summary" class="sd-article-summary">{{ item.summary }}</div>
                  <div class="sd-article-meta">{{ feedItemDate(item.pubDate) }}</div>
                </a>
              </div>
              <div class="sd-article-actions">
                <button class="sd-article-later-btn" @click.prevent="saveToReadLater(item)" :title="feedSavedLinks.has(item.link) ? 'saved!' : 'save to read later'">
                  {{ feedSavedLinks.has(item.link) ? 'saved' : '→later' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Projects mobile -->
      <div v-if="mobileLoaded.projects" v-show="tab === 'projects'" class="sd-mobile-panel sd-mobile-panel-proj">
        <template v-if="mobileProjectView === 'list'">
          <div class="sd-proj-mobile-top">
            <div class="sd-proj-filters sd-proj-filters-mobile">
              <button v-for="f in ['all', ...STATUS_ORDER]" :key="f"
                :class="['sd-proj-filter-btn', { active: projectFilter === f }]"
                @click="projectFilter = f as any">
                {{ f }}<span v-if="projectStatusCounts[f]" class="sd-proj-filter-count">{{ projectStatusCounts[f] }}</span>
              </button>
            </div>
            <div class="sd-proj-add">
              <input v-model="newProjectName" class="sd-input" placeholder="new project…" @keydown.enter="addProject" />
              <button class="sd-submit-btn" @click="addProject" :disabled="newProjectBusy">{{ newProjectBusy ? '…' : '+' }}</button>
            </div>
            <p v-if="projectErr" class="sd-err" style="margin: 0.25rem 0 0;">{{ projectErr }}</p>
          </div>
          <div class="sd-list">
            <div v-for="p in filteredProjects" :key="p.id"
              :class="['sd-proj-item-mobile', { 'sd-proj-item-stale': isStale(p) }]"
              @click="openProject(p)">
              <span :class="['sd-proj-dot', `sd-proj-dot-${p.status}`]" @click.stop="cycleStatus(p, $event)" style="margin-top:0.35rem; flex-shrink:0;"></span>
              <div class="sd-proj-item-body">
                <div class="sd-proj-item-name">{{ p.name }}</div>
                <div v-if="p.nextStep" class="sd-proj-item-next">{{ p.nextStep }}</div>
              </div>
              <button class="sd-proj-page-btn" @click.stop="openProjectPage(p)" title="Open page">↗</button>
            </div>
            <div v-if="!filteredProjects.length" class="sd-empty">{{ projects.length ? 'no matches' : 'no projects yet' }}</div>
          </div>
        </template>
        <template v-else>
          <div class="sd-proj-mobile-detail-hd">
            <button class="sd-back-btn" @click="mobileProjectView = 'list'; if (projectDirty) saveProject()">←</button>
            <input class="sd-proj-name-mobile-input" v-model="projectEditName" placeholder="project name" @input="scheduleProjectSave" />
            <span class="sd-hd-save-status">{{ projectSaveBusy ? '…' : projectDirty ? 'saving' : '✓' }}</span>
          </div>
          <div class="sd-mobile-panel" style="padding-top: 0.75rem;">
            <div class="sd-proj-status-row" style="margin-bottom: 1rem;">
              <button v-for="s in STATUS_ORDER" :key="s"
                :class="['sd-proj-status-btn', `sd-proj-status-btn-${s}`, { active: projectEditStatus === s }]"
                @click="projectEditStatus = s; scheduleProjectSave()">{{ s }}</button>
            </div>
            <label class="sd-proj-field-label">next step</label>
            <textarea class="sd-textarea sd-proj-nextstep" v-model="projectEditNext" placeholder="what needs to happen next…" rows="3" @input="scheduleProjectSave" style="margin-bottom: 0.75rem;"></textarea>
            <label class="sd-proj-field-label">description</label>
            <textarea class="sd-textarea sd-proj-desc" v-model="projectEditDesc" placeholder="background, goals, notes…" rows="4" @input="scheduleProjectSave" style="margin-bottom: 0.75rem;"></textarea>
            <div class="sd-proj-links-section">
              <label class="sd-proj-field-label">links</label>
              <div class="sd-proj-links-list">
                <div v-for="l in projectEditLinks" :key="l.id" class="sd-proj-link-row">
                  <a :href="l.url" target="_blank" rel="noopener" class="sd-proj-link-text">{{ linkHostname(l.url) }}</a>
                  <button class="sd-del-btn" @click="removeProjectLink(l.id)">×</button>
                </div>
                <div class="sd-proj-link-add">
                  <input v-model="projectLinkInput" class="sd-input" placeholder="https://…" style="font-size:0.85rem;" @keydown.enter="addProjectLink" />
                  <button class="sd-submit-btn" @click="addProjectLink" :disabled="projectLinkBusy">{{ projectLinkBusy ? '…' : 'add' }}</button>
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top: 1rem;">
              <button class="sd-proj-open-page-btn" @click="openProjectPage(activeProject!)">↗ open page</button>
              <button class="sd-del-note-mobile" @click="deleteProject(activeProject!.id)">delete</button>
            </div>
          </div>
        </template>
      </div>

      <!-- AMA mobile -->
      <div v-if="mobileLoaded.ama" v-show="tab === 'ama'" class="sd-mobile-panel">
        <p v-if="amaErr" class="sd-err">{{ amaErr }}</p>
        <div v-if="!amaItems.length" class="sd-empty">no questions yet</div>
        <div v-for="item in [...amaItems].reverse()" :key="item.id" :class="['sd-ama-item-mobile', { 'sd-ama-answered': item.answered }]">
          <div class="sd-ama-question">{{ item.question }}</div>
          <div class="sd-ama-meta">
            <span v-if="item.name" class="sd-ama-name">{{ item.name }}</span>
            <span class="sd-ama-date">{{ amaDate(item.askedAt) }}</span>
          </div>
          <div v-if="item.answered" class="sd-ama-existing-answer">{{ item.answer }}</div>
          <textarea v-model="amaAnswers[item.id]" class="sd-textarea" :placeholder="item.answered ? 'edit answer…' : 'write answer…'" rows="2" style="margin-top:0.5rem"></textarea>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem">
            <button class="sd-submit-btn" @click="answerAma(item.id)" :disabled="amaBusy[item.id] || !amaAnswers[item.id]?.trim()">
              {{ amaBusy[item.id] ? '…' : item.answered ? 'update' : 'publish' }}
            </button>
            <button class="sd-del-btn" @click="deleteAma(item.id)" style="opacity:0.5">×</button>
          </div>
        </div>
      </div>

    </div><!-- /sd-mobile -->

    <!-- Mobile tab bar -->
    <nav class="sd-tabbar">
      <button v-for="t in tabs" :key="t.id" :class="['sd-tab', { active: tab === t.id }]" @click="switchTab(t.id)">
        <span class="sd-tab-icon">{{ t.icon }}</span>
        <span class="sd-tab-lbl">{{ t.label }}</span>
      </button>
    </nav>

  </div><!-- /sd-wrap -->
</template>

<style scoped>
/* ── Overlay / setup ─────────────────────────────────────────────────────────── */
.sd-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 1.5rem;
}
.sd-setup-card {
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  padding: 1.75rem 2rem; width: 100%; max-width: 22rem;
  display: flex; flex-direction: column; gap: 1rem;
}
html.light .sd-setup-card { background: #fff; border-color: rgba(124,58,237,0.3); }
html:not(.light) .sd-setup-card { background: #1e1b2e; border-color: rgba(167,139,250,0.3); }
.sd-setup-hd { display: flex; align-items: center; justify-content: space-between; }
.sd-setup-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--vp-c-text-2); }
.sd-connect-btn {
  background: none; border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  font: inherit; font-size: 0.875rem; padding: 0.5rem 1rem;
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.sd-connect-btn:hover:not(:disabled) { background: var(--vp-c-brand-1); color: #fff; }
.sd-connect-btn:disabled { opacity: 0.35; cursor: default; }

/* ── Shared ──────────────────────────────────────────────────────────────────── */
.sd-field { display: flex; flex-direction: column; gap: 0.35rem; }
.sd-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--vp-c-text-2); }

.sd-input {
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); font: inherit; font-size: 0.9rem;
  padding: 0.5rem 0.75rem; outline: none; min-width: 0; transition: border-color 0.15s;
}
.sd-input::placeholder { color: var(--vp-c-text-3); }
.sd-input:focus { border-color: var(--vp-c-brand-1); }
.sd-input-grow { flex: 1; }

.sd-textarea {
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); font: inherit; font-size: 0.9rem;
  padding: 0.6rem 0.75rem; outline: none; resize: vertical; width: 100%;
  transition: border-color 0.15s; line-height: 1.55;
}
.sd-textarea::placeholder { color: var(--vp-c-text-3); }
.sd-textarea:focus { border-color: var(--vp-c-brand-1); }

.sd-err { font-size: 0.78rem; color: #f43f5e; margin: 0 0 0.5rem; }

/* Buttons */
.sd-icon-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.9rem; cursor: pointer;
  padding: 0; line-height: 1; transition: color 0.15s;
}
.sd-icon-btn:hover { color: var(--vp-c-text-1); }

.sd-submit-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1);
  font: inherit; font-size: 0.85rem; padding: 0.5rem 1rem;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.sd-submit-btn:hover:not(:disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.sd-submit-btn:disabled { opacity: 0.3; cursor: default; }

.sd-text-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.8rem; padding: 0.15rem 0.4rem;
  cursor: pointer; transition: color 0.15s;
}
.sd-text-btn:hover { color: var(--vp-c-text-1); }

.sd-del-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 1.1rem; line-height: 1;
  padding: 0 0.3rem; cursor: pointer; opacity: 0.45;
  transition: opacity 0.15s, color 0.15s; flex-shrink: 0;
}
.sd-del-btn:hover { opacity: 1; color: #f43f5e; }

/* ── Form layouts ────────────────────────────────────────────────────────────── */
.sd-inline-form { display: flex; gap: 0.4rem; margin-bottom: 0.75rem; }

/* ── Ideas compose ───────────────────────────────────────────────────────────── */
.sd-idea-compose { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.75rem; }
.sd-idea-input-row { display: flex; gap: 0.4rem; align-items: flex-start; }
.sd-idea-input-row .sd-textarea { flex: 1; }

.sd-mic-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1);
  font: inherit; font-size: 1.1rem; padding: 0.5rem 0.65rem;
  cursor: pointer; flex-shrink: 0; line-height: 1;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  align-self: stretch; display: flex; align-items: center; justify-content: center;
}
.sd-mic-btn:hover { border-color: var(--vp-c-brand-1); }
.sd-mic-btn.listening {
  border-color: #f43f5e; color: #f43f5e;
  background: rgba(244, 63, 94, 0.08);
  animation: sd-pulse 1.4s ease-in-out infinite;
}
@keyframes sd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.sd-interim {
  font-size: 0.85rem; color: var(--vp-c-text-2); font-style: italic;
  padding: 0.35rem 0.6rem; background: var(--vp-c-bg-soft);
  border-left: 2px solid var(--vp-c-brand-1); opacity: 0.8;
}

/* ── Ideas grid ──────────────────────────────────────────────────────────────── */
.sd-ideas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.6rem;
}
.sd-idea-card {
  border: 1px solid var(--vp-c-divider);
  padding: 0.75rem;
  display: flex; flex-direction: column; gap: 0.4rem;
  transition: background 0.1s;
}
.sd-idea-card:hover { background: var(--vp-c-bg-soft); }
.sd-idea-text { font-size: 0.9rem; color: var(--vp-c-text-1); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.sd-idea-footer { display: flex; align-items: center; justify-content: space-between; }
.sd-idea-date { font-size: 0.72rem; color: var(--vp-c-text-2); }

/* ── List ────────────────────────────────────────────────────────────────────── */
.sd-list { border: 1px solid var(--vp-c-divider); overflow: hidden; }
.sd-list-scroll { max-height: 300px; overflow-y: auto; }

.sd-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background 0.1s;
}
.sd-row:last-child { border-bottom: none; }
.sd-row:hover { background: var(--vp-c-bg-soft); }
.sd-row-read { opacity: 0.4; }

.sd-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.sd-row-primary { font-size: 0.9rem; color: var(--vp-c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-row-link { font-size: 0.9rem; color: var(--vp-c-brand-1); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.sd-row-link:hover { text-decoration: underline; }
.sd-row-sub { font-size: 0.78rem; color: var(--vp-c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-row-sub-push { margin-left: auto; font-size: 0.78rem; flex-shrink: 0; }
.sd-row-actions { display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
.sd-later-row { align-items: flex-start; padding-top: 0.7rem; padding-bottom: 0.7rem; }

/* ── Notes items (ideas mobile reuse) ────────────────────────────────────────── */
.sd-note-item {
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background 0.1s;
}
.sd-note-item:last-child { border-bottom: none; }
.sd-note-item:hover { background: var(--vp-c-bg-soft); }
.sd-note-text { font-size: 0.9rem; color: var(--vp-c-text-1); line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.sd-note-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 0.45rem; }
.sd-note-date { font-size: 0.75rem; color: var(--vp-c-text-2); }

.sd-empty { padding: 1.5rem; text-align: center; font-size: 0.875rem; color: var(--vp-c-text-2); }

/* ── Sleep buttons ───────────────────────────────────────────────────────────── */
.sd-pair-btns { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.sd-pair-btn {
  flex: 1; background: none; border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); font: inherit; font-size: 0.9rem;
  padding: 0.65rem; cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.sd-pair-btn:hover:not(:disabled) { border-color: var(--vp-c-text-2); }
.sd-pair-btn:disabled { cursor: default; opacity: 0.5; }
.sd-pair-btn.active { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }

/* ── Sleep chart ─────────────────────────────────────────────────────────────── */
.sd-chart {
  display: flex; gap: 0.35rem;
  padding: 0.75rem 0.5rem 0.65rem;
  border: 1px solid var(--vp-c-divider); margin-bottom: 0.75rem;
}
.sd-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.28rem; }
.sd-bar-val { font-size: 0.65rem; color: var(--vp-c-text-2); height: 0.85rem; line-height: 1; }
.sd-bar-track {
  width: 100%; height: 72px; background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider); display: flex; align-items: flex-end; overflow: hidden;
}
.sd-bar { width: 100%; min-height: 0; transition: height 0.4s ease; background: var(--vp-c-brand-1); opacity: 0.5; }
.sd-bar-ok  { opacity: 0.7; }
.sd-bar-low { background: #f59e0b; opacity: 0.75; }
.sd-bar-lbl { font-size: 0.68rem; color: var(--vp-c-text-2); }

/* ── Card structure ──────────────────────────────────────────────────────────── */
.sd-card-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 1rem; border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}
.sd-card-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--vp-c-text-2); font-weight: 600; }
.sd-card-body { padding: 1rem; }
.sd-music-body { padding: 0; }
.sd-music-body :deep(.sp) { max-width: none; margin: 0; }

/* ── Notes two-pane editor ───────────────────────────────────────────────────── */
.sd-view-toggle {
  display: flex; gap: 0.1rem;
  border: 1px solid var(--vp-c-divider); overflow: hidden;
}
.sd-view-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.72rem; padding: 0.25rem 0.55rem;
  cursor: pointer; transition: background 0.1s, color 0.1s;
  border-right: 1px solid var(--vp-c-divider); line-height: 1.4;
}
.sd-view-btn:last-child { border-right: none; }
.sd-view-btn:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.sd-view-btn.active { background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent); color: var(--vp-c-brand-1); }

.sd-notes-body { display: none; } /* shown on desktop only */

.sd-notes-layout {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}

.sd-notes-sidebar {
  width: 185px; flex-shrink: 0;
  border-right: 1px solid var(--vp-c-divider);
  display: flex; flex-direction: column; overflow: hidden;
}

.sd-new-note-btn {
  display: block; width: 100%; background: none;
  border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.6rem 0.85rem; text-align: left;
  font: inherit; font-size: 0.82rem; color: var(--vp-c-brand-1);
  cursor: pointer; flex-shrink: 0; transition: background 0.1s;
}
.sd-new-note-btn:hover { background: color-mix(in srgb, var(--vp-c-brand-1) 7%, transparent); }

.sd-notes-list-desktop { flex: 1; overflow-y: auto; }

.sd-note-list-item {
  display: block; width: 100%; text-align: left;
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.6rem 0.85rem; cursor: pointer; transition: background 0.1s;
}
.sd-note-list-item:hover { background: var(--vp-c-bg-soft); }
.sd-note-list-item.active { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }
.sd-note-list-title {
  font-size: 0.85rem; color: var(--vp-c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;
}
.sd-note-list-date { font-size: 0.7rem; color: var(--vp-c-text-3); margin-top: 0.2rem; }

/* ── Notes search ────────────────────────────────────────────────────────────── */
.sd-notes-search-wrap {
  position: relative; flex-shrink: 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.sd-notes-search {
  display: block; width: 100%; background: none; border: none;
  color: var(--vp-c-text-1); font: inherit; font-size: 0.82rem;
  padding: 0.5rem 1.8rem 0.5rem 0.85rem;
  outline: none; transition: background 0.1s;
}
.sd-notes-search::placeholder { color: var(--vp-c-text-3); }
.sd-notes-search:focus { background: var(--vp-c-bg-soft); }
.sd-search-clear {
  position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: var(--vp-c-text-3);
  font: inherit; font-size: 1rem; line-height: 1; padding: 0.2rem 0.35rem;
  cursor: pointer; transition: color 0.1s;
}
.sd-search-clear:hover { color: var(--vp-c-text-1); }

.sd-notes-search-mobile {
  padding: 0; border-bottom: 1px solid var(--vp-c-divider);
}
.sd-notes-search-mobile .sd-notes-search {
  font-size: 0.95rem; padding: 0.75rem 2rem 0.75rem 1rem;
}

/* Fuzzy match highlight */
.sd-note-list-title :deep(mark),
.sd-note-list-item-mobile .sd-note-list-title :deep(mark) {
  background: color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
  color: var(--vp-c-brand-1); border-radius: 2px; font-weight: 600;
  padding: 0 1px;
}

.sd-notes-editor-pane {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; min-width: 0;
}

.sd-notes-empty-state {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 0.3rem; font-size: 0.875rem; color: var(--vp-c-text-2); opacity: 0.6;
}
.sd-new-inline { text-decoration: underline; font-size: 0.875rem; }

.sd-note-title-input {
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); font: inherit; font-size: 1rem; font-weight: 600;
  padding: 0.7rem 0.9rem; outline: none; width: 100%;
  transition: border-color 0.15s; flex-shrink: 0;
}
.sd-note-title-input:focus { border-bottom-color: var(--vp-c-brand-1); }
.sd-note-title-input::placeholder { color: var(--vp-c-text-3); font-weight: 400; }

/* Markdown toolbar */
.sd-md-toolbar {
  display: flex; align-items: center; gap: 0.1rem;
  padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0; flex-wrap: wrap; min-height: 36px;
}
.sd-tb-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.82rem; padding: 0.25rem 0.45rem;
  cursor: pointer; line-height: 1; border-radius: 3px;
  transition: background 0.1s, color 0.1s;
  display: flex; align-items: center; justify-content: center;
}
.sd-tb-btn:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.sd-tb-btn.active { background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent); color: var(--vp-c-brand-1); }
.sd-tb-sep { width: 1px; height: 16px; background: var(--vp-c-divider); margin: 0 0.2rem; align-self: center; }
.sd-tb-spacer { flex: 1; }
.sd-save-btn {
  background: none; border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  font: inherit; font-size: 0.75rem; padding: 0.2rem 0.6rem;
  cursor: pointer; transition: background 0.1s; border-radius: 2px;
}
.sd-save-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }
.sd-save-btn:disabled { opacity: 0.4; cursor: default; }
.sd-saved-text { font-size: 0.72rem; color: var(--vp-c-text-3); padding: 0.2rem 0.4rem; }
.sd-tb-del-btn {
  background: none; border: none; color: var(--vp-c-text-3);
  font: inherit; font-size: 1.1rem; padding: 0 0.35rem; line-height: 1;
  cursor: pointer; opacity: 0.5; transition: opacity 0.15s, color 0.15s;
}
.sd-tb-del-btn:hover { opacity: 1; color: #f43f5e; }

/* Editor/preview panes */
.sd-md-panes {
  flex: 1; display: flex; overflow: hidden; min-height: 0;
}
.sd-view-edit .sd-md-editor { flex: 1; }
.sd-view-preview .sd-md-preview { flex: 1; }
.sd-view-split .sd-md-editor { flex: 1; border-right: 1px solid var(--vp-c-divider); }
.sd-view-split .sd-md-preview { flex: 1; }

.sd-md-editor {
  flex: 1; resize: none; overflow-y: auto;
  border: none !important; outline: none;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.875rem; line-height: 1.7;
  padding: 0.85rem 1rem;
  transition: background 0.15s;
}
.sd-md-editor::placeholder { color: var(--vp-c-text-3); font-family: inherit; }

.sd-md-preview {
  flex: 1; overflow-y: auto;
  padding: 0.85rem 1.1rem;
  font-size: 0.9rem; line-height: 1.7; color: var(--vp-c-text-1);
}

/* Markdown rendered styles */
.sd-md-preview :deep(h1) { font-size: 1.45em; font-weight: 700; margin: 0 0 0.8rem; line-height: 1.3; }
.sd-md-preview :deep(h2) { font-size: 1.2em; font-weight: 600; margin: 1.2rem 0 0.55rem; border-bottom: 1px solid var(--vp-c-divider); padding-bottom: 0.3rem; }
.sd-md-preview :deep(h3) { font-size: 1.05em; font-weight: 600; margin: 1rem 0 0.45rem; }
.sd-md-preview :deep(p) { margin: 0 0 0.8rem; }
.sd-md-preview :deep(ul), .sd-md-preview :deep(ol) { margin: 0 0 0.8rem; padding-left: 1.5em; }
.sd-md-preview :deep(li) { margin: 0.25rem 0; }
.sd-md-preview :deep(li p) { margin: 0; }
.sd-md-preview :deep(code) {
  font-family: 'JetBrains Mono', monospace; font-size: 0.875em;
  background: var(--vp-c-bg-soft); padding: 0.1em 0.4em; border-radius: 3px;
}
.sd-md-preview :deep(pre) {
  background: var(--vp-c-bg-soft); padding: 0.85rem 1rem;
  overflow-x: auto; margin: 0 0 0.8rem; border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
}
.sd-md-preview :deep(pre code) { background: none; padding: 0; font-size: 0.85em; }
.sd-md-preview :deep(blockquote) {
  border-left: 3px solid var(--vp-c-brand-1); margin: 0 0 0.8rem;
  padding: 0.3rem 0.85rem; opacity: 0.85;
}
.sd-md-preview :deep(a) { color: var(--vp-c-brand-1); text-decoration: none; }
.sd-md-preview :deep(a:hover) { text-decoration: underline; }
.sd-md-preview :deep(hr) { border: none; border-top: 1px solid var(--vp-c-divider); margin: 1.2rem 0; }
.sd-md-preview :deep(table) { width: 100%; border-collapse: collapse; margin: 0 0 0.8rem; font-size: 0.875em; }
.sd-md-preview :deep(th), .sd-md-preview :deep(td) { padding: 0.4rem 0.65rem; border: 1px solid var(--vp-c-divider); }
.sd-md-preview :deep(th) { background: var(--vp-c-bg-soft); font-weight: 600; }
.sd-md-preview :deep(img) { max-width: 100%; border-radius: 4px; }
.sd-md-preview :deep(strong) { font-weight: 600; }
.sd-md-preview :deep(em) { font-style: italic; }
.sd-md-preview :deep(del) { text-decoration: line-through; opacity: 0.6; }
.sd-md-preview :deep(*:last-child) { margin-bottom: 0; }

/* ── Feeds layout ───────────────────────────────────────────────────────────── */
.sd-feeds-layout {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}
.sd-feeds-sidebar {
  width: 200px; flex-shrink: 0;
  border-right: 1px solid var(--vp-c-divider);
  display: flex; flex-direction: column; overflow: hidden;
}
.sd-feeds-sidebar-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}
.sd-feeds-sidebar-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--vp-c-text-3); }
.sd-feeds-refresh-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.9rem; padding: 0.1rem 0.3rem;
  cursor: pointer; line-height: 1; transition: color 0.15s;
}
.sd-feeds-refresh-btn:hover { color: var(--vp-c-brand-1); }
.sd-feeds-item-refresh {
  background: none; border: none; color: var(--vp-c-text-3);
  font: inherit; font-size: 0.75rem; padding: 0 0.2rem;
  cursor: pointer; line-height: 1; opacity: 0; transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
}
.sd-feed-item:hover .sd-feeds-item-refresh { opacity: 1; }
.sd-feeds-item-refresh:hover { color: var(--vp-c-brand-1); opacity: 1 !important; }
.sd-feeds-list { flex: 1; overflow-y: auto; }
.sd-feed-item {
  display: flex; align-items: center; gap: 0.4rem; width: 100%;
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.6rem 0.75rem; cursor: pointer; text-align: left;
  font: inherit; color: inherit; transition: background 0.1s;
}
.sd-feed-item:hover { background: var(--detail-lt); }
.sd-feed-item.active { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }
.sd-feed-name { flex: 1; font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
.sd-feed-rename-input {
  flex: 1; min-width: 0; font: inherit; font-size: 0.82rem;
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-brand-1);
  color: inherit; padding: 0.1rem 0.25rem; outline: none;
}
.sd-feed-badge {
  font-size: 0.65rem; background: var(--vp-c-brand-1); color: #fff;
  border-radius: 999px; padding: 0.1em 0.45em; flex-shrink: 0; line-height: 1.5;
}
.sd-feeds-add {
  padding: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem;
  border-top: 1px solid var(--vp-c-divider); flex-shrink: 0;
}
.sd-feeds-add .sd-input { font-size: 0.8rem; padding: 0.35rem 0.55rem; }
.sd-feeds-add .sd-submit-btn { font-size: 0.8rem; padding: 0.35rem 0.65rem; align-self: flex-end; }
.sd-feeds-articles { flex: 1; overflow-y: auto; min-width: 0; display: flex; flex-direction: column; }
.sd-articles-hd {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0; flex-wrap: wrap;
}
.sd-feeds-search {
  flex: 1; min-width: 80px; background: none; border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); font: inherit; font-size: 0.78rem;
  padding: 0.2rem 0.5rem; outline: none; transition: border-color 0.15s;
}
.sd-feeds-search::placeholder { color: var(--vp-c-text-3); }
.sd-feeds-search:focus { border-color: var(--vp-c-brand-1); }
.sd-feeds-filter-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2);
  font: inherit; font-size: 0.72rem; padding: 0.18rem 0.5rem;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.sd-feeds-filter-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.sd-feeds-filter-btn.active {
  border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent);
}
.sd-feeds-markall-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2);
  font: inherit; font-size: 0.72rem; padding: 0.18rem 0.5rem;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.sd-feeds-markall-btn:hover { border-color: var(--vp-c-text-2); color: var(--vp-c-text-1); }
.sd-articles-list { display: flex; flex-direction: column; }
.sd-article-row {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  color: inherit;
  transition: background 0.1s;
}
.sd-article-row:hover { background: var(--vp-c-bg-soft); }
.sd-article-row:last-child { border-bottom: none; }
.sd-article-read { opacity: 0.4; }
.sd-article-focused { background: color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent) !important; outline: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent); }
.sd-article-row-main { flex: 1; min-width: 0; }
.sd-article-link { display: block; text-decoration: none; color: inherit; }
.sd-article-link:hover .sd-article-title { text-decoration: underline; }
.sd-article-title { font-size: 0.875rem; color: var(--vp-c-brand-1); font-weight: 500; line-height: 1.4; margin-bottom: 0.2rem; }
.sd-article-summary { font-size: 0.78rem; color: var(--vp-c-text-2); line-height: 1.45; margin-bottom: 0.25rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sd-article-meta { font-size: 0.7rem; color: var(--vp-c-text-3); }
.sd-article-actions { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; padding-top: 0.1rem; }
.sd-article-later-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-3);
  font: inherit; font-size: 0.68rem; padding: 0.1rem 0.4rem;
  cursor: pointer; white-space: nowrap; opacity: 0;
  transition: opacity 0.15s, border-color 0.15s, color 0.15s;
}
.sd-article-row:hover .sd-article-later-btn { opacity: 1; }
.sd-article-later-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); opacity: 1; }

/* ── Mobile feeds articles header ───────────────────────────────────────────── */
.sd-feeds-mobile-articles-hd { display: flex; flex-direction: column; border-bottom: 1px solid var(--vp-c-divider); flex-shrink: 0; }
.sd-feeds-mobile-controls { display: flex; align-items: center; gap: 0.3rem; padding: 0.4rem 0.75rem; flex-wrap: wrap; }

/* ── Mobile base ─────────────────────────────────────────────────────────────── */
.sd-grid { display: none; }
.sd-notes-body { display: none; }

.sd-wrap {
  display: flex; flex-direction: column;
  height: calc(100dvh - var(--vp-nav-height, 64px));
  overflow: hidden;
}

.sd-mobile {
  flex: 1; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--vp-c-bg);
}

.sd-mobile-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  position: sticky; top: 0; z-index: 10;
  min-height: 48px;
}
.sd-mobile-panel { padding: 1rem 1rem 1.5rem; }
.sd-mobile-panel :deep(.sp) { max-width: none; margin: 0; }

/* Mobile back button */
.sd-back-btn {
  background: none; border: none; color: var(--vp-c-text-1);
  font: inherit; font-size: 1.1rem; padding: 0 0.5rem 0 0;
  cursor: pointer; flex-shrink: 0; line-height: 1;
}

/* Notes title input in mobile header */
.sd-note-title-hd-input {
  flex: 1; background: none; border: none; outline: none;
  color: var(--vp-c-text-1); font: inherit; font-size: 0.95rem; font-weight: 600;
  padding: 0 0.5rem; min-width: 0;
}
.sd-note-title-hd-input::placeholder { color: var(--vp-c-text-3); font-weight: 400; }

.sd-hd-save-status {
  font-size: 0.75rem; color: var(--vp-c-text-3);
  flex-shrink: 0; padding: 0 0.25rem;
}

/* Tab bar */
.sd-tabbar {
  flex-shrink: 0; display: flex;
  background: var(--vp-c-bg);
  border-top: 1px solid var(--vp-c-divider);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.sd-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
  padding: 0.5rem 0.25rem 0.45rem; background: none; border: none;
  color: var(--vp-c-text-3); font: inherit; cursor: pointer; transition: color 0.15s;
}
.sd-tab.active { color: var(--vp-c-brand-1); }
.sd-tab-icon { font-size: 1.05rem; }
.sd-tab-lbl { font-size: 0.62rem; }

/* ── Mobile notes panel ──────────────────────────────────────────────────────── */
.sd-mobile-panel-notes { padding: 0; display: flex; flex-direction: column; }

.sd-notes-list-mobile { padding: 0; }
.sd-note-list-item-mobile {
  display: block; width: 100%; text-align: left;
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.85rem 1rem; cursor: pointer; transition: background 0.1s;
}
.sd-note-list-item-mobile:hover { background: var(--vp-c-bg-soft); }
.sd-note-list-item-mobile .sd-note-list-title {
  font-size: 0.95rem; font-weight: 500; color: var(--vp-c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sd-note-list-item-mobile .sd-note-list-preview {
  font-size: 0.8rem; color: var(--vp-c-text-2); margin-top: 0.25rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sd-note-list-item-mobile .sd-note-list-date {
  font-size: 0.72rem; color: var(--vp-c-text-3); margin-top: 0.3rem;
}
.sd-notes-empty-mobile { padding: 3rem 1rem; line-height: 1.7; }
.sd-notes-empty-mobile small { opacity: 0.6; }

/* FAB */
.sd-mobile-fab {
  position: fixed; right: 1.25rem;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 4rem);
  width: 3.25rem; height: 3.25rem; border-radius: 50%;
  background: var(--vp-c-brand-1); color: #fff;
  border: none; font: inherit; font-size: 1.6rem; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(124,58,237,0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 20;
}
.sd-mobile-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(124,58,237,0.5); }
.sd-mobile-fab:active { transform: scale(0.95); }

/* Mobile markdown toolbar */
.sd-mobile-md-toolbar {
  display: flex; align-items: center; gap: 0.05rem;
  padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--vp-c-divider);
  position: sticky; top: 0; z-index: 9;
  background: var(--vp-c-bg); flex-shrink: 0;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
}
.sd-mobile-md-toolbar .sd-tb-btn {
  font-size: 0.9rem; padding: 0.35rem 0.55rem; flex-shrink: 0;
}
.sd-preview-toggle {
  font-size: 0.75rem !important;
  border: 1px solid var(--vp-c-divider) !important;
  border-radius: 3px !important;
  padding: 0.2rem 0.5rem !important;
  color: var(--vp-c-text-2) !important;
}
.sd-preview-toggle.active { border-color: var(--vp-c-brand-1) !important; color: var(--vp-c-brand-1) !important; }

/* Mobile editor body */
.sd-mobile-editor-body {
  flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
  display: flex; flex-direction: column;
}
.sd-mobile-editor-ta {
  flex: 1; min-height: calc(100dvh - 230px);
  resize: none; border: none !important; outline: none;
  padding: 1rem; font-size: 1rem !important; line-height: 1.75;
}
.sd-mobile-preview {
  flex: 1; padding: 1rem;
  min-height: calc(100dvh - 230px);
}

.sd-mobile-editor-footer {
  padding: 0.75rem 1rem; border-top: 1px solid var(--vp-c-divider);
  display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}
.sd-del-note-mobile {
  background: none; border: none; color: #f43f5e;
  font: inherit; font-size: 0.82rem; padding: 0; cursor: pointer; opacity: 0.7;
  transition: opacity 0.15s;
}
.sd-del-note-mobile:hover { opacity: 1; }
.sd-new-note-hint {
  font-size: 0.75rem; color: var(--vp-c-text-3); font-style: italic;
}

/* ── Mobile feeds panel ─────────────────────────────────────────────────────── */
.sd-mobile-panel-feeds { padding: 0; display: flex; flex-direction: column; }
.sd-feeds-mobile-add { display: flex; gap: 0.4rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--vp-c-divider); }
.sd-feeds-mobile-add .sd-input { flex: 1; }
@media (max-width: 767px) {
  .sd-article-later-btn { opacity: 1 !important; }
}
.sd-feeds-back-btn {
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2); font: inherit; font-size: 0.85rem;
  padding: 0.65rem 1rem; cursor: pointer; text-align: left; width: 100%;
  transition: color 0.15s; flex-shrink: 0;
}
.sd-feeds-back-btn:hover { color: var(--vp-c-text-1); }
.sd-feeds-mobile-articles-hd .sd-feeds-back-btn { border-bottom: none; }

/* ── Desktop ─────────────────────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .sd-wrap { display: block; height: auto; overflow: visible; max-width: 80rem; margin: 1.5rem auto; padding: 0 1.25rem 2rem; }

  .sd-grid {
    display: grid;
    grid-template-columns: 1fr 1.65fr;
    grid-template-areas:
      "music    notes"
      "sleep    notes"
      "later    notes"
      "ideas    ideas"
      "projects projects"
      "feeds    feeds"
      "ama      ama";
    gap: 1rem;
  }

  .sd-card {
    border: 1px solid var(--vp-c-divider);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sd-area-music    { grid-area: music; align-self: start; }
  .sd-area-notes    { grid-area: notes; align-self: stretch; min-height: 520px; }
  .sd-area-sleep    { grid-area: sleep; align-self: start; }
  .sd-area-later    { grid-area: later; align-self: start; }
  .sd-area-ideas    { grid-area: ideas; }
  .sd-area-projects { grid-area: projects; height: 440px; }
  .sd-area-feeds    { grid-area: feeds; height: 480px; }

  /* Cap heights for small cards */
  .sd-area-music .sd-card-body { max-height: 420px; overflow-y: auto; }
  .sd-area-later .sd-list-scroll { max-height: 260px; }

  /* Notes two-pane body */
  .sd-notes-body {
    display: flex; flex-direction: column; flex: 1;
    padding: 0; overflow: hidden; min-height: 0;
  }

  /* ── Light mode ── */
  html.light .sd-card { background: #fff; border-color: rgba(124,58,237,0.22); }
  html.light .sd-card-hd { background: rgba(226,217,255,0.6); border-bottom-color: rgba(124,58,237,0.18); }
  html.light .sd-card .sd-input,
  html.light .sd-card .sd-textarea { background: #f9f7ff; border-color: rgba(124,58,237,0.25); }
  html.light .sd-card .sd-list { border-color: rgba(124,58,237,0.18); }
  html.light .sd-card .sd-row,
  html.light .sd-card .sd-note-item { border-bottom-color: rgba(124,58,237,0.1); }
  html.light .sd-card .sd-row:hover,
  html.light .sd-card .sd-note-item:hover { background: rgba(124,58,237,0.06); }
  html.light .sd-card .sd-chart { border-color: rgba(124,58,237,0.15); }
  html.light .sd-card .sd-bar-track { background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.12); }
  html.light .sd-card .sd-pair-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-card .sd-submit-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-card .sd-mic-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-card .sd-idea-card { border-color: rgba(124,58,237,0.14); }
  html.light .sd-card .sd-idea-card:hover { background: rgba(124,58,237,0.05); }
  html.light .sd-card .sd-interim { background: rgba(124,58,237,0.06); }

  html.light .sd-notes-sidebar { border-right-color: rgba(124,58,237,0.15); }
  html.light .sd-new-note-btn { border-bottom-color: rgba(124,58,237,0.15); }
  html.light .sd-note-list-item { border-bottom-color: rgba(124,58,237,0.1); }
  html.light .sd-note-list-item:hover { background: rgba(124,58,237,0.05); }
  html.light .sd-note-list-item.active { background: rgba(124,58,237,0.1); }
  html.light .sd-note-title-input { border-bottom-color: rgba(124,58,237,0.18); }
  html.light .sd-md-toolbar { border-bottom-color: rgba(124,58,237,0.15); }
  html.light .sd-tb-sep { background: rgba(124,58,237,0.18); }
  html.light .sd-view-toggle { border-color: rgba(0,0,0,0.15); }
  html.light .sd-view-btn { border-right-color: rgba(0,0,0,0.12); }
  html.light .sd-md-editor { background: #fdfcff; }
  html.light .sd-view-split .sd-md-editor { border-right-color: rgba(124,58,237,0.15) !important; }
  html.light .sd-md-preview :deep(code) { background: rgba(124,58,237,0.07); }
  html.light .sd-md-preview :deep(pre) { background: rgba(124,58,237,0.05); border-color: rgba(124,58,237,0.12); }

  /* Light mode SecretPlayer overrides */
  html.light .sd-music-body :deep(.sp-playlist) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-music-body :deep(.sp-playlist-header:hover) { background: rgba(0,0,0,0.04); }
  html.light .sd-music-body :deep(.sp-list) { border-top-color: rgba(0,0,0,0.08); }
  html.light .sd-music-body :deep(.sp-track) { border-bottom-color: rgba(0,0,0,0.06); }
  html.light .sd-music-body :deep(.sp-track:hover) { background: rgba(124,58,237,0.07); }
  html.light .sd-music-body :deep(.sp-track-active) { background: rgba(124,58,237,0.12); }
  html.light .sd-music-body :deep(.sp-controls) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-music-body :deep(.sp-widget) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-music-body :deep(.sp-widget-input) {
    background: #f9f7ff; border-color: rgba(0,0,0,0.15); color: var(--vp-c-text-1);
  }
  html.light .sd-music-body :deep(.sp-widget-btn) { border-color: rgba(0,0,0,0.18); }
  html.light .sd-music-body :deep(.sp-widget-code) { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); }

  /* ── Dark mode ── */
  html:not(.light) .sd-card { background: #1e1b2e; border-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-card-hd { background: rgba(167,139,250,0.1); border-bottom-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-card .sd-input,
  html:not(.light) .sd-card .sd-textarea { background: #141120; border-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-card .sd-list { border-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-card .sd-row,
  html:not(.light) .sd-card .sd-note-item { border-bottom-color: rgba(167,139,250,0.1); }
  html:not(.light) .sd-card .sd-row:hover,
  html:not(.light) .sd-card .sd-note-item:hover { background: rgba(167,139,250,0.07); }
  html:not(.light) .sd-card .sd-chart { border-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-card .sd-bar-track { background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-card .sd-pair-btn { border-color: rgba(167,139,250,0.25); }
  html:not(.light) .sd-card .sd-submit-btn { border-color: rgba(167,139,250,0.25); }
  html:not(.light) .sd-card .sd-mic-btn { border-color: rgba(167,139,250,0.25); }
  html:not(.light) .sd-card .sd-idea-card { border-color: rgba(167,139,250,0.15); background: rgba(167,139,250,0.04); }
  html:not(.light) .sd-card .sd-idea-card:hover { background: rgba(167,139,250,0.09); }

  html:not(.light) .sd-notes-sidebar { border-right-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-new-note-btn { border-bottom-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-note-list-item { border-bottom-color: rgba(167,139,250,0.1); }
  html:not(.light) .sd-note-list-item:hover { background: rgba(167,139,250,0.07); }
  html:not(.light) .sd-note-list-item.active { background: rgba(167,139,250,0.12); }
  html:not(.light) .sd-note-title-input { border-bottom-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-md-toolbar { border-bottom-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-tb-sep { background: rgba(167,139,250,0.2); }
  html:not(.light) .sd-view-toggle { border-color: rgba(167,139,250,0.25); }
  html:not(.light) .sd-view-btn { border-right-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-md-editor { background: #141120; }
  html:not(.light) .sd-view-split .sd-md-editor { border-right-color: rgba(167,139,250,0.15) !important; }
  html:not(.light) .sd-md-preview :deep(code) { background: rgba(167,139,250,0.1); }
  html:not(.light) .sd-md-preview :deep(pre) { background: rgba(167,139,250,0.06); border-color: rgba(167,139,250,0.15); }

  /* Hide mobile UI */
  .sd-tabbar { display: none; }
  .sd-mobile-hd { display: none; }
  .sd-mobile { display: none; }
  .sd-mobile-fab { display: none; }
}

/* ── Explicit mobile theming ─────────────────────────────────────────────────── */
@media (max-width: 767px) {
  /* Dark mode mobile */
  html:not(.light) .sd-mobile { background: #100d20; }
  html:not(.light) .sd-mobile-hd { background: #100d20; border-bottom-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-tabbar { background: #100d20; border-top-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-mobile-panel .sd-list { border-color: rgba(167,139,250,0.18); }
  html:not(.light) .sd-mobile-panel .sd-row,
  html:not(.light) .sd-mobile-panel .sd-note-item { border-bottom-color: rgba(167,139,250,0.1); }
  html:not(.light) .sd-mobile-panel .sd-row:hover,
  html:not(.light) .sd-mobile-panel .sd-note-item:hover { background: rgba(167,139,250,0.07); }
  html:not(.light) .sd-mobile-panel .sd-input,
  html:not(.light) .sd-mobile-panel .sd-textarea { background: #0d0a18; border-color: rgba(167,139,250,0.22); }
  html:not(.light) .sd-mobile-panel .sd-pair-btn { border-color: rgba(167,139,250,0.28); }
  html:not(.light) .sd-mobile-panel .sd-chart { border-color: rgba(167,139,250,0.18); }
  html:not(.light) .sd-mobile-panel .sd-bar-track { background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.15); }
  html:not(.light) .sd-mobile-panel .sd-idea-card { background: rgba(167,139,250,0.05); border-color: rgba(167,139,250,0.15); }

  /* Notes list items - dark */
  html:not(.light) .sd-note-list-item-mobile { border-bottom-color: rgba(167,139,250,0.12); }
  html:not(.light) .sd-note-list-item-mobile:hover { background: rgba(167,139,250,0.07); }
  html:not(.light) .sd-mobile-md-toolbar { background: #100d20; border-bottom-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-mobile-editor-footer { border-top-color: rgba(167,139,250,0.2); }
  html:not(.light) .sd-md-editor { background: #0d0a18; color: #e2d9f3; }
  html:not(.light) .sd-md-preview { color: #e2d9f3; }

  /* Light mode mobile */
  html.light .sd-mobile { background: #fff; }
  html.light .sd-mobile-hd { background: #fff; border-bottom-color: rgba(124,58,237,0.18); }
  html.light .sd-tabbar { background: #fff; border-top-color: rgba(124,58,237,0.18); }
  html.light .sd-mobile-panel .sd-list { border-color: rgba(124,58,237,0.2); }
  html.light .sd-mobile-panel .sd-row,
  html.light .sd-mobile-panel .sd-note-item { border-bottom-color: rgba(124,58,237,0.1); }
  html.light .sd-mobile-panel .sd-row:hover,
  html.light .sd-mobile-panel .sd-note-item:hover { background: rgba(124,58,237,0.06); }
  html.light .sd-mobile-panel .sd-input,
  html.light .sd-mobile-panel .sd-textarea { background: #f5f0ff; border-color: rgba(124,58,237,0.28); }
  html.light .sd-mobile-panel .sd-pair-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-mobile-panel .sd-submit-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-mobile-panel .sd-mic-btn { border-color: rgba(0,0,0,0.18); }
  html.light .sd-mobile-panel .sd-chart { border-color: rgba(124,58,237,0.18); }
  html.light .sd-mobile-panel .sd-bar-track { background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.14); }
  html.light .sd-mobile-panel .sd-idea-card { background: #faf8ff; border-color: rgba(124,58,237,0.16); }
  html.light .sd-mobile-panel .sd-idea-card:hover { background: rgba(124,58,237,0.06); }
  html.light .sd-mobile-panel .sd-interim { background: rgba(124,58,237,0.07); }

  /* Notes list items - light */
  html.light .sd-note-list-item-mobile { border-bottom-color: rgba(124,58,237,0.12); }
  html.light .sd-note-list-item-mobile:hover { background: rgba(124,58,237,0.04); }
  html.light .sd-mobile-md-toolbar { background: #fff; border-bottom-color: rgba(124,58,237,0.18); }
  html.light .sd-mobile-editor-footer { border-top-color: rgba(124,58,237,0.15); }
  html.light .sd-md-editor { background: #fdfcff; color: #213547; }
  html.light .sd-md-preview { color: #213547; }

  /* SecretPlayer light mode overrides */
  html.light .sd-mobile-panel :deep(.sp-playlist) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-mobile-panel :deep(.sp-playlist-header:hover) { background: rgba(0,0,0,0.04); }
  html.light .sd-mobile-panel :deep(.sp-list) { border-top-color: rgba(0,0,0,0.08); }
  html.light .sd-mobile-panel :deep(.sp-track) { border-bottom-color: rgba(0,0,0,0.06); }
  html.light .sd-mobile-panel :deep(.sp-track:hover) { background: rgba(124,58,237,0.07); }
  html.light .sd-mobile-panel :deep(.sp-track-active) { background: rgba(124,58,237,0.12); }
  html.light .sd-mobile-panel :deep(.sp-controls) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-mobile-panel :deep(.sp-widget) { border-color: rgba(0,0,0,0.1); }
  html.light .sd-mobile-panel :deep(.sp-widget-input) {
    background: #f5f0ff; border-color: rgba(0,0,0,0.15); color: #213547;
  }
  html.light .sd-mobile-panel :deep(.sp-widget-btn) { border-color: rgba(0,0,0,0.18); }
}

/* ── Transition ──────────────────────────────────────────────────────────────── */
.sd-fade-enter-active, .sd-fade-leave-active { transition: opacity 0.2s; }
.sd-fade-enter-from,  .sd-fade-leave-to      { opacity: 0; }

/* ── AMA ─────────────────────────────────────────────────────────────────────── */
.sd-area-ama { grid-area: ama; }
.sd-ama-body { padding: 0; overflow-y: auto; max-height: 500px; }
.sd-ama-list { display: flex; flex-direction: column; }
.sd-ama-item {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  display: flex; flex-direction: column; gap: 0.5rem;
}
.sd-ama-item:last-child { border-bottom: none; }
.sd-ama-answered { opacity: 0.65; }
.sd-ama-answered:hover { opacity: 1; }
.sd-ama-q-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.sd-ama-question { font-size: 0.9rem; color: var(--vp-c-text-1); line-height: 1.5; font-weight: 500; flex: 1; }
.sd-ama-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.sd-ama-name { font-size: 0.75rem; color: var(--vp-c-brand-1); }
.sd-ama-date { font-size: 0.72rem; color: var(--vp-c-text-3); }
.sd-ama-existing-answer { font-size: 0.82rem; color: var(--vp-c-text-2); line-height: 1.5; padding: 0.45rem 0.65rem; background: var(--vp-c-bg-soft); border-left: 2px solid var(--vp-c-brand-1); white-space: pre-wrap; }
.sd-ama-answer-row { display: flex; gap: 0.5rem; align-items: flex-start; }
.sd-ama-textarea { resize: none; flex: 1; }
.sd-ama-item-mobile { padding: 0.85rem 0; border-bottom: 1px solid var(--vp-c-divider); }
.sd-ama-item-mobile:last-child { border-bottom: none; }

/* ── Projects ─────────────────────────────────────────────────────────────────── */
.sd-proj-layout {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}
.sd-proj-sidebar {
  width: 200px; flex-shrink: 0;
  border-right: 1px solid var(--vp-c-divider);
  display: flex; flex-direction: column; overflow: hidden;
}
.sd-proj-add {
  display: flex; gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}
.sd-proj-add .sd-input { flex: 1; font-size: 0.8rem; padding: 0.3rem 0.5rem; }
.sd-proj-add .sd-submit-btn { font-size: 0.8rem; padding: 0.3rem 0.65rem; }
.sd-proj-list { flex: 1; overflow-y: auto; }
.sd-proj-item {
  display: flex; align-items: center; gap: 0.5rem; width: 100%;
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.6rem 0.75rem; cursor: pointer; text-align: left;
  font: inherit; color: inherit; transition: background 0.1s;
}
.sd-proj-item:hover { background: var(--vp-c-bg-soft); }
.sd-proj-item.active { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }
.sd-proj-item-name { flex: 1; font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Status dots */
.sd-proj-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.sd-proj-dot-active { background: #22c55e; }
.sd-proj-dot-paused { background: #f59e0b; }
.sd-proj-dot-done   { background: var(--vp-c-text-3); }
.sd-proj-dot-idea   { background: #60a5fa; }

/* Filter bar */
.sd-proj-filters {
  display: flex; gap: 0.1rem;
}
.sd-proj-filter-btn {
  background: none; border: none; color: var(--vp-c-text-3);
  font: inherit; font-size: 0.7rem; padding: 0.2rem 0.45rem;
  cursor: pointer; transition: color 0.1s, background 0.1s; border-radius: 3px;
}
.sd-proj-filter-btn:hover { color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); }
.sd-proj-filter-btn.active { color: var(--vp-c-brand-1); background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }

/* Detail pane */
.sd-proj-detail {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;
}
.sd-proj-detail-hd {
  padding: 0.6rem 0.85rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}
.sd-proj-name-input {
  display: block; width: 100%; background: none; border: none; outline: none;
  color: var(--vp-c-text-1); font: inherit; font-size: 1rem; font-weight: 600;
  padding: 0 0 0.5rem;
  transition: border-color 0.15s;
}
.sd-proj-name-input::placeholder { color: var(--vp-c-text-3); font-weight: 400; }

.sd-proj-status-row {
  display: flex; align-items: center; gap: 0.25rem; padding: 0.4rem 0; flex-wrap: wrap;
}
.sd-proj-status-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-3);
  font: inherit; font-size: 0.72rem; padding: 0.18rem 0.55rem;
  cursor: pointer; border-radius: 999px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.sd-proj-status-btn:hover { color: var(--vp-c-text-1); border-color: var(--vp-c-text-2); }
.sd-proj-status-btn-active.active  { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,0.1); }
.sd-proj-status-btn-paused.active  { border-color: #f59e0b; color: #f59e0b; background: rgba(245,158,11,0.1); }
.sd-proj-status-btn-done.active    { border-color: var(--vp-c-text-2); color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); }
.sd-proj-status-btn-idea.active    { border-color: #60a5fa; color: #60a5fa; background: rgba(96,165,250,0.1); }

.sd-proj-detail-body {
  flex: 1; overflow-y: auto; padding: 0.85rem;
  display: flex; flex-direction: column;
}
.sd-proj-field-label {
  font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--vp-c-text-3); margin-bottom: 0.3rem; display: block;
}
.sd-proj-nextstep {
  font-size: 0.9rem; resize: none;
  border-left: 2px solid var(--vp-c-brand-1) !important;
}
.sd-proj-desc { font-size: 0.875rem; resize: none; }
.sd-proj-updated { font-size: 0.7rem; color: var(--vp-c-text-3); margin-top: auto; padding-top: 0.5rem; }

/* Mobile projects */
.sd-mobile-panel-proj { padding: 0; display: flex; flex-direction: column; }
.sd-proj-mobile-top { padding: 0.75rem 1rem; border-bottom: 1px solid var(--vp-c-divider); display: flex; flex-direction: column; gap: 0.5rem; }
.sd-proj-filters-mobile { flex-wrap: wrap; }
.sd-proj-item-mobile {
  display: flex; align-items: flex-start; gap: 0.6rem; width: 100%;
  background: none; border: none; border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.75rem 1rem; cursor: pointer; text-align: left; font: inherit; color: inherit;
  transition: background 0.1s;
}
.sd-proj-item-mobile:hover { background: var(--vp-c-bg-soft); }
.sd-proj-item-mobile .sd-proj-dot { margin-top: 0.35rem; }
.sd-proj-item-body { flex: 1; min-width: 0; }
.sd-proj-item-mobile .sd-proj-item-name { font-size: 0.9rem; font-weight: 500; color: var(--vp-c-text-1); }
.sd-proj-item-next { font-size: 0.78rem; color: var(--vp-c-text-2); margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-proj-status-badge {
  font-size: 0.65rem; border-radius: 999px; padding: 0.1em 0.5em;
  border: 1px solid; flex-shrink: 0; align-self: flex-start; margin-top: 0.2rem;
}
.sd-proj-status-badge-active { border-color: #22c55e; color: #22c55e; }
.sd-proj-status-badge-paused { border-color: #f59e0b; color: #f59e0b; }
.sd-proj-status-badge-done   { border-color: var(--vp-c-text-3); color: var(--vp-c-text-3); }
.sd-proj-status-badge-idea   { border-color: #60a5fa; color: #60a5fa; }

.sd-proj-mobile-detail-hd {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.65rem 1rem; border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg); position: sticky; top: 0; z-index: 10;
}
.sd-proj-name-mobile-input {
  flex: 1; background: none; border: none; outline: none;
  color: var(--vp-c-text-1); font: inherit; font-size: 0.95rem; font-weight: 600; min-width: 0;
}

/* Stale indicator */
.sd-proj-item-stale .sd-proj-dot { box-shadow: 0 0 0 2px #f59e0b; }
.sd-proj-item-stale .sd-proj-item-name { color: var(--vp-c-text-2); }

/* Project page open button */
.sd-proj-page-btn {
  background: none; border: none; color: var(--vp-c-text-3);
  font: inherit; font-size: 0.8rem; padding: 0 0.3rem;
  cursor: pointer; opacity: 0; transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0; line-height: 1;
}
.sd-proj-item:hover .sd-proj-page-btn,
.sd-proj-item-mobile:hover .sd-proj-page-btn { opacity: 1; }
.sd-proj-page-btn:hover { color: var(--vp-c-brand-1); opacity: 1 !important; }

.sd-proj-open-page-btn {
  background: none; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2);
  font: inherit; font-size: 0.72rem; padding: 0.18rem 0.55rem;
  cursor: pointer; transition: border-color 0.15s, color 0.15s; flex-shrink: 0;
}
.sd-proj-open-page-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }

/* Search in sidebar */
.sd-proj-search-wrap {
  position: relative; flex-shrink: 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.sd-proj-search {
  display: block; width: 100%; background: none; border: none;
  color: var(--vp-c-text-1); font: inherit; font-size: 0.8rem;
  padding: 0.45rem 1.8rem 0.45rem 0.75rem; outline: none;
}
.sd-proj-search::placeholder { color: var(--vp-c-text-3); }
.sd-proj-search:focus { background: var(--vp-c-bg-soft); }

/* Filter count badge */
.sd-proj-filter-count {
  font-size: 0.6rem; opacity: 0.7; margin-left: 0.15rem;
}

/* Links section */
.sd-proj-links-section { margin-top: 0.75rem; }
.sd-proj-links-list { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.3rem; }
.sd-proj-link-row {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.sd-proj-link-row:last-of-type { border-bottom: none; }
.sd-proj-link-text {
  flex: 1; font-size: 0.82rem; color: var(--vp-c-brand-1);
  text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  min-width: 0;
}
.sd-proj-link-text:hover { text-decoration: underline; }
.sd-proj-link-add { display: flex; gap: 0.35rem; margin-top: 0.4rem; }
.sd-proj-link-add .sd-input { flex: 1; }

/* Mobile page btn always visible */
@media (max-width: 767px) {
  .sd-proj-page-btn { opacity: 1 !important; }
}

</style>
