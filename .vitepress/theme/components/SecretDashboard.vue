<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'
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
type Tab = 'music' | 'notes' | 'ideas' | 'later' | 'sleep'
const tab  = ref<Tab>('music')
const tabs = [
  { id: 'music'  as Tab, icon: '♪', label: 'music' },
  { id: 'notes'  as Tab, icon: '✎', label: 'notes' },
  { id: 'ideas'  as Tab, icon: '✦', label: 'ideas' },
  { id: 'later'  as Tab, icon: '○', label: 'later' },
  { id: 'sleep'  as Tab, icon: '◑', label: 'sleep' },
]

// ── Notes ──────────────────────────────────────────────────────────────────────
interface NoteItem { id: string; text: string; createdAt: string }
const notes     = ref<NoteItem[]>([])
const noteText  = ref('')
const noteBusy  = ref(false)
const noteErr   = ref('')

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

// ── Data ───────────────────────────────────────────────────────────────────────
async function loadNotes() { try { notes.value = await apiFetch('/api/notes') } catch {} }
async function loadIdeas() { try { ideas.value = await apiFetch('/api/ideas') } catch {} }
async function loadLater() { try { laterItems.value = await apiFetch('/api/readlater') } catch {} }
async function loadSleep() { try { sleepLog.value = await apiFetch('/api/sleep') } catch {} }
function loadAll() { loadNotes(); loadIdeas(); loadLater(); loadSleep() }

const mobileLoaded = ref<Record<Tab, boolean>>({ music: true, notes: false, ideas: false, later: false, sleep: false })
async function switchTab(t: Tab) {
  tab.value = t
  if (mobileLoaded.value[t]) return
  mobileLoaded.value[t] = true
  if (t === 'notes') await loadNotes()
  else if (t === 'ideas') await loadIdeas()
  else if (t === 'later') await loadLater()
  else if (t === 'sleep') await loadSleep()
}

// ── Notes CRUD ─────────────────────────────────────────────────────────────────
async function addNote() {
  if (!noteText.value.trim()) return
  noteBusy.value = true; noteErr.value = ''
  try {
    const item = await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ text: noteText.value }) })
    notes.value.unshift(item); noteText.value = ''
  } catch (e: any) { noteErr.value = e.message }
  noteBusy.value = false
}

async function delNote(id: string) {
  try { await apiFetch(`/api/notes/${id}`, { method: 'DELETE' }); notes.value = notes.value.filter(n => n.id !== id) } catch {}
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
  const w = localStorage.getItem('sd_w'), k = localStorage.getItem('sd_k')
  if (w && k) { workerUrl.value = w; apiKey.value = k; ready.value = true; loadAll() }
  else { showSetup.value = true }
})

onUnmounted(() => { recognition?.stop() })
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

    <!-- Desktop grid ──────────────────────────────────────────────────────────── -->
    <div class="sd-grid">

      <!-- Music -->
      <div class="sd-card sd-area-music">
        <div class="sd-card-hd">
          <span class="sd-card-title">music</span>
          <button class="sd-icon-btn sd-cfg-btn" @click="showSetup = true" title="Settings">⚙</button>
        </div>
        <div class="sd-card-body sd-music-body"><SecretPlayer /></div>
      </div>

      <!-- Notes -->
      <div class="sd-card sd-area-notes">
        <div class="sd-card-hd"><span class="sd-card-title">notes</span></div>
        <div class="sd-card-body">
          <div class="sd-note-compose">
            <textarea v-model="noteText" class="sd-textarea" placeholder="write a note…" rows="3"
              @keydown.ctrl.enter="addNote" @keydown.meta.enter="addNote"></textarea>
            <button class="sd-submit-btn" @click="addNote" :disabled="noteBusy">{{ noteBusy ? '…' : 'add' }}</button>
          </div>
          <p v-if="noteErr" class="sd-err">{{ noteErr }}</p>
          <div class="sd-list sd-list-scroll">
            <div v-for="n in notes" :key="n.id" class="sd-note-item">
              <div class="sd-note-text">{{ n.text }}</div>
              <div class="sd-note-footer">
                <span class="sd-note-date">{{ noteDate(n.createdAt) }}</span>
                <button class="sd-del-btn" @click="delNote(n.id)">×</button>
              </div>
            </div>
            <div v-if="!notes.length" class="sd-empty">no notes yet</div>
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

    </div><!-- /sd-grid -->

    <!-- Mobile panels ──────────────────────────────────────────────────────────── -->
    <div class="sd-mobile">
      <div class="sd-mobile-hd">
        <span class="sd-card-title">{{ tabs.find(t => t.id === tab)?.label }}</span>
        <button v-if="tab === 'music'" class="sd-icon-btn sd-cfg-btn" @click="showSetup = true">⚙</button>
      </div>

      <div v-show="tab === 'music'" class="sd-mobile-panel"><SecretPlayer /></div>

      <div v-if="mobileLoaded.notes" v-show="tab === 'notes'" class="sd-mobile-panel">
        <div class="sd-note-compose">
          <textarea v-model="noteText" class="sd-textarea" placeholder="write a note…" rows="3"
            @keydown.ctrl.enter="addNote" @keydown.meta.enter="addNote"></textarea>
          <button class="sd-submit-btn" @click="addNote" :disabled="noteBusy">{{ noteBusy ? '…' : 'add' }}</button>
        </div>
        <p v-if="noteErr" class="sd-err">{{ noteErr }}</p>
        <div class="sd-list">
          <div v-for="n in notes" :key="n.id" class="sd-note-item">
            <div class="sd-note-text">{{ n.text }}</div>
            <div class="sd-note-footer">
              <span class="sd-note-date">{{ noteDate(n.createdAt) }}</span>
              <button class="sd-del-btn" @click="delNote(n.id)">×</button>
            </div>
          </div>
          <div v-if="!notes.length" class="sd-empty">no notes yet</div>
        </div>
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
    </div><!-- /sd-mobile -->

    <!-- Mobile tab bar — after content so flex order works ─────────────────────── -->
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
.sd-note-compose { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.75rem; }
.sd-note-compose .sd-submit-btn { align-self: flex-end; }
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

