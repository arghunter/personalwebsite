<script setup>
import { ref, computed } from 'vue'

const cacheDepth    = ref(1024)
const wordsPerLine  = ref(4)
const addrWidth     = ref(32)
const rawAddr       = ref('0000A5C4')

const BYTE_BITS = 2   // log2(4 bytes per 32-bit word)

const wob = computed(() => Math.log2(wordsPerLine.value))   // word-offset bits
const ib  = computed(() => Math.log2(cacheDepth.value))     // index bits
const tb  = computed(() => addrWidth.value - BYTE_BITS - wob.value - ib.value)  // tag bits

const isValid = computed(() => tb.value >= 1)

const addr = computed(() => {
  const v = parseInt(rawAddr.value, 16)
  if (isNaN(v)) return 0
  if (addrWidth.value >= 32) return v >>> 0
  return v & ((1 << addrWidth.value) - 1)
})

const byteOff = computed(() => addr.value & 0x3)
const wordOff = computed(() => wordsPerLine.value > 1 ? (addr.value >> BYTE_BITS) & (wordsPerLine.value - 1) : 0)
const cacheIdx = computed(() => isValid.value
  ? (addr.value >> (BYTE_BITS + wob.value)) & (cacheDepth.value - 1)
  : 0)
const tag = computed(() => isValid.value
  ? addr.value >>> (BYTE_BITS + wob.value + ib.value)
  : 0)

const binStr = computed(() =>
  (addr.value >>> 0).toString(2).padStart(addrWidth.value, '0').slice(-addrWidth.value)
)

function fieldOf(di) {
  const bn = addrWidth.value - 1 - di
  if (bn < BYTE_BITS)                          return 'byte'
  if (bn < BYTE_BITS + wob.value)              return 'word'
  if (bn < BYTE_BITS + wob.value + ib.value)  return 'index'
  return 'tag'
}

const bits = computed(() =>
  Array.from({ length: addrWidth.value }, (_, i) => ({
    v: binStr.value[i],
    f: fieldOf(i),
    n: addrWidth.value - 1 - i,
  }))
)

// Contiguous field groups (MSB → LSB)
const groups = computed(() => {
  const gs = []
  let cur = null
  for (const b of bits.value) {
    if (!cur || cur.f !== b.f) {
      cur = { f: b.f, count: 1, hi: b.n, lo: b.n }
      gs.push(cur)
    } else {
      cur.count++
      cur.lo = b.n
    }
  }
  return gs
})

// Cache preview: show 8 lines centered on the hit
const PREV = 4
const previewLines = computed(() => {
  const i = cacheIdx.value, d = cacheDepth.value
  const s = Math.max(0, Math.min(i - Math.floor(PREV / 2), d - PREV))
  const e = Math.min(d - 1, s + PREV - 1)
  return Array.from({ length: e - s + 1 }, (_, k) => s + k)
})

function toHex(n, chars = 0) {
  return '0x' + n.toString(16).toUpperCase().padStart(chars, '0')
}
const tagChars = computed(() => Math.max(1, Math.ceil(tb.value / 4)))
</script>

