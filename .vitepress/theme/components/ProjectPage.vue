<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'
import { marked } from 'marked'

const router = useRouter()

// ── Auth / connection ──────────────────────────────────────────────────────────
const ready     = ref(false)
const workerUrl = ref('')
const apiKey    = ref('')

// ── State ──────────────────────────────────────────────────────────────────────
type ProjectStatus = 'active' | 'paused' | 'done' | 'idea'
interface ProjectItem { id: string; name: string; status: ProjectStatus; description: string; nextStep: string; updatedAt: string; createdAt: string }

const project    = ref<ProjectItem | null>(null)
const body       = ref('')
const bodyDirty  = ref(false)
const bodySaving = ref(false)
const bodyErr    = ref('')
const noteView   = ref<'edit' | 'split' | 'preview'>('edit')
let lastFocused: HTMLTextAreaElement | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

// ── API ────────────────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${workerUrl.value}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.value, ...(opts.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Markdown ───────────────────────────────────────────────────────────────────
const rendered = computed(() => {
  if (!body.value.trim()) return '<p style="opacity:0.35; font-style:italic; margin:0;">nothing here yet…</p>'
  return marked.parse(body.value, { breaks: true, gfm: true } as any) as string
})

function scheduleAutoSave() {
  bodyDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { if (bodyDirty.value) saveBody() }, 1800)
}

async function saveBody() {
  if (!project.value) return
  if (saveTimer) clearTimeout(saveTimer)
  bodySaving.value = true; bodyErr.value = ''
  try {
    await apiFetch(`/api/projects/${project.value.id}/body`, { method: 'PATCH', body: JSON.stringify({ body: body.value }) })
    bodyDirty.value = false
  } catch (e: any) { bodyErr.value = e.message }
  bodySaving.value = false
}

function insertMd(before: string, after = '') {
  const el = lastFocused; if (!el) return
  const s = el.selectionStart, e = el.selectionEnd
  body.value = body.value.slice(0, s) + before + body.value.slice(s, e) + after + body.value.slice(e)
  scheduleAutoSave()
  nextTick(() => { el.focus(); el.setSelectionRange(s + before.length, e + before.length) })
}
function insertLine(prefix: string) {
  const el = lastFocused; if (!el) return
  const s = el.selectionStart
  const lineStart = body.value.lastIndexOf('\n', s - 1) + 1
  body.value = body.value.slice(0, lineStart) + prefix + body.value.slice(lineStart)
  scheduleAutoSave()
  nextTick(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length) })
}

// ── Status display ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e', paused: '#f59e0b', done: 'var(--vp-c-text-3)', idea: '#60a5fa'
}

// ── Mount ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (localStorage.getItem('sd_s') !== '1') { router.go('/'); return }
  const w = localStorage.getItem('sd_w'), k = localStorage.getItem('sd_k')
  if (!w || !k) { router.go('/secret'); return }
  workerUrl.value = w; apiKey.value = k

  const projId = localStorage.getItem('sd_active_proj')
  if (!projId) { router.go('/secret'); return }

  try {
    const [projData, bodyData] = await Promise.all([
      apiFetch(`/api/projects/${projId}`),
      apiFetch(`/api/projects/${projId}/body`),
    ])
    project.value = projData
    body.value = bodyData.body || ''
    ready.value = true
    nextTick(() => {
      const el = document.querySelector<HTMLTextAreaElement>('.pp-editor')
      if (el) { lastFocused = el; el.focus() }
    })
  } catch {
    router.go('/secret')
  }
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (bodyDirty.value) saveBody()
})
</script>

<template>
  <div v-if="ready && project" class="pp-wrap">

    <!-- Header -->
    <div class="pp-header">
      <button class="pp-back" @click="router.go('/secret')">← dashboard</button>
      <div class="pp-header-center">
        <span class="pp-project-name">{{ project.name }}</span>
        <span class="pp-status-dot" :style="{ background: STATUS_COLORS[project.status] }"></span>
        <span class="pp-status-label">{{ project.status }}</span>
      </div>
      <div class="pp-header-right">
        <div class="pp-view-toggle">
          <button :class="['pp-view-btn', { active: noteView === 'edit' }]" @click="noteView = 'edit'">edit</button>
          <button :class="['pp-view-btn', { active: noteView === 'split' }]" @click="noteView = 'split'">split</button>
          <button :class="['pp-view-btn', { active: noteView === 'preview' }]" @click="noteView = 'preview'">preview</button>
        </div>
        <p v-if="bodyErr" class="pp-err">{{ bodyErr }}</p>
        <button v-if="bodyDirty" class="pp-save-btn" @click="saveBody" :disabled="bodySaving">{{ bodySaving ? 'saving…' : 'save' }}</button>
        <span v-else class="pp-saved">saved</span>
      </div>
    </div>

    <!-- Context bar -->
    <div v-if="project.nextStep" class="pp-context-bar">
      <span class="pp-context-label">next step</span>
      <span class="pp-context-text">{{ project.nextStep }}</span>
    </div>

    <!-- Toolbar -->
    <div class="pp-toolbar">
      <button class="pp-tb-btn" @mousedown.prevent @click="insertMd('**', '**')"><b>B</b></button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertMd('*', '*')"><i>I</i></button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertMd('`', '`')">⌨</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertMd('\n```\n', '\n```')">{ }</button>
      <div class="pp-tb-sep"></div>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertLine('# ')">H1</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertLine('## ')">H2</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertLine('- ')">•</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertLine('- [ ] ')">☐</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertLine('> ')">❝</button>
      <button class="pp-tb-btn" @mousedown.prevent @click="insertMd('[', '](url)')">⇱</button>
    </div>

    <!-- Editor + preview -->
    <div :class="['pp-panes', `pp-view-${noteView}`]">
      <textarea v-if="noteView !== 'preview'"
        class="pp-editor"
        v-model="body"
        placeholder="write anything about this project — context, research, decisions, links, todos…"
        @input="scheduleAutoSave"
        @focus="lastFocused = $event.target as HTMLTextAreaElement"
      ></textarea>
      <div v-if="noteView !== 'edit'" class="pp-preview sd-md-preview" v-html="rendered"></div>
    </div>

  </div>