/* ── Ideas grid (desktop full-width card) ────────────────────────────────────── */
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

/* ── Notes items ─────────────────────────────────────────────────────────────── */
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
}
.sd-card-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--vp-c-text-2); font-weight: 600; }
.sd-card-body { padding: 1rem; }
.sd-music-body { padding: 0; }
.sd-music-body :deep(.sp) { max-width: none; margin: 0; }

/* ── Mobile base (shown below 768px) ─────────────────────────────────────────── */
.sd-grid { display: none; }

/* sd-wrap becomes a flex column that fills the viewport on mobile */
.sd-wrap {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--vp-nav-height, 64px));
  overflow: hidden;
}

.sd-mobile {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--vp-c-bg);
}

.sd-mobile-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  position: sticky; top: 0; z-index: 10;
}
.sd-mobile-panel { padding: 1rem 1rem 1.5rem; }
.sd-mobile-panel :deep(.sp) { max-width: none; margin: 0; }

/* Tab bar sits at the bottom of the flex column — no fixed positioning needed */
.sd-tabbar {
  flex-shrink: 0;
  display: flex;
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

/* ── Desktop ─────────────────────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .sd-wrap { display: block; height: auto; overflow: visible; max-width: 72rem; margin: 1.5rem auto; padding: 0 1.25rem 2rem; }

  .sd-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas: "music notes" "sleep later" "ideas ideas";
    gap: 1rem;
    align-items: start;
  }

  .sd-card {
    border: 1px solid var(--vp-c-divider);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sd-area-music { grid-area: music; }
  .sd-area-notes { grid-area: notes; }
  .sd-area-sleep { grid-area: sleep; }
  .sd-area-later { grid-area: later; }
  .sd-area-ideas { grid-area: ideas; }

  /* Cap music height so it doesn't dominate */
  .sd-area-music .sd-card-body { max-height: 480px; overflow-y: auto; }
  .sd-area-later .sd-list-scroll { max-height: 320px; }
  .sd-area-notes .sd-list-scroll { max-height: 260px; }

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

  /* Hide mobile UI */
  .sd-tabbar { display: none; }
  .sd-mobile-hd { display: none; }
  .sd-mobile { display: none; }
}

/* Light mode mobile */
html.light .sd-mobile-hd { border-bottom-color: rgba(124,58,237,0.18); }
html.light .sd-mobile-panel .sd-list { border-color: rgba(124,58,237,0.18); }
html.light .sd-mobile-panel .sd-row,
html.light .sd-mobile-panel .sd-note-item { border-bottom-color: rgba(124,58,237,0.1); }
html.light .sd-mobile-panel .sd-row:hover,
html.light .sd-mobile-panel .sd-note-item:hover { background: rgba(124,58,237,0.06); }
html.light .sd-mobile-panel .sd-input,
html.light .sd-mobile-panel .sd-textarea { background: #f9f7ff; border-color: rgba(124,58,237,0.25); }
html.light .sd-mobile-panel .sd-pair-btn { border-color: rgba(0,0,0,0.18); }
html.light .sd-mobile-panel .sd-chart { border-color: rgba(124,58,237,0.15); }
html.light .sd-mobile-panel .sd-bar-track { background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.12); }
html.light .sd-mobile-panel :deep(.sp-playlist) { border-color: rgba(0,0,0,0.1); }
html.light .sd-mobile-panel :deep(.sp-playlist-header:hover) { background: rgba(0,0,0,0.04); }
html.light .sd-mobile-panel :deep(.sp-list) { border-top-color: rgba(0,0,0,0.08); }
html.light .sd-mobile-panel :deep(.sp-track) { border-bottom-color: rgba(0,0,0,0.06); }
html.light .sd-mobile-panel :deep(.sp-track:hover) { background: rgba(124,58,237,0.07); }
html.light .sd-mobile-panel :deep(.sp-track-active) { background: rgba(124,58,237,0.12); }
html.light .sd-mobile-panel :deep(.sp-controls) { border-color: rgba(0,0,0,0.1); }
html.light .sd-mobile-panel :deep(.sp-widget) { border-color: rgba(0,0,0,0.1); }
html.light .sd-mobile-panel :deep(.sp-widget-input) {
  background: #f9f7ff; border-color: rgba(0,0,0,0.15); color: var(--vp-c-text-1);
}

/* ── Transition ──────────────────────────────────────────────────────────────── */
.sd-fade-enter-active, .sd-fade-leave-active { transition: opacity 0.2s; }
.sd-fade-enter-from,  .sd-fade-leave-to      { opacity: 0; }
</style>
