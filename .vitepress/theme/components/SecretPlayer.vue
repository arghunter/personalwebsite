<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { nowPlaying } from '../music'
import {
  music, viewPlaylist, attachPlayer, detachPlayer,
  playTrack, playPlaylist, shuffleAll, toggleShuffle, cycleLoop, ALL,
  addTrack, deleteTrack, createPlaylist, deletePlaylist, retryHosting,
  uploadAudio, extractVideoId, lookupYouTube, metaFromFilename, knownUrlFor,
  type Track,
} from '../secretMusic'

const editMode = ref(false)

// ── Add panel ─────────────────────────────────────────────────────────────────
const adding    = ref(false)
const addInput  = ref('')
const addTo     = ref('')
const status    = ref('')
const statusErr = ref(false)
const busy      = ref(false)
const dragOver  = ref(false)
const fileEl    = ref<HTMLInputElement | null>(null)
const inputEl   = ref<HTMLInputElement | null>(null)

interface Draft { kind: 'yt' | 'file'; title: string; artist: string; videoId?: string; file?: File }
const draft = ref<Draft | null>(null)

watch(() => music.viewId, id => { if (!adding.value || !addTo.value) addTo.value = id }, { immediate: true })

function say(msg: string, err = false) { status.value = msg; statusErr.value = err }

function openAdd() {
  adding.value = !adding.value
  if (adding.value) {
    addTo.value = music.viewId
    requestAnimationFrame(() => inputEl.value?.focus())
  }
}

function resetDraft() { draft.value = null; addInput.value = '' }

let lookupSeq = 0
async function onLinkInput() {
  const id = extractVideoId(addInput.value)
  if (!id) { if (draft.value?.kind === 'yt') draft.value = null; return }
  if (draft.value?.videoId === id) return
  const seq = ++lookupSeq
  draft.value = { kind: 'yt', videoId: id, title: '', artist: '' }
  say('looking up…')
  try {
    const meta = await lookupYouTube(id)
    if (seq !== lookupSeq || !draft.value) return
    draft.value.title = meta.title
    draft.value.artist = meta.artist
    say('')
  } catch {
    if (seq === lookupSeq) say('couldn’t fetch the title — type it in')
  }
}

function pickFiles() { fileEl.value?.click() }
function onFilePick(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  ;(e.target as HTMLInputElement).value = ''
  takeFiles(files)
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (!music.connected) return
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i.test(f.name))
  if (files.length) { adding.value = true; takeFiles(files); return }
  const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || ''
  if (extractVideoId(text)) { adding.value = true; addInput.value = text; onLinkInput() }
}

function takeFiles(files: File[]) {
  if (!files.length) return
  if (files.length === 1) {
    const meta = metaFromFilename(files[0].name)
    addInput.value = ''
    draft.value = { kind: 'file', file: files[0], ...meta }
    say('')
    return
  }
  uploadMany(files)
}

async function submitDraft() {
  const d = draft.value
  if (!d || !d.title.trim() || !addTo.value || busy.value) return
  busy.value = true
  const plName = music.playlists.find(p => p.id === addTo.value)?.name ?? 'playlist'
  try {
    if (d.kind === 'yt') {
      const url = knownUrlFor(d.videoId!)
      const t = await addTrack(addTo.value, { id: d.videoId, title: d.title.trim(), artist: d.artist.trim(), ...(url && { url }) })
      say(t.url ? `added to ${plName}` : `added to ${plName} · hosting the audio in the background`)
    } else {
      const url = await uploadAudio(d.file!, pct => say(`uploading… ${pct}%`))
      await addTrack(addTo.value, { url, title: d.title.trim(), artist: d.artist.trim() })
      say(`added to ${plName}`)
    }
    resetDraft()
  } catch (e: any) {
    say(`couldn’t add: ${e.message}`, true)
  }
  busy.value = false
}

async function uploadMany(files: File[]) {
  busy.value = true
  draft.value = null
  let done = 0
  for (const f of files) {
    try {
      const url = await uploadAudio(f, pct => say(`uploading ${done + 1}/${files.length}… ${pct}%`))
      await addTrack(addTo.value, { url, ...metaFromFilename(f.name) })
      done++
    } catch (e: any) {
      say(`stopped at ${f.name}: ${e.message}`, true)
      busy.value = false
      return
    }
  }
  say(`added ${done} songs`)
  busy.value = false
}

// ── Track list ────────────────────────────────────────────────────────────────
const tracks = computed(() => viewPlaylist.value?.tracks ?? [])
const isCurrent = (t: Track) => music.current?.pl === viewPlaylist.value?.id && music.current?.tid === t.tid
const playingPl = computed(() => music.current?.pl)