</template>

<style scoped>
.pp-wrap {
  display: flex; flex-direction: column;
  height: calc(100dvh - var(--vp-nav-height, 64px));
  overflow: hidden; max-width: 100%;
}

.pp-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0; flex-wrap: wrap;
  background: var(--vp-c-bg);
}
.pp-back {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.85rem; padding: 0;
  cursor: pointer; flex-shrink: 0; transition: color 0.15s;
}
.pp-back:hover { color: var(--vp-c-text-1); }
.pp-header-center { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
.pp-project-name {
  font-size: 1rem; font-weight: 600; color: var(--vp-c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pp-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pp-status-label { font-size: 0.72rem; color: var(--vp-c-text-3); }
.pp-header-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

.pp-view-toggle {
  display: flex; border: 1px solid var(--vp-c-divider); overflow: hidden;
}
.pp-view-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.72rem; padding: 0.22rem 0.5rem;
  cursor: pointer; border-right: 1px solid var(--vp-c-divider);
  transition: background 0.1s, color 0.1s;
}
.pp-view-btn:last-child { border-right: none; }
.pp-view-btn:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.pp-view-btn.active { background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent); color: var(--vp-c-brand-1); }

.pp-save-btn {
  background: none; border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  font: inherit; font-size: 0.75rem; padding: 0.2rem 0.6rem;
  cursor: pointer; transition: background 0.1s;
}
.pp-save-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent); }
.pp-save-btn:disabled { opacity: 0.4; cursor: default; }
.pp-saved { font-size: 0.72rem; color: var(--vp-c-text-3); }
.pp-err { font-size: 0.75rem; color: #f43f5e; margin: 0; }

.pp-context-bar {
  display: flex; align-items: baseline; gap: 0.5rem;
  padding: 0.45rem 1.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: color-mix(in srgb, var(--vp-c-brand-1) 5%, transparent);
  flex-shrink: 0;
}
.pp-context-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vp-c-text-3); flex-shrink: 0; }
.pp-context-text { font-size: 0.85rem; color: var(--vp-c-text-2); }

.pp-toolbar {
  display: flex; align-items: center; gap: 0.1rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0; background: var(--vp-c-bg);
}
.pp-tb-btn {
  background: none; border: none; color: var(--vp-c-text-2);
  font: inherit; font-size: 0.82rem; padding: 0.25rem 0.45rem;
  cursor: pointer; line-height: 1; border-radius: 3px;
  transition: background 0.1s, color 0.1s;
}
.pp-tb-btn:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.pp-tb-sep { width: 1px; height: 16px; background: var(--vp-c-divider); margin: 0 0.2rem; align-self: center; }

.pp-panes {
  flex: 1; display: flex; overflow: hidden; min-height: 0;
}
.pp-view-edit .pp-editor { flex: 1; }
.pp-view-preview .pp-preview { flex: 1; }
.pp-view-split .pp-editor { flex: 1; border-right: 1px solid var(--vp-c-divider); }
.pp-view-split .pp-preview { flex: 1; }

.pp-editor {
  flex: 1; resize: none; border: none !important; outline: none;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem; line-height: 1.75; padding: 1.25rem 1.5rem;
  overflow-y: auto;
}
.pp-editor::placeholder { color: var(--vp-c-text-3); font-family: inherit; }

.pp-preview {
  flex: 1; overflow-y: auto;
  padding: 1.25rem 1.5rem;
  font-size: 0.9rem; line-height: 1.75;
}

/* Dark/light mode */
html:not(.light) .pp-wrap { background: #100d20; }
html:not(.light) .pp-header { background: #100d20; border-bottom-color: rgba(167,139,250,0.2); }
html:not(.light) .pp-context-bar { border-bottom-color: rgba(167,139,250,0.15); background: rgba(167,139,250,0.05); }
html:not(.light) .pp-toolbar { background: #100d20; border-bottom-color: rgba(167,139,250,0.2); }
html:not(.light) .pp-editor { background: #0d0a18; color: #e2d9f3; }
html:not(.light) .pp-view-split .pp-editor { border-right-color: rgba(167,139,250,0.15) !important; }
html:not(.light) .pp-view-toggle { border-color: rgba(167,139,250,0.25); }
html:not(.light) .pp-view-btn { border-right-color: rgba(167,139,250,0.15); }

html.light .pp-context-bar { background: rgba(124,58,237,0.05); border-bottom-color: rgba(124,58,237,0.15); }
html.light .pp-view-split .pp-editor { border-right-color: rgba(124,58,237,0.15) !important; }
html.light .pp-editor { background: #fdfcff; }
</style>