<template>
  <div class="cw">
    <!-- Header -->
    <div class="cw-head">
      <span class="cw-title">CACHE ADDRESS DECODER</span>
      <span class="cw-sub">DIRECT-MAPPED · 1-WAY</span>
    </div>

    <!-- Controls -->
    <div class="cw-controls">
      <div class="cw-param">
        <label class="cw-plbl">CACHE LINES</label>
        <select v-model.number="cacheDepth" class="cw-sel">
          <option v-for="n in [4,8,16,32,64,128,256,512,1024,2048,4096]" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <div class="cw-param">
        <label class="cw-plbl">WORDS / LINE</label>
        <select v-model.number="wordsPerLine" class="cw-sel">
          <option v-for="n in [1,2,4,8,16]" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
      <div class="cw-param">
        <label class="cw-plbl">ADDR WIDTH</label>
        <select v-model.number="addrWidth" class="cw-sel">
          <option v-for="n in [16,20,24,28,32]" :key="n" :value="n">{{ n }}b</option>
        </select>
      </div>
      <div class="cw-param cw-param-addr">
        <label class="cw-plbl">ADDRESS</label>
        <div class="cw-addr-wrap">
          <span class="cw-addr-pfx">0x</span>
          <input v-model="rawAddr" class="cw-addr-in" maxlength="8" spellcheck="false" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="!isValid" class="cw-error">
      Config invalid — not enough address bits for this cache depth and line width.
    </div>

    <template v-else>
      <!-- Bit breakdown -->
      <div class="cw-bits-section">
        <div class="cw-bits-scroll">
          <div class="cw-bits">
            <span
              v-for="(b, i) in bits" :key="i"
              class="cw-bit"
              :class="[`cw-f-${b.f}`, { 'is-on': b.v === '1' }]"
              :title="`bit[${b.n}]`"
            >{{ b.v }}</span>
          </div>
          <div class="cw-groups">
            <div
              v-for="g in groups" :key="g.f"
              class="cw-group"
              :class="`cw-f-${g.f}`"
              :style="{ flex: g.count }"
            >
              <span class="cw-gname">{{
                g.f === 'byte'  ? 'BYTE\u00a0OFF' :
                g.f === 'word'  ? 'WORD\u00a0OFF' :
                g.f.toUpperCase()
              }}</span>
              <span class="cw-grange">[{{ g.hi }}{{ g.count > 1 ? `:${g.lo}` : '' }}]</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Field values -->
      <div class="cw-breakdown">
        <div class="cw-bk cw-f-tag">
          <span class="cw-bk-name">TAG</span>
          <span class="cw-bk-val">{{ toHex(tag, tagChars) }}</span>
          <span class="cw-bk-w">{{ tb }}b</span>
        </div>
        <div class="cw-bk cw-f-index">
          <span class="cw-bk-name">INDEX</span>
          <span class="cw-bk-val">{{ toHex(cacheIdx) }}</span>
          <span class="cw-bk-w">{{ ib }}b</span>
        </div>
        <div v-if="wob > 0" class="cw-bk cw-f-word">
          <span class="cw-bk-name">WORD OFF</span>
          <span class="cw-bk-val">{{ wordOff }}</span>
          <span class="cw-bk-w">{{ wob }}b</span>
        </div>
        <div class="cw-bk cw-f-byte">
          <span class="cw-bk-name">BYTE OFF</span>
          <span class="cw-bk-val">{{ byteOff }}</span>
          <span class="cw-bk-w">2b</span>
        </div>
      </div>

      <!-- Cache line preview -->
      <div class="cw-preview">
        <div class="cw-prev-hdr">
          <span class="cw-plbl">CACHE LINES</span>
          <span class="cw-sub">{{ cacheDepth }} lines · {{ wordsPerLine * 4 }}&thinsp;B each</span>
        </div>
        <div class="cw-prev-list">
          <div v-if="previewLines[0] > 0" class="cw-ellipsis">⋮</div>
          <div
            v-for="line in previewLines" :key="line"
            class="cw-line"
            :class="{ 'is-hit': line === cacheIdx }"
          >
            <span class="cw-line-num">{{ toHex(line) }}</span>
            <div class="cw-line-words">
              <div
                v-for="w in wordsPerLine" :key="w - 1"
                class="cw-word"
                :class="{ 'is-word-hit': line === cacheIdx && (w - 1) === wordOff }"
              >W{{ w - 1 }}</div>
            </div>
            <span v-if="line === cacheIdx" class="cw-hit-tag">◄&thinsp;tag&thinsp;{{ toHex(tag, tagChars) }}</span>
          </div>
          <div v-if="previewLines.at(-1) < cacheDepth - 1" class="cw-ellipsis">⋮</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cw {
  --c-tag:   #4ade80;
  --c-index: var(--accent);
  --c-word:  #60a5fa;
  --c-byte:  #6b7280;

  font-family: 'DM Mono', monospace;
  margin: 2rem 0;
  border: 1px solid var(--hr-color);
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--detail-lt) 60%, transparent);
}

/* ── Header ─────────────────────────────────────────────────── */
.cw-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.7rem 1.25rem;
  border-bottom: 1px solid var(--hr-color);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.cw-title {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--accent);
}
.cw-sub {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  opacity: 0.35;
}

/* ── Controls ────────────────────────────────────────────────── */
.cw-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--hr-color);
}
.cw-param {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.cw-plbl {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  opacity: 0.4;
}
.cw-sel,
.cw-addr-in {
  font-family: 'DM Mono', monospace;
  font-size: 0.85rem;
  background: var(--detail-lt);
  color: var(--primary-lt);
  border: 1px solid var(--hr-color);
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  border-radius: 0;
}
.cw-sel:focus,
.cw-addr-in:focus { outline: 1px solid var(--accent); }
.cw-addr-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--hr-color);
  background: var(--detail-lt);
}
.cw-addr-pfx {
  font-size: 0.85rem;
  opacity: 0.4;
  padding: 0.3rem 0.3rem 0.3rem 0.6rem;
}
.cw-addr-in {
  border: none;
  padding: 0.3rem 0.6rem 0.3rem 0;
  min-width: 7rem;
}