const retrying = ref<Record<string, boolean>>({})
async function retry(t: Track) {
  if (!viewPlaylist.value || retrying.value[t.tid]) return
  retrying.value = { ...retrying.value, [t.tid]: true }
  try { await retryHosting(viewPlaylist.value.id, t) }
  catch (e: any) { alert(`Still couldn't host "${t.title}" (${e.message}).\nRun "npm run songs" on your computer to fetch it with yt-dlp.`) }
  retrying.value = { ...retrying.value, [t.tid]: false }
}

async function removeTrack(t: Track) {
  if (!viewPlaylist.value) return
  try { await deleteTrack(viewPlaylist.value.id, t.tid) } catch (e: any) { alert(`couldn't delete: ${e.message}`) }
}

// What the player did recently ([bg] = screen off). Helps when songs stop in a pocket.
const playLog = ref<string | null>(null)
function toggleLog() {
  if (playLog.value !== null) { playLog.value = null; return }
  try { playLog.value = (JSON.parse(localStorage.getItem('mp_log') || '[]') as string[]).reverse().join('\n') } catch { playLog.value = '' }
}

// ── Playlist management ───────────────────────────────────────────────────────
const newPlName = ref('')
async function newPlaylist() {
  const name = newPlName.value.trim()
  if (!name) return
  try { await createPlaylist(name); newPlName.value = '' } catch (e: any) { alert(`couldn't create: ${e.message}`) }
}
async function removePlaylist() {
  const pl = viewPlaylist.value
  if (!pl || !confirm(`Delete playlist "${pl.name}" and its ${pl.tracks.length} songs?`)) return
  try { await deletePlaylist(pl.id) } catch (e: any) { alert(`couldn't delete: ${e.message}`) }
}

const loopLabel = computed(() => ({ none: 'repeat off', playlist: 'repeat playlist', track: 'repeat song' })[music.loop])

onMounted(attachPlayer)
onUnmounted(detachPlayer)
</script>

