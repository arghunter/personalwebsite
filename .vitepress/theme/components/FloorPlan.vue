<script setup>
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
const { isDark } = useData()

// ── How to add a project ─────────────────────────────────────────────────────
// Append an object to the array below.
//
// Fields:
//   name     string          — display name
//   type     string|string[] — one or two domains; two gives a hover transition
//              'system' | 'asic' | 'dsp' | 'arch' | 'software'
//              e.g. type: 'asic'  or  type: ['asic', 'dsp']
//   cols     number   — columns to span in the 12-col grid (large≈6, medium≈4, small≈3)
//   href     string|null  — external link (GitHub, paper, etc.)
//   writeup  string|null  — internal writeup path e.g. '/blogs/clear'
//   desc     string   — one-line description shown in the block
//   tags     string[] — small chip-style labels e.g. ['ASIC', 'Verilog']
//   wip      boolean  — shows a WIP badge (optional, default false)
// ─────────────────────────────────────────────────────────────────────────────

const projects = [
  // ── Notable ─────────────────────────────────────── row 1: 6+6=12
  {
    name: 'clEar',
    type: ['system', 'dsp'],
    cols: 6,
    href: 'https://github.com/arghunter/clEar',
    writeup: '/blogs/clear',
    desc: 'Glasses-based beamforming hearing aids · 71% STOI · 9.9 dB SNR · ISEF Grand Award',
    tags: ['DSP', 'FPGA', 'PCB'],
  },
  {
    name: 'Supermic + more',
    type: ['asic', 'dsp'],
    cols: 6,
    href: 'https://github.com/arghunter/Supermic-tt08',
    writeup: '/blogs/supermic',
    desc: '8 chips on Tiny Tapeout 8 · 130nm Skywater CMOS · beamforming & audio DSP ASICs',
    tags: ['ASIC', 'Verilog','DSP'],
  },
  // ── Notable cont. ────────────────────────────────── row 2: 4+5+3=12
  {
    name: 'PDM Bitstream Operators',
    type: 'dsp',
    cols: 4,
    href: 'https://isef.net/project/ebed041-novel-pdm-operators-for-efficient-beamforming',
    writeup: null,
    desc: '250× runtime improvement in beamforming · PDM bitstream math · ISEF 2nd Award',
    tags: ['PDM', 'FPGA', 'DSP', 'PCB'],
  },
  {
    name: 'Potentiostat',
    type: 'system',
    cols: 5,
    href: 'https://github.com/arghunter/Potentiostat',
    writeup: null,
    desc: '18-channel high-speed potentiostat · UC Berkeley Nanotech · 256-ch electrochemical camera',
    tags: ['PCB', 'FPGA','DSP'],
  },
  {
    name: 'FlamProtect',
    type: 'software',
    cols: 3,
    href: 'https://github.com/arghunter/FlamProtect',
    writeup: null,
    desc: 'Genetic algorithm wildfire firebreak optimization',
    tags: ['Python'],
  },
  // ── ASIC Designs ─────────────────────────────────── row 3: 4+4+4=12
  {
    name: '16-Mic Beamformer',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/16-Mic-Beamformer-Verilog',
    writeup: null,
    desc: '16-ch PDM beamformer · DDR input · I2S output · fabricated on TT08',
    tags: ['ASIC', 'Verilog','DSP'],
  },
  {
    name: 'PDM Pitch Filter',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/Customizable-PDM-Pitch-Filter-ASIC',
    writeup: null,
    desc: 'Narrowband notch filter exploiting PDM time resolution for frequency removal',
    tags: ['ASIC', 'Verilog','DSP'],
  },
  {
    name: 'PDM Correlator',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/Customizable-PDM-Cross-Correlator-ASIC',
    writeup: null,
    desc: 'Cross/auto correlator for direction-of-arrival and pitch ID on PDM bitstreams',
    tags: ['ASIC', 'Verilog','DSP'],
  },
  // ── MIT Open Compute Lab ──────────────────────────── row 4: 4+4+4=12
  {
    name: 'DNN Accelerators',
    type: 'arch',
    cols: 4,
    href: null,
    writeup: null,
    desc: 'Custom accelerators for deep neural networks · PDM, Ternary, and INT8 inference',
    tags: ['Chisel', 'FPGA', 'Verilog'],
  },
  {
    name: 'RV32-IM CPU',
    type: 'arch',
    cols: 4,
    href: null,
    writeup: null,
    desc: 'Pipelined RISC-V CPU · compiled and ran Pong over VGA',
    tags: ['Verilog','Chisel','FPGA'],
  },
  {
    name: 'FPGA Cluster',
    type: 'system',
    cols: 4,
    href: null,
    writeup: null,
    desc: '100 Gb/s+ inter-FPGA bandwidth · >1.6M logic slices',
    tags: ['FPGA','PCB'],
    wip: true,
  },
]

