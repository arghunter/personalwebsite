<script setup lang="ts">
import { ref, onMounted } from 'vue'

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

interface AMAItem {
  id: string
  question: string
  name: string
  answer: string
  answeredAt: string
}

const items     = ref<AMAItem[]>([])
const question  = ref('')
const name      = ref('')
const busy      = ref(false)
const submitted = ref(false)
const err       = ref('')

onMounted(async () => {
  if (!WORKER_URL) return
  try {
    const res = await fetch(`${WORKER_URL}/ama`)
    if (res.ok) items.value = await res.json()
  } catch {}
})

async function submit() {
  const q = question.value.trim()
  if (!q || !WORKER_URL) return
  busy.value = true; err.value = ''
  try {
    const res = await fetch(`${WORKER_URL}/ama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, name: name.value.trim() }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    submitted.value = true
    question.value = ''; name.value = ''
  } catch (e: any) { err.value = 'something went wrong, try again' }
  busy.value = false
}

function formatDate(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="ama">

    <!-- Q&A list -->
    <div v-if="items.length" class="ama-list">
      <div v-for="item in items" :key="item.id" class="ama-item">
        <div class="ama-q">
          <span class="ama-label ama-label-q">Q</span>
          <div class="ama-q-body">
            <span class="ama-question">{{ item.question }}</span>
            <span v-if="item.name" class="ama-asker">— {{ item.name }}</span>
          </div>
        </div>
        <div class="ama-a">
          <span class="ama-label ama-label-a">A</span>
          <div class="ama-a-body">
            <span class="ama-answer">{{ item.answer }}</span>
            <span v-if="item.answeredAt" class="ama-date">{{ formatDate(item.answeredAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit form -->
    <div class="ama-form">
      <div class="ama-form-hd">ask me anything</div>

      <template v-if="!submitted">
        <textarea
          v-model="question"
          class="ama-textarea"
          placeholder="your question…"
          rows="3"
          @keydown.ctrl.enter="submit"
          @keydown.meta.enter="submit"
        ></textarea>
        <input v-model="name" class="ama-name-input" placeholder="your name (optional)" />
        <p v-if="err" class="ama-err">{{ err }}</p>
        <button class="ama-submit" @click="submit" :disabled="busy || !question.trim()">
          {{ busy ? '…' : 'send' }}
        </button>
      </template>

      <p v-else class="ama-thanks">got it — I'll answer soon.</p>
    </div>

  </div>
</template>

<style scoped>
.ama {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin: 2rem 0;
}

/* Q&A list */
.ama-list {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.ama-item {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ama-q, .ama-a {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.ama-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.15em 0.45em;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 0.15em;
  line-height: 1.6;
}

.ama-label-q {
  background: color-mix(in srgb, #a78bfa 15%, transparent);
  color: #a78bfa;
  border: 1px solid color-mix(in srgb, #a78bfa 30%, transparent);
}

.ama-label-a {
  background: color-mix(in srgb, #38bdf8 12%, transparent);
  color: #38bdf8;
  border: 1px solid color-mix(in srgb, #38bdf8 25%, transparent);
}

.ama-q-body, .ama-a-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.ama-question {
  font-size: 0.95rem;
  color: var(--vp-c-text-1);
  line-height: 1.55;
  font-weight: 500;
}

.ama-asker {
  font-size: 0.78rem;
  opacity: 0.45;
}

.ama-answer {
  font-size: 0.9rem;
  color: var(--vp-c-text-1);
  line-height: 1.65;
  opacity: 0.85;
  white-space: pre-wrap;
}

.ama-date {
  font-size: 0.72rem;
  opacity: 0.35;
  margin-top: 0.15rem;
}

/* Form */
.ama-form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  border: 1px solid var(--vp-c-divider);
  padding: 1.25rem;
}

.ama-form-hd {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.45;
  margin-bottom: 0.25rem;
}

.ama-textarea, .ama-name-input {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 0.9rem;
  padding: 0.6rem 0.75rem;
  outline: none;
  width: 100%;
  transition: border-color 0.15s;
  resize: none;
  line-height: 1.55;
  box-sizing: border-box;
}

.ama-textarea:focus, .ama-name-input:focus {
  border-color: #a78bfa;
}

.ama-textarea::placeholder, .ama-name-input::placeholder {
  opacity: 0.4;
}

.ama-submit {
  align-self: flex-end;
  background: none;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 0.85rem;
  padding: 0.45rem 1.25rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.ama-submit:hover:not(:disabled) {
  border-color: #a78bfa;
  color: #a78bfa;
}

.ama-submit:disabled {
  opacity: 0.3;
  cursor: default;
}

.ama-err {
  font-size: 0.8rem;
  color: #f43f5e;
  margin: 0;
}

.ama-thanks {
  font-size: 0.875rem;
  opacity: 0.6;
  font-style: italic;
  margin: 0;
}
</style>