<template>
  <div
    :class="['sp', { 'sp-drag': dragOver }]"
    @dragover.prevent="dragOver = music.connected"
    @dragleave.self="dragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Playlist chips + add -->
    <div class="sp-head">
      <div class="sp-chips" role="tablist">
        <button
          v-for="pl in music.playlists" :key="pl.id"
          role="tab" :aria-selected="music.viewId === pl.id"
          :class="['sp-chip', { on: music.viewId === pl.id }]"
          @click="music.viewId = pl.id"
        >{{ pl.name }}<span v-if="playingPl === pl.id" class="sp-chip-dot" aria-label="playing"></span></button>
      </div>
      <button v-if="music.connected" :class="['sp-add-btn', { on: adding }]" @click="openAdd" :aria-expanded="adding" title="Add songs">
        {{ adding ? '×' : '+' }}
      </button>
    </div>

    <p v-if="music.error" class="sp-status err">{{ music.error }}</p>

    <!-- Add panel -->
    <div v-if="adding" class="sp-add">
      <div class="sp-row">
        <input
          ref="inputEl" v-model="addInput" class="sp-input"
          placeholder="paste a youtube link"
          inputmode="url" autocomplete="off"
          @input="onLinkInput" @keydown.enter="draft ? submitDraft() : onLinkInput()"
        />
        <button class="sp-btn" @click="pickFiles" :disabled="busy">upload file</button>
        <input ref="fileEl" type="file" accept="audio/*,.mp3,.m4a,.flac,.ogg,.opus,.wav" multiple hidden @change="onFilePick" />
      </div>

      <template v-if="draft">
        <div class="sp-fields">
          <input v-model="draft.title" class="sp-input" placeholder="title" @keydown.enter="submitDraft" />
          <input v-model="draft.artist" class="sp-input" placeholder="artist" @keydown.enter="submitDraft" />
        </div>
        <p v-if="draft.kind === 'file'" class="sp-hint">{{ draft.file?.name }}</p>
      </template>

      <div class="sp-row">
        <label class="sp-to">
          <span>to</span>
          <select v-model="addTo" class="sp-select">
            <option v-for="pl in music.playlists" :key="pl.id" :value="pl.id">{{ pl.name }}</option>
          </select>
        </label>
        <button v-if="draft" class="sp-btn sp-btn-primary" @click="submitDraft" :disabled="busy || !draft.title.trim()">
          {{ busy ? '…' : 'add' }}
        </button>
      </div>

      <p v-if="status" :class="['sp-status', { err: statusErr }]">{{ status }}</p>
      <p v-else class="sp-hint sp-hint-desktop">or drop audio files / links onto this card</p>
    </div>

    <!-- Playlist actions -->
    <div v-if="viewPlaylist" class="sp-actions">
      <button class="sp-btn" @click="playPlaylist(viewPlaylist.id, false)" :disabled="!tracks.length">▶ play</button>
      <button class="sp-btn" @click="playPlaylist(viewPlaylist.id, true)" :disabled="!tracks.length">⇄ shuffle</button>
      <button :class="['sp-btn', { on: music.scope === ALL && music.current }]" @click="shuffleAll" title="Shuffle every song on every playlist">⇄ all</button>
      <span class="sp-spacer"></span>
      <button :class="['sp-icon', { on: music.shuffle }]" @click="toggleShuffle" :title="music.shuffle ? 'shuffle on' : 'shuffle off'" aria-label="Shuffle">⇄</button>
      <button :class="['sp-icon', { on: music.loop !== 'none' }]" @click="cycleLoop" :title="loopLabel" :aria-label="loopLabel">
        ↻<sup v-if="music.loop === 'track'">1</sup>
      </button>
      <button v-if="music.connected" :class="['sp-icon', { on: editMode }]" @click="editMode = !editMode" title="Edit playlists" aria-label="Edit">✎</button>
    </div>

    <!-- Tracks -->
    <ol class="sp-list">
      <li
        v-for="(t, i) in tracks" :key="t.tid"
        :class="['sp-track', { active: isCurrent(t) }]"
        tabindex="0"
        @click="!editMode && playTrack(viewPlaylist!.id, t.tid)"
        @keydown.enter="!editMode && playTrack(viewPlaylist!.id, t.tid)"
      >
        <span class="sp-idx">
          <span v-if="isCurrent(t) && nowPlaying.playing" class="sp-eq" aria-label="playing"><i></i><i></i><i></i></span>
          <template v-else-if="isCurrent(t)">‖</template>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="sp-meta">
          <span class="sp-title">{{ t.title }}</span>
          <span class="sp-artist">{{ t.artist }}</span>
        </span>
        <button
          v-if="!t.url && t.id"
          class="sp-pending"
          :title="retrying[t.tid] ? 'hosting…' : 'not hosted yet — plays from YouTube, which stops when the phone locks. Run npm run songs to host it.'"
          @click.stop="retry(t)"
        >{{ retrying[t.tid] ? '…' : '◌' }}</button>
        <button v-if="editMode" class="sp-x" @click.stop="removeTrack(t)" :aria-label="`Remove ${t.title}`">×</button>
      </li>
      <li v-if="!tracks.length" class="sp-empty">no songs yet{{ music.connected ? ' — tap + to add one' : '' }}</li>
    </ol>

    <!-- Edit: playlists -->
    <div v-if="editMode" class="sp-edit">
      <div class="sp-row">
        <input v-model="newPlName" class="sp-input" placeholder="new playlist name" @keydown.enter="newPlaylist" />
        <button class="sp-btn" @click="newPlaylist" :disabled="!newPlName.trim()">create</button>
      </div>
      <button v-if="viewPlaylist" class="sp-danger" @click="removePlaylist">delete “{{ viewPlaylist.name }}”</button>
      <button class="sp-link" @click="toggleLog">{{ playLog === null ? 'playback log' : 'hide playback log' }}</button>
      <pre v-if="playLog !== null" class="sp-log">{{ playLog || 'nothing logged yet' }}</pre>
    </div>
  </div>
</template>

<style scoped>
.sp-link { background: none; border: none; padding: 0; font: inherit; font-size: 0.75rem; color: var(--muted, inherit); opacity: 0.7; cursor: pointer; text-align: left; text-decoration: underline; }
.sp-log { font-size: 0.7rem; line-height: 1.5; max-height: 14rem; overflow: auto; white-space: pre-wrap; margin: 0; padding: 0.5rem; border: 1px solid var(--border); }
.sp {
  display: flex; flex-direction: column; gap: 0.75rem;
  font-family: var(--font-body); color: var(--fg);
  position: relative;
}
.sp-drag { outline: 1px dashed var(--fg); outline-offset: 4px; }