const colorsDark = {
  system:   { bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.4)',  text: '#c084fc' },
  asic:     { bg: 'rgba(251,146,60,0.11)',  border: 'rgba(251,146,60,0.4)',   text: '#fb923c' },
  dsp:      { bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.4)',   text: '#38bdf8' },
  arch:     { bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.4)',   text: '#34d399' },
  software: { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.35)', text: '#a78bfa' },
}
const colorsLight = {
  system:   { bg: 'rgba(124,58,237,0.10)',  border: 'rgba(124,58,237,0.5)',   text: '#6d28d9' },
  asic:     { bg: 'rgba(194,65,12,0.09)',   border: 'rgba(194,65,12,0.5)',    text: '#c2410c' },
  dsp:      { bg: 'rgba(3,105,161,0.09)',   border: 'rgba(3,105,161,0.5)',    text: '#0369a1' },
  arch:     { bg: 'rgba(4,120,87,0.09)',    border: 'rgba(4,120,87,0.5)',     text: '#047857' },
  software: { bg: 'rgba(91,33,182,0.08)',   border: 'rgba(91,33,182,0.45)',   text: '#5b21b6' },
}
const colors = computed(() => isDark.value ? colorsDark : colorsLight)

// ── Helpers for single vs multi-type blocks ───────────────────────────────
function types(p)   { return Array.isArray(p.type) ? p.type : [p.type] }
function primary(p) { return types(p)[0] }

function blockStyle(p) {
  const t = types(p)
  const s = t[1] ?? t[0]
  const c = colors.value
  return {
    '--bg-p': c[t[0]].bg,
    '--bd-p': c[t[0]].border,
    '--bg-s': c[s].bg,
    '--bd-s': c[s].border,
    gridColumn: `span ${p._cols ?? p.cols}`,
  }
}

function nameColor(p) {
  const t = types(p)
  return t.length > 1 ? 'var(--primary-lt)' : colors.value[t[0]].text
}

function bomRowStyle(p) {
  return { borderLeftColor: colors.value[primary(p)].text }
}

// ── Filter state ──────────────────────────────────────────────────────────
const activeTypes = ref(new Set())
const activeTags  = ref(new Set())
const hasFilters  = computed(() => activeTypes.value.size > 0 || activeTags.value.size > 0)

const allTags = computed(() => {
  const seen = new Set()
  projects.forEach(p => p.tags.forEach(t => seen.add(t)))
  return [...seen].sort()
})

const filteredProjects = computed(() => {
  const ht = activeTypes.value.size > 0
  const hg = activeTags.value.size > 0
  if (!ht && !hg) return projects
  return projects.filter(p => {
    const typeMatch = !ht || types(p).some(t => activeTypes.value.has(t))
    const tagMatch  = !hg || p.tags.some(t => activeTags.value.has(t))
    return typeMatch && tagMatch
  })
})

// Scale col spans so each row fills exactly 12 columns when filtering
const scaledProjects = computed(() => {
  const fp = filteredProjects.value
  if (!hasFilters.value || fp.length === 0) return fp

  // Greedy row-pack then scale each row to sum=12
  const rows = []
  let row = [], sum = 0
  for (const p of fp) {
    if (sum + p.cols > 12 && row.length > 0) {
      rows.push(row); row = [p]; sum = p.cols
    } else {
      row.push(p); sum += p.cols
    }
  }
  if (row.length > 0) rows.push(row)

  return rows.flatMap(row => {
    const total = row.reduce((s, p) => s + p.cols, 0)
    let rem = 12
    return row.map((p, i) => {
      const cols = i === row.length - 1
        ? rem
        : Math.max(2, Math.round(p.cols * 12 / total))
      if (i < row.length - 1) rem -= cols
      return { ...p, _cols: cols }
    })
  })
})

function toggleType(type) {
  const s = new Set(activeTypes.value)
  s.has(type) ? s.delete(type) : s.add(type)
  activeTypes.value = s
}