/* ── Error ───────────────────────────────────────────────────── */
.cw-error {
  padding: 1rem 1.25rem;
  font-size: 0.78rem;
  color: #f87171;
  opacity: 0.8;
}

/* ── Bit breakdown ───────────────────────────────────────────── */
.cw-bits-section {
  padding: 1rem 1.25rem 0;
  border-bottom: 1px solid var(--hr-color);
}
.cw-bits-scroll {
  overflow-x: auto;
  padding-bottom: 1rem;
}
.cw-bits {
  display: flex;
  gap: 2px;
  margin-bottom: 4px;
}
.cw-bit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  font-size: 0.72rem;
  border: 1px solid color-mix(in srgb, var(--hr-color) 70%, transparent);
  background: color-mix(in srgb, var(--background-lt) 60%, transparent);
  opacity: 0.28;
  transition: background 120ms, opacity 120ms;
  cursor: default;
}
.cw-bit.is-on { opacity: 1; }

.cw-f-tag   { --fc: var(--c-tag); }
.cw-f-index { --fc: var(--c-index); }
.cw-f-word  { --fc: var(--c-word); }
.cw-f-byte  { --fc: var(--c-byte); }

.cw-bit.cw-f-tag.is-on   { background: color-mix(in srgb, var(--c-tag)   18%, transparent); color: var(--c-tag);   border-color: color-mix(in srgb, var(--c-tag)   50%, transparent); }
.cw-bit.cw-f-index.is-on { background: color-mix(in srgb, var(--c-index) 18%, transparent); color: var(--c-index); border-color: color-mix(in srgb, var(--c-index) 50%, transparent); }
.cw-bit.cw-f-word.is-on  { background: color-mix(in srgb, var(--c-word)  18%, transparent); color: var(--c-word);  border-color: color-mix(in srgb, var(--c-word)  50%, transparent); }
.cw-bit.cw-f-byte.is-on  { background: color-mix(in srgb, var(--c-byte)  18%, transparent); color: var(--c-byte);  border-color: color-mix(in srgb, var(--c-byte)  50%, transparent); }

/* Group labels under bits */
.cw-groups {
  display: flex;
  gap: 2px;
  min-width: max-content;
}
.cw-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  border-top: 2px solid var(--fc);
  padding-top: 0.3rem;
  min-width: 0;
  overflow: hidden;
}
.cw-gname {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--fc);
  white-space: nowrap;
  opacity: 0.85;
}
.cw-grange {
  font-size: 0.55rem;
  opacity: 0.45;
  white-space: nowrap;
}

/* ── Field value summary ─────────────────────────────────────── */
.cw-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border-bottom: 1px solid var(--hr-color);
}
.cw-bk {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.85rem 1.25rem;
  border-right: 1px solid var(--hr-color);
  min-width: 6.5rem;
}
.cw-bk:last-child { border-right: none; }
.cw-bk-name {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--fc);
  opacity: 0.7;
}
.cw-bk-val {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--fc);
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.cw-bk-w {
  font-size: 0.58rem;
  opacity: 0.35;
  letter-spacing: 0.08em;
}

/* ── Cache preview ───────────────────────────────────────────── */
.cw-preview {
  padding: 0.85rem 1.25rem 1.1rem;
}
.cw-prev-hdr {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.65rem;
}
.cw-ellipsis {
  text-align: center;
  font-size: 0.85rem;
  opacity: 0.25;
  padding: 0.15rem 0;
  letter-spacing: 0.1em;
}
.cw-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.8rem;
  padding: 0.3rem 0.65rem;
  margin-bottom: 3px;
  border: 1px solid transparent;
  transition: background 100ms;
}
.cw-line.is-hit {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.cw-line-num {
  font-size: 0.78rem;
  opacity: 0.5;
  min-width: 5.5rem;
}
.cw-line.is-hit .cw-line-num {
  color: var(--c-index);
  opacity: 1;
  font-weight: 700;
}
.cw-line-words {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.cw-word {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 0.18rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--hr-color) 70%, transparent);
  opacity: 0.3;
}
.cw-word.is-word-hit {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  opacity: 1;
  font-weight: 700;
}
.cw-hit-tag {
  font-size: 0.68rem;
  color: var(--c-tag);
  opacity: 0.75;
  margin-left: auto;
  white-space: nowrap;
}
</style>