/* Head: playlist chips */
.sp-head { display: flex; align-items: center; gap: 0.5rem; }
.sp-chips {
  display: flex; gap: 0.35rem; overflow-x: auto; flex: 1; min-width: 0;
  scrollbar-width: none;
}
.sp-chips::-webkit-scrollbar { display: none; }
.sp-chip {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.35rem;
  background: none; border: 1px solid var(--border); color: var(--fg-3);
  font: inherit; font-size: 0.8rem; padding: 0.3rem 0.7rem; min-height: 32px;
  cursor: pointer; white-space: nowrap; transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.sp-chip:hover { color: var(--fg); }
.sp-chip.on { color: var(--bg); background: var(--fg); border-color: var(--fg); }
.sp-chip-dot { width: 5px; height: 5px; background: currentColor; display: inline-block; }
.sp-add-btn {
  flex-shrink: 0; width: 32px; height: 32px;
  background: none; border: 1px solid var(--border); color: var(--fg);
  font: inherit; font-size: 1.1rem; line-height: 1; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sp-add-btn:hover, .sp-add-btn.on { border-color: var(--fg); }

/* Add panel */
.sp-add {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.75rem; border: 1px solid var(--border);
  background: color-mix(in srgb, var(--fg) 3%, transparent);
}
.sp-row { display: flex; gap: 0.4rem; align-items: center; }
.sp-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.sp-input, .sp-select {
  flex: 1; min-width: 0; background: var(--bg);
  border: 1px solid var(--border); color: var(--fg);
  font: inherit; font-size: 0.85rem; padding: 0.45rem 0.6rem; min-height: 36px;
  outline: none; transition: border-color 0.15s; border-radius: 0;
}
.sp-input::placeholder { color: var(--fg-3); }
.sp-input:focus, .sp-select:focus { border-color: var(--fg); }
.sp-to { display: flex; align-items: center; gap: 0.4rem; flex: 1; min-width: 0; font-size: 0.75rem; color: var(--fg-3); }
.sp-hint { font-size: 0.72rem; color: var(--fg-3); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-status { font-size: 0.75rem; color: var(--fg-3); margin: 0; }
.sp-status.err { color: #e11d48; }

/* Buttons */
.sp-btn {
  background: none; border: 1px solid var(--border); color: var(--fg);
  font: inherit; font-size: 0.8rem; padding: 0.4rem 0.75rem; min-height: 36px;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sp-btn:hover:not(:disabled) { border-color: var(--fg); }
.sp-btn.on { border-color: var(--fg); }
.sp-btn:disabled { opacity: 0.35; cursor: default; }
.sp-btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); min-width: 4.5rem; }
.sp-btn-primary:hover:not(:disabled) { opacity: 0.85; }

.sp-actions { display: flex; align-items: center; gap: 0.35rem; }
.sp-spacer { flex: 1; }
.sp-icon {
  width: 36px; height: 36px; background: none; border: none;
  color: var(--fg); font: inherit; font-size: 1rem; cursor: pointer;
  opacity: 0.35; transition: opacity 0.15s; position: relative;
}
.sp-icon:hover { opacity: 0.75; }
.sp-icon.on { opacity: 1; }
.sp-icon sup { font-size: 0.55rem; position: absolute; top: 8px; right: 6px; }

/* Track list */
.sp-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.sp-track {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0.25rem; min-height: 48px; cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  transition: background 0.1s; outline: none;
}
.sp-track:hover, .sp-track:focus-visible { background: color-mix(in srgb, var(--fg) 4%, transparent); }
.sp-track.active { background: color-mix(in srgb, var(--fg) 7%, transparent); }
.sp-idx {
  width: 1.5rem; flex-shrink: 0; text-align: right;
  font-family: var(--font-mono); font-size: 0.7rem; color: var(--fg-3);
  display: flex; justify-content: flex-end;
}
.sp-track.active .sp-idx { color: var(--fg); }
.sp-meta { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; flex: 1; }
.sp-title { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-track.active .sp-title { font-weight: 700; }
.sp-artist { font-size: 0.75rem; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-pending, .sp-x {
  flex-shrink: 0; width: 32px; height: 32px;
  background: none; border: none; color: var(--fg-3);
  font: inherit; font-size: 0.95rem; line-height: 1; cursor: pointer;
  transition: color 0.15s;
}
.sp-pending:hover { color: var(--fg); }
.sp-x { font-size: 1.2rem; }
.sp-x:hover { color: #e11d48; }
.sp-empty { padding: 1rem 0.25rem; font-size: 0.8rem; color: var(--fg-3); }

/* Equalizer glyph for the playing row */
.sp-eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 10px; }
.sp-eq i { width: 2px; background: currentColor; animation: sp-eq 0.9s ease-in-out infinite; }
.sp-eq i:nth-child(2) { animation-delay: -0.3s; }
.sp-eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes sp-eq { 0%, 100% { height: 3px; } 50% { height: 10px; } }
@media (prefers-reduced-motion: reduce) { .sp-eq i { animation: none; height: 7px; } }

/* Edit */
.sp-edit { display: flex; flex-direction: column; gap: 0.5rem; }
.sp-danger {
  align-self: flex-start; background: none; border: none; padding: 0.25rem 0;
  color: #e11d48; font: inherit; font-size: 0.78rem; cursor: pointer; opacity: 0.75;
}
.sp-danger:hover { opacity: 1; }

@media (hover: none) { .sp-hint-desktop { display: none; } }
@media (max-width: 420px) { .sp-fields { grid-template-columns: 1fr; } }
</style>