function toggleTag(tag) {
  const s = new Set(activeTags.value)
  s.has(tag) ? s.delete(tag) : s.add(tag)
  activeTags.value = s
}

function clearFilters() {
  activeTypes.value = new Set()
  activeTags.value  = new Set()
}

// ── Legend / filter descriptors ───────────────────────────────────────────
const legend = [
  { type: 'system',   label: 'System / Hardware' },
  { type: 'asic',     label: 'ASIC / Chip Design' },
  { type: 'dsp',      label: 'Signal Processing' },
  { type: 'arch',     label: 'Computer Architecture' },
  { type: 'software', label: 'Software' },
]
</script>

<template>
  <div class="fp">
    <!-- Filter bar — sits above the die header -->
    <div class="fp-filter">
      <span class="fp-filter-label">NET FILTER</span>
      <div class="fp-filter-types">
        <button
          v-for="l in legend"
          :key="l.type"
          class="fp-filter-type"
          :class="{ 'fp-filter-active': activeTypes.has(l.type) }"
          :style="{
            '--ft-color': colors[l.type].text,
            '--ft-border': colors[l.type].border,
            '--ft-bg': colors[l.type].bg,
          }"
          @click="toggleType(l.type)"
        >
          <span class="fp-filter-swatch" :style="{ background: colors[l.type].text }"></span>
          {{ l.label }}
        </button>
      </div>
      <div class="fp-filter-divider"></div>
      <div class="fp-filter-tags">
        <button
          v-for="tag in allTags"
          :key="tag"
          class="fp-filter-tag"
          :class="{ 'fp-filter-tag-active': activeTags.has(tag) }"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
      </div>
      <button v-if="hasFilters" class="fp-filter-clear" @click="clearFilters">× CLEAR</button>
    </div>

    <div class="fp-header">
      <span class="fp-partnum">AGI-2007</span>
      <span class="fp-subtitle">PROCESS: SKY130B · 5LM · {{ projects.length }} MACROS · DIE FLOORPLAN</span>
      <span class="fp-rev">REV A</span>
    </div>

    <!-- Die wrapper holds the ruler, grid, and corner marks -->
    <div class="fp-die-wrap">
      <!-- Column ruler A–L -->
      <div class="fp-ruler" aria-hidden="true">
        <span v-for="(_, i) in 12" :key="i" class="fp-ruler-col">{{ String.fromCharCode(65 + i) }}</span>
      </div>

      <TransitionGroup tag="div" class="fp-die" name="fp-block">
        <component
          v-for="p in scaledProjects"
          :key="p.name"
          :is="(p.writeup || p.href) ? 'a' : 'div'"
          :href="p.writeup ?? p.href ?? undefined"
          :target="p.writeup ? undefined : '_blank'"
          :rel="p.writeup ? undefined : 'noopener'"
          class="fp-block"
          :class="{ 'fp-block-link': p.writeup || p.href }"
          :style="blockStyle(p)"
          :data-multi="types(p).length > 1 ? '' : undefined"
        >
          <div class="fp-block-top">
            <span class="fp-block-name" :style="{ color: nameColor(p) }">{{ p.name }}</span>
            <span v-if="p.wip" class="fp-wip">WIP</span>
          </div>
          <div class="fp-block-desc">{{ p.desc }}</div>
          <div class="fp-block-tags">
            <span
              v-for="tag in p.tags"
              :key="tag"
              class="fp-tag"
              :style="{ borderColor: colors[primary(p)].border, color: colors[primary(p)].text }"
            >{{ tag }}</span>
          </div>
        </component>
      </TransitionGroup>

      <!-- Corner registration marks (TL omitted — orientation notch is there) -->
      <span class="fp-c fp-c-tr" aria-hidden="true"></span>
      <span class="fp-c fp-c-bl" aria-hidden="true"></span>
      <span class="fp-c fp-c-br" aria-hidden="true"></span>
    </div>

    <div v-if="filteredProjects.length === 0" class="fp-empty">
      NO BLOCKS MATCH ACTIVE FILTERS
    </div>

    <!-- BOM list -->
    <div class="fp-bom-header">
      <span class="fp-partnum">BILL OF MATERIALS</span>
      <span class="fp-subtitle">{{ filteredProjects.length }} / {{ projects.length }} ENTRIES</span>
    </div>
    <div class="fp-bom">
      <div class="fp-bom-cols">
        <span>DESIGNATOR</span>
        <span>DESCRIPTION</span>
        <span>KEYWORDS</span>
      </div>
      <TransitionGroup name="fp-bom-row">
        <div
          v-for="p in filteredProjects"
          :key="p.name"
          class="fp-bom-row"
          :style="bomRowStyle(p)"
        >
          <div class="fp-bom-designator">
            <div class="fp-bom-name" :style="{ color: nameColor(p) }">
              U{{ projects.indexOf(p) + 1 }} · {{ p.name }}
              <span v-if="p.wip" class="fp-wip">WIP</span>
            </div>
            <div class="fp-bom-links">
              <a v-if="p.href"    :href="p.href"    target="_blank" rel="noopener" class="fp-bom-link">src</a>
              <a v-if="p.writeup" :href="p.writeup" class="fp-bom-link">writeup</a>
            </div>
          </div>
          <div class="fp-bom-desc">{{ p.desc }}</div>
          <div class="fp-bom-tags">
            <span v-for="tag in p.tags" :key="tag" class="fp-tag" :style="{ borderColor: colors[primary(p)].border, color: colors[primary(p)].text }">{{ tag }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.fp {
  font-family: 'DM Mono', monospace;
  margin: 1.5rem 0;
}

/* Header */
.fp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--hr-color);
  border-top: 1px solid color-mix(in srgb, var(--hr-color) 60%, transparent);
  border-bottom: none;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.fp-partnum  { color: var(--accent); font-weight: 600; }
.fp-subtitle { opacity: 0.45; }
.fp-rev      { opacity: 0.45; }

/* Filter bar */
.fp-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.7rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--hr-color);
  border-bottom: none;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.fp-filter-label {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.5;
  flex-shrink: 0;
  margin-right: 0.1rem;
}

.fp-filter-types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.fp-filter-type {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.25rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--ft-border) 60%, transparent);
  background: transparent;
  color: var(--primary-lt);
  opacity: 0.65;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
}
.fp-filter-type:hover {
  opacity: 1;
  border-color: var(--ft-border);
  color: var(--ft-color);
}
.fp-filter-type.fp-filter-active {
  background: var(--ft-bg);
  border-color: var(--ft-border);
  color: var(--ft-color);
  opacity: 1;
}

.fp-filter-swatch {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.8;
}
.fp-filter-active .fp-filter-swatch { opacity: 1; }

.fp-filter-divider {
  width: 1px;
  height: 1.4rem;
  background: var(--hr-color);
  flex-shrink: 0;
  opacity: 0.6;
}

.fp-filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.fp-filter-tag {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--hr-color);
  background: transparent;
  color: var(--primary-lt);
  opacity: 0.55;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
}
.fp-filter-tag:hover { opacity: 0.9; border-color: var(--accent); color: var(--accent); }
.fp-filter-tag.fp-filter-tag-active {
  opacity: 1;
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.fp-filter-clear {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--hr-color);
  background: transparent;
  color: var(--primary-lt);
  opacity: 0.6;
  cursor: pointer;
  margin-left: auto;
  transition: opacity 0.15s, border-color 0.15s;
}
.fp-filter-clear:hover { opacity: 1; border-color: var(--accent); }

/* Die wrapper — holds ruler + grid + corner marks */
.fp-die-wrap {
  position: relative;
}

/* Column ruler A–L */
.fp-ruler {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  height: 1.3rem;
  border: 2px solid var(--hr-color);
  border-bottom: 1px solid color-mix(in srgb, var(--hr-color) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.fp-ruler-col {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  color: var(--accent);
  opacity: 0.5;
  border-right: 1px solid color-mix(in srgb, var(--hr-color) 50%, transparent);
}
.fp-ruler-col:last-child { border-right: none; }

/* Corner registration marks */
.fp-c {
  position: absolute;
  width: 14px; height: 14px;
  pointer-events: none;
  opacity: 0.65;
}
.fp-c-tr {
  top: 1.3rem; right: 0;
  border-top: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
}
.fp-c-bl {
  bottom: 0; left: 0;
  border-bottom: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}
.fp-c-br {
  bottom: 0; right: 0;
  border-bottom: 2px solid var(--accent);
  border-right: 2px solid var(--accent);
}

/* Die area */
.fp-die {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: minmax(13rem, auto);
  grid-auto-flow: dense;
  border: 2px solid var(--hr-color);
  border-top: none;
  clip-path: polygon(1.75rem 0, 100% 0, 100% 100%, 0 100%, 0 1.75rem);
  min-height: 4rem;
  box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--accent) 6%, transparent);
}

/* Block enter/leave transitions */
.fp-block-enter-active,
.fp-block-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fp-block-enter-from,
.fp-block-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* Blocks */
.fp-block {
  border: 1px solid var(--bd-p);
  background: var(--bg-p);
  padding: 1.1rem 1.25rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-decoration: none;
  color: var(--primary-lt);
  transition: background 0.3s ease, border-color 0.3s ease;
  position: relative;
}
.fp-block-link:hover {
  background: var(--bg-s) !important;
  border-color: var(--bd-s) !important;
  text-decoration: none;
}

/* Corner triangle — hints at secondary domain before hover */
.fp-block[data-multi]::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  border-style: solid;
  border-width: 0 12px 12px 0;
  border-color: transparent var(--bd-s) transparent transparent;
  opacity: 0.75;
  transition: opacity 0.3s ease;
}
.fp-block[data-multi]:hover::after { opacity: 0; }

.fp-block-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
}

.fp-block-name {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 1.2;
}

.fp-wip {
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: var(--primary-lt);
  border: 1px solid var(--hr-color);
  padding: 0.05rem 0.25rem;
  flex-shrink: 0;
  opacity: 0.5;
  margin-top: 0.1rem;
}

.fp-block-desc {
  font-size: 0.9rem;
  line-height: 1.6;
  opacity: 0.7;
  flex: 1;
}

.fp-block-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.2rem;
}

.fp-tag {
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid;
  padding: 0.05rem 0.3rem;
}

/* Empty state */
.fp-empty {
  border: 1px solid var(--hr-color);
  border-top: none;
  padding: 2rem;
  text-align: center;
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.3;
}

/* BOM list */
.fp-bom-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--hr-color);
  border-top: none;
  border-bottom: none;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: 2rem;
}

.fp-bom {
  border: 1px solid var(--hr-color);
  position: relative;
  overflow: hidden;
}

.fp-bom-cols {
  display: grid;
  grid-template-columns: 14rem 1fr 9rem;
  gap: 0 1rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid var(--hr-color);
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  opacity: 0.35;
}

.fp-bom-row {
  display: grid;
  grid-template-columns: 14rem 1fr 9rem;
  gap: 0 1rem;
  align-items: start;
  padding: 0.85rem 0.75rem;
  border-bottom: 1px solid var(--hr-color);
  border-left: 2px solid transparent;
  transition: background 0.15s;
}
.fp-bom-row:last-child { border-bottom: none; }
.fp-bom-row:hover { background: color-mix(in srgb, var(--accent) 4%, transparent); }

/* BOM row transitions */
.fp-bom-row-enter-active,
.fp-bom-row-leave-active {
  transition: opacity 0.18s ease;
}
.fp-bom-row-enter-from,
.fp-bom-row-leave-to {
  opacity: 0;
}

.fp-bom-designator {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fp-bom-name {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.fp-bom-links {
  display: flex;
  gap: 0.6rem;
}

.fp-bom-link {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--accent);
  text-decoration: none;
  opacity: 0.7;
}
.fp-bom-link:hover { opacity: 1; text-decoration: underline; }

.fp-bom-desc {
  font-size: 0.95rem;
  line-height: 1.6;
  opacity: 0.7;
}

.fp-bom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-content: start;
}

/* Mobile */
@media (max-width: 640px) {
  .fp-ruler { display: none; }
  .fp-c { display: none; }
  .fp-die {
    grid-template-columns: 1fr;
    clip-path: none;
    border-top: 2px solid var(--hr-color);
    box-shadow: none;
  }
  .fp-block {
    grid-column: span 1 !important;
    border-bottom: 1px solid var(--hr-color) !important;
    border-top: none !important;
    border-left: none !important;
    border-right: none !important;
    min-height: 5rem;
  }
  .fp-block:last-child { border-bottom: none !important; }
  .fp-filter { gap: 0.35rem 0.5rem; }
  .fp-filter-divider { display: none; }
  .fp-bom-cols { display: none; }
  .fp-bom-row {
    grid-template-columns: 1fr;
    gap: 0.3rem 0;
  }
}
</style>
