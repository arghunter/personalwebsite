<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'
const { isDark } = useData()

// ── ADD A PROJECT ─────────────────────────────────────────────────────────────
// Copy one of the blocks below and fill in your fields.
//
//   name     — display name
//   type     — 'system' | 'asic' | 'dsp' | 'arch' | 'software'
//              use an array for two types: ['asic', 'dsp']
//   cols     — width in the 12-col grid: 6 = half, 4 = third, 3 = quarter
//   href     — GitHub / paper link, or null
//   writeup  — internal blog path like '/blogs/clear', or null
//   desc     — one-liner shown on the block
//   longDesc — full description shown in the detail panel (optional)
//   tags     — short labels: ['ASIC', 'Verilog', 'PCB']
//   specs    — key/value pairs for the detail panel table (optional)
//   wip      — true to show a WIP badge (optional)
// ─────────────────────────────────────────────────────────────────────────────

const projects = [
  {
    name: 'clEar',
    type: ['system', 'dsp'],
    cols: 6,
    href: 'https://github.com/arghunter/clEar',
    writeup: '/blogs/clear',
    desc: 'Glasses-based beamforming hearing aids · 71% STOI · 9.9 dB SNR · ISEF Grand Award',
    longDesc: 'clEar is a glasses-frame beamforming hearing aid system I designed and built from scratch. A 16-microphone MEMS array embedded in the glasses feeds a Zynq FPGA running a real-time MSMVDR beamformer, steering a null toward noise sources while amplifying speech in front of the wearer. The system achieves a 9.9 dB SNR improvement and 71% STOI score on standardized intelligibility benchmarks. I also implemented novel PDM bitstream operators that made the beamforming pipeline 250× faster than naive implementations. The project won the ISEF Third Grand Award.',
    tags: ['DSP', 'FPGA', 'PCB'],
    specs: { 'Architecture': 'FPGA + custom PCB', 'Microphones': '16-ch MEMS array', 'Algorithm': 'MSMVDR beamforming', 'SNR improvement': '+9.9 dB', 'STOI': '71%', 'Award': 'ISEF Third Grand Award' },
  },
  {
    name: 'Supermic+',
    type: ['asic', 'dsp'],
    cols: 6,
    href: 'https://github.com/arghunter/Supermic-tt08',
    writeup: '/blogs/supermic',
    desc: '8 ASICs on Tiny Tapeout 8 · 130nm Skywater CMOS · phased array beamforming & audio DSP',
    longDesc: 'A collection of 8 custom ASICs taped out on Tiny Tapeout 8 in the SKY130B 130nm process. The designs span beamforming hardware, audio DSP primitives, and PDM signal processing. Designed with Verilog and synthesized with OpenLane.',
    tags: ['ASIC', 'Verilog', 'DSP'],
    specs: { 'Process': 'SKY130B 130nm', 'Design count': '8 chips', 'Tapeout': 'Tiny Tapeout 8', 'Functions': 'Beamforming · audio DSP' },
  },
  {
    name: 'Acoustic Camera & PDM Operators',
    type: 'dsp',
    cols: 5,
    href: 'https://isef.net/project/ebed041-novel-pdm-operators-for-efficient-beamforming',
    writeup: null,
    desc: '250× runtime improvement · PDM bitstream math · ISEF 2nd Award',
    longDesc: 'Novel mathematical operators working directly on PDM bitstreams — addition, scaling, and delay without decimating to PCM. Applied to beamforming, eliminated the decimation step entirely and produced a 250× runtime speedup on FPGA. Algorithmic complexity dropped from O(n²) to sub-O(log n). Earned 2nd Place at ISEF.',
    tags: ['PDM', 'FPGA', 'DSP', 'PCB'],
    specs: { 'Runtime gain': '250×', 'Method': 'PDM bitstream arithmetic', 'Platform': 'FPGA', 'Award': 'ISEF 2nd Place' },
  },
  {
    name: 'UC Berkeley Potentiostat',
    type: 'system',
    cols: 4,
    href: 'https://github.com/arghunter/Potentiostat',
    writeup: null,
    desc: '18-channel high-speed potentiostat · UC Berkeley Nanotech · 256-ch electrochemical camera',
    longDesc: 'A high-speed 18-channel potentiostat for the UC Berkeley Nanotech lab. Applies precise voltage waveforms to electrode arrays and streams current responses simultaneously, enabling backprop for chemical testing. The electrochemical camera integrates FPGA-based data acquisition with real-time C# visualization.',
    tags: ['PCB', 'FPGA', 'DSP'],
    specs: { 'Channels': '18', 'Application': 'Electrochemical imaging', 'Affiliation': 'UC Berkeley Nanotech', 'ADC streams': '256-ch' },
  },
  {
    name: 'FlamProtect',
    type: 'software',
    cols: 3,
    href: 'https://github.com/arghunter/FlamProtect',
    writeup: null,
    desc: 'Genetic algorithm wildfire firebreak optimization',
    tags: ['Python'],
    specs: { 'Algorithm': 'Genetic optimization', 'Application': 'Wildfire firebreak routing', 'Language': 'Python' },
  },
  {
    name: '16-Mic Beamformer ASIC',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/16-Mic-Beamformer-Verilog',
    writeup: null,
    desc: '16-ch PDM beamformer · DDR input · I2S output · fabricated on TT08',
    longDesc: 'A 16-channel PDM beamformer ASIC taped out on Tiny Tapeout 8. Accepts DDR PDM input from 16 microphones, applies delay-and-sum beamforming in the PDM domain, and outputs a single steered I2S audio stream. Synthesized and place-and-routed via OpenLane on SKY130B 130nm.',
    tags: ['ASIC', 'Verilog', 'DSP'],
    specs: { 'Channels': '16', 'Input': 'PDM DDR', 'Output': 'I2S', 'Tapeout': 'Tiny Tapeout 8', 'Process': 'SKY130B 130nm' },
  },
  {
    name: 'PDM Pitch Filter ASIC',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/Customizable-PDM-Pitch-Filter-ASIC',
    writeup: null,
    desc: 'Narrowband notch filter operating directly on PDM bitstreams',
    longDesc: 'A configurable narrowband notch filter operating directly on PDM bitstreams. PDM\'s high oversampling rate gives high time resolution, exploited here to null a target frequency without decimating to PCM. Center frequency and bandwidth are configurable. Taped out on TT08 in SKY130B.',
    tags: ['ASIC', 'Verilog', 'DSP'],
    specs: { 'Type': 'Narrowband notch', 'Domain': 'PDM bitstream', 'Tapeout': 'Tiny Tapeout 8', 'Process': 'SKY130B 130nm' },
  },
  {
    name: 'PDM Correlator ASIC',
    type: 'asic',
    cols: 4,
    href: 'https://github.com/arghunter/Customizable-PDM-Cross-Correlator-ASIC',
    writeup: null,
    desc: 'Cross/auto correlator for direction-of-arrival on PDM bitstreams',
    longDesc: 'A PDM-domain cross and auto-correlator ASIC. Cross-correlation between microphone pairs gives time delay of arrival for DOA estimation. Auto-correlation gives the fundamental period for pitch detection — all without PCM conversion. Taped out on TT08 in SKY130B 130nm.',
    tags: ['ASIC', 'Verilog', 'DSP'],
    specs: { 'Output': 'Cross + auto correlation', 'Use case': 'DOA · pitch detection', 'Tapeout': 'Tiny Tapeout 8', 'Process': 'SKY130B 130nm' },
  },
  {
    name: 'DNN Accelerators',
    type: 'arch',
    cols: 4,
    href: null,
    writeup: null,
    desc: 'Custom FPGA accelerators · PDM, Ternary, and INT8 neural network inference',
    longDesc: 'A family of custom hardware accelerators for neural network inference on FPGA. Three variants: a PDM-input accelerator running inference directly on raw microphone bitstreams, a ternary-weight accelerator using {-1, 0, +1} weights for extreme compression, and an INT8 accelerator for standard quantized models. Designed in Chisel at MIT\'s Open Compute Lab.',
    tags: ['Chisel', 'FPGA', 'Verilog'],
    specs: { 'Precision': 'PDM · Ternary · INT8', 'Target': 'FPGA inference', 'HDL': 'Chisel' },
  },
  {
    name: 'RV32-IM CPU',
    type: 'arch',
    cols: 4,
    href: null,
    writeup: null,
    desc: 'Pipelined RISC-V CPU · ran Pong & Mandelbrot over VGA',
    longDesc: 'A 5-stage pipelined RISC-V RV32-IM processor in Verilog. Supports the full base integer ISA plus the M extension for hardware multiply/divide. Includes hazard detection, forwarding, and branch prediction. Stress-tested by compiling and running Pong and Mandelbrot, rendered over VGA.',
    tags: ['Verilog', 'Chisel', 'FPGA'],
    specs: { 'ISA': 'RISC-V RV32-IM', 'Type': '5-stage pipeline', 'HDL': 'Verilog', 'Demo': 'Pong, Mandelbrot over VGA' },
  },
  {
    name: 'FPGA Cluster',
    type: 'system',
    cols: 4,
    href: null,
    writeup: null,
    desc: 'Multi-FPGA cluster · >100 Gb/s bandwidth · >1.6M logic slices',
    wip: true,
    tags: ['FPGA', 'PCB'],
    specs: { 'Bandwidth': '>100 Gb/s inter-FPGA', 'Logic slices': '>1.6M', 'Status': 'WIP' },
  },
]

const colorsDark = {
  system:   { bg: 'rgba(154,125,191,0.2)', border: 'rgba(154,125,191,0.6)', text: '#b39dd6' },
  asic:     { bg: 'rgba(196,144,96,0.2)',  border: 'rgba(196,144,96,0.6)',  text: '#d4a872' },
  dsp:      { bg: 'rgba(91,160,187,0.2)',  border: 'rgba(91,160,187,0.6)',  text: '#7abcce' },
  arch:     { bg: 'rgba(79,155,122,0.2)',  border: 'rgba(79,155,122,0.6)',  text: '#6db896' },
  software: { bg: 'rgba(136,120,196,0.18)', border: 'rgba(136,120,196,0.58)', text: '#a090d4' },
}
const colorsLight = {
  system:   { bg: 'rgba(109,68,180,0.09)',  border: 'rgba(109,68,180,0.5)',  text: '#5b3a9e' },
  asic:     { bg: 'rgba(160,80,20,0.09)',   border: 'rgba(160,80,20,0.5)',   text: '#8a4a18' },
  dsp:      { bg: 'rgba(30,100,140,0.09)',  border: 'rgba(30,100,140,0.5)',  text: '#1e6488' },
  arch:     { bg: 'rgba(30,110,78,0.09)',   border: 'rgba(30,110,78,0.5)',   text: '#1e6e4e' },
  software: { bg: 'rgba(80,55,160,0.09)',   border: 'rgba(80,55,160,0.5)',   text: '#4a389e' },
}
const colors = computed(() => isDark.value ? colorsDark : colorsLight)

function types(p)   { return Array.isArray(p.type) ? p.type : [p.type] }
function primary(p) { return types(p)[0] }
function nameColor(p) {
  const t = types(p)
  return t.length > 1 ? 'var(--primary-lt)' : colors.value[t[0]].text
}

function blockStyle(p) {
  const t = types(p)
  const s = t[1] ?? t[0]
  const c = colors.value
  const raw = p._cols ?? p.cols
  const span = gridCols.value === 12
    ? raw
    : Math.max(1, Math.round(raw * gridCols.value / 12))
  return {
    '--bg-p': c[t[0]].bg,
    '--bd-p': c[t[0]].border,
    '--bg-s': c[s].bg,
    '--bd-s': c[s].border,
    gridColumn: `span ${span}`,
  }
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

const scaledProjects = computed(() => {
  const fp = filteredProjects.value
  if (!hasFilters.value || fp.length === 0) return fp
  const rows = []
  let row = [], sum = 0
  for (const p of fp) {
    if (sum + p.cols > 12 && row.length > 0) { rows.push(row); row = [p]; sum = p.cols }
    else { row.push(p); sum += p.cols }
  }
  if (row.length > 0) rows.push(row)
  return rows.flatMap(row => {
    const total = row.reduce((s, p) => s + p.cols, 0)
    let rem = 12
    return row.map((p, i) => {
      const cols = i === row.length - 1 ? rem : Math.max(2, Math.round(p.cols * 12 / total))
      if (i < row.length - 1) rem -= cols
      return { ...p, _cols: cols }
    })
  })
})

function toggleType(type) {
  const s = new Set(activeTypes.value); s.has(type) ? s.delete(type) : s.add(type); activeTypes.value = s
}
function toggleTag(tag) {
  const s = new Set(activeTags.value); s.has(tag) ? s.delete(tag) : s.add(tag); activeTags.value = s
}
function clearFilters() { activeTypes.value = new Set(); activeTags.value = new Set() }

// ── Responsive grid ───────────────────────────────────────────────────────
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const gridCols = computed(() => windowWidth.value < 768 ? 6 : 12)

// ── Detail panel ──────────────────────────────────────────────────────────
const selectedProject = ref(null)
const selectedIndex = computed(() =>
  selectedProject.value ? projects.findIndex(p => p.name === selectedProject.value.name) : -1
)
function openPanel(p) { selectedProject.value = projects.find(q => q.name === p.name) ?? p }
function closePanel() { selectedProject.value = null }

function onKeyDown(e) { if (e.key === 'Escape') closePanel() }
function onResize()   { windowWidth.value = window.innerWidth }

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize, { passive: true })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
})

const legend = [
  { type: 'system',   label: 'System' },
  { type: 'asic',     label: 'ASIC' },
  { type: 'dsp',      label: 'DSP' },
  { type: 'arch',     label: 'Arch' },
  { type: 'software', label: 'SW' },
]
</script>

<template>
  <div class="fp">

    <!-- Filter bar -->
    <div class="fp-filter">
      <button
        v-for="l in legend" :key="l.type"
        class="fp-ft" :class="{ active: activeTypes.has(l.type) }"
        :style="{ '--c': colors[l.type].text, '--b': colors[l.type].border }"
        @click="toggleType(l.type)"
      >
        <span class="fp-dot" :style="{ background: colors[l.type].text }"></span>
        {{ l.label }}
      </button>
      <span class="fp-sep" aria-hidden="true"></span>
      <button
        v-for="tag in allTags" :key="tag"
        class="fp-tg" :class="{ active: activeTags.has(tag) }"
        @click="toggleTag(tag)"
      >{{ tag }}</button>
      <button v-if="hasFilters" class="fp-clr" @click="clearFilters">× clear</button>
    </div>

    <!-- Die grid -->
    <div class="fp-die-wrap">
      <TransitionGroup tag="div" class="fp-die" name="fp-block">
        <div
          v-for="p in scaledProjects" :key="p.name"
          class="fp-block"
          :style="blockStyle(p)"
          :data-multi="types(p).length > 1 ? '' : undefined"
          @click="openPanel(p)"
        >
          <div class="fp-block-head">
            <div class="fp-block-types">
              <span
                v-for="t in types(p)" :key="t"
                class="fp-type-label"
                :style="{ color: colors[t].text }"
              >{{ legend.find(l => l.type === t)?.label ?? t }}</span>
            </div>
            <span v-if="p.wip" class="fp-wip">WIP</span>
          </div>
          <div class="fp-block-name" :style="{ color: nameColor(p) }">{{ p.name }}</div>
          <div class="fp-block-desc">{{ p.desc }}</div>
          <div class="fp-block-tags">
            <span
              v-for="tag in p.tags" :key="tag"
              class="fp-tag"
              :style="{ borderColor: colors[primary(p)].border, color: colors[primary(p)].text }"
            >{{ tag }}</span>
          </div>
        </div>
      </TransitionGroup>
      <span class="fp-c fp-c-tl" aria-hidden="true"></span>
      <span class="fp-c fp-c-tr" aria-hidden="true"></span>
      <span class="fp-c fp-c-bl" aria-hidden="true"></span>
      <span class="fp-c fp-c-br" aria-hidden="true"></span>
    </div>

    <div v-if="filteredProjects.length === 0" class="fp-empty">no blocks match</div>
    <div class="fp-status" aria-hidden="true">{{ filteredProjects.length }} / {{ projects.length }} placed</div>

  </div>

  <!-- Detail panel -->
  <Transition name="fp-panel">
    <div v-if="selectedProject" class="fp-panel-backdrop" @click.self="closePanel">
      <div class="fp-panel" role="dialog" :aria-label="selectedProject.name">

        <div class="fp-panel-header" :style="{ borderLeftColor: colors[primary(selectedProject)].text }">
          <div class="fp-panel-title">
            <div class="fp-panel-types">
              <span
                v-for="t in types(selectedProject)" :key="t"
                class="fp-type-label"
                :style="{ color: colors[t].text }"
              >{{ legend.find(l => l.type === t)?.label ?? t }}</span>
            </div>
            <span class="fp-panel-name" :style="{ color: nameColor(selectedProject) }">
              {{ selectedProject.name }}
            </span>
            <span v-if="selectedProject.wip" class="fp-wip">WIP</span>
          </div>
          <button class="fp-panel-close" @click="closePanel">× close</button>
        </div>

        <div class="fp-panel-body">
          <p class="fp-panel-desc">{{ selectedProject.longDesc ?? selectedProject.desc }}</p>
          <table v-if="selectedProject.specs" class="fp-panel-specs">
            <tbody>
              <tr v-for="(val, key) in selectedProject.specs" :key="key">
                <td class="fp-spec-key">{{ key }}</td>
                <td class="fp-spec-val" :style="{ color: colors[primary(selectedProject)].text }">{{ val }}</td>
              </tr>
            </tbody>
          </table>
          <div class="fp-panel-links">
            <a v-if="selectedProject.writeup" :href="selectedProject.writeup" class="fp-panel-btn fp-panel-btn-primary" @click="closePanel">→ writeup</a>
            <a v-if="selectedProject.href" :href="selectedProject.href" target="_blank" rel="noopener" class="fp-panel-btn">↗ source</a>
          </div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fp {
  font-family: 'DM Mono', monospace;
  margin: 1.5rem 0;
}

/* ── Filter bar ─────────────────────────────────────────────────────────── */
.fp-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.45rem;
  margin-bottom: 0.75rem;
}
.fp-ft {
  display: flex; align-items: center; gap: 0.3rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.2rem 0.55rem 0.2rem 0.38rem;
  border: 1px solid color-mix(in srgb, var(--b) 40%, transparent);
  background: transparent; color: var(--primary-lt);
  opacity: 0.5; cursor: pointer;
  transition: opacity 0.15s, border-color 0.15s, color 0.15s, background 0.15s;
}
.fp-ft:hover  { opacity: 0.9; border-color: var(--b); color: var(--c); }
.fp-ft.active { opacity: 1; border-color: var(--b); color: var(--c);
  background: color-mix(in srgb, var(--b) 12%, transparent); }
.fp-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.fp-sep { width: 1px; height: 1rem; background: var(--hr-color); opacity: 0.5; flex-shrink: 0; margin: 0 0.1rem; }
.fp-tg {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.18rem 0.45rem;
  border: 1px solid var(--hr-color); background: transparent; color: var(--primary-lt);
  opacity: 0.4; cursor: pointer;
  transition: opacity 0.15s, border-color 0.15s, color 0.15s, background 0.15s;
}
.fp-tg:hover  { opacity: 0.85; border-color: var(--accent); color: var(--accent); }
.fp-tg.active { opacity: 1; border-color: var(--accent); color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent); }
.fp-clr {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem; letter-spacing: 0.08em;
  padding: 0.18rem 0.45rem;
  border: 1px solid var(--hr-color); background: transparent; color: var(--primary-lt);
  opacity: 0.35; cursor: pointer; margin-left: auto;
  transition: opacity 0.15s, border-color 0.15s;
}
.fp-clr:hover { opacity: 0.8; border-color: var(--accent); }

/* ── Die ────────────────────────────────────────────────────────────────── */
.fp-die-wrap { position: relative; }

.fp-die {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: minmax(9rem, auto);
  grid-auto-flow: dense;
  border: 1px solid var(--hr-color);
}

.fp-c {
  position: absolute;
  width: 9px; height: 9px;
  pointer-events: none; opacity: 0.35;
}
.fp-c-tl { top: 0;    left: 0;  border-top: 1px solid var(--accent); border-left:  1px solid var(--accent); }
.fp-c-tr { top: 0;    right: 0; border-top: 1px solid var(--accent); border-right: 1px solid var(--accent); }
.fp-c-bl { bottom: 0; left: 0;  border-bottom: 1px solid var(--accent); border-left:  1px solid var(--accent); }
.fp-c-br { bottom: 0; right: 0; border-bottom: 1px solid var(--accent); border-right: 1px solid var(--accent); }

/* ── Blocks ─────────────────────────────────────────────────────────────── */
.fp-block-enter-active, .fp-block-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fp-block-enter-from,   .fp-block-leave-to     { opacity: 0; transform: scale(0.97); }

.fp-block {
  border: 1px solid var(--bd-p);
  background: var(--bg-p);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 1rem 1.15rem 0.9rem;
  display: flex; flex-direction: column; gap: 0.4rem;
  color: var(--primary-lt);
  cursor: pointer; position: relative;
  transition: background 0.25s ease, border-color 0.25s ease;
}
.fp-block:hover { background: var(--bg-s) !important; border-color: var(--bd-s) !important; }

.fp-block[data-multi]::after {
  content: '';
  position: absolute; top: 0; right: 0;
  border-style: solid; border-width: 0 10px 10px 0;
  border-color: transparent var(--bd-s) transparent transparent;
  opacity: 0.55; transition: opacity 0.25s ease;
}
.fp-block[data-multi]:hover::after { opacity: 0; }

.fp-block-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.1rem;
}
.fp-block-types { display: flex; gap: 0.4rem; }
.fp-type-label {
  font-size: 0.56rem; letter-spacing: 0.12em;
  text-transform: uppercase; font-weight: 600;
}

.fp-block-name {
  font-size: 1rem; font-weight: 700;
  letter-spacing: 0.02em; line-height: 1.2;
  color: var(--primary-lt) !important;
}

.fp-block-desc {
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.85rem; line-height: 1.6;
  opacity: 0.85; flex: 1;
}

.fp-block-tags { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: auto; padding-top: 0.35rem; }
.fp-tag {
  font-size: 0.52rem; letter-spacing: 0.08em;
  text-transform: uppercase; border: 1px solid; padding: 0.05rem 0.28rem;
}
.fp-wip {
  font-size: 0.48rem; letter-spacing: 0.1em;
  color: var(--primary-lt); border: 1px solid var(--hr-color);
  padding: 0.04rem 0.22rem; opacity: 0.4;
}

.fp-empty {
  padding: 2rem; text-align: center;
  font-size: 0.58rem; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.2;
}
.fp-status {
  margin-top: 0.45rem; font-size: 0.5rem;
  letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.2; text-align: right;
}

/* Light mode */
:global(html.light) .fp-block { box-shadow: inset 0 0 0 9999px rgba(255,255,255,0.45); }
:global(html.light) .fp-block-desc { opacity: 1; }

/* Medium screens */
@media (max-width: 768px) {
  .fp-die { grid-template-columns: repeat(6, 1fr); }
  .fp-c   { display: none; }
}
/* Small screens */
@media (max-width: 480px) {
  .fp-sep { display: none; }
  .fp-die { grid-template-columns: 1fr; }
  .fp-block { grid-column: span 1 !important; min-height: 7rem; }
}

/* ── Detail panel ───────────────────────────────────────────────────────── */
.fp-panel-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}
.fp-panel {
  font-family: 'DM Mono', monospace;
  background: var(--detail-lt);
  border: 1px solid var(--hr-color);
  width: 100%; max-width: 36rem; max-height: 85vh;
  overflow-y: auto; display: flex; flex-direction: column;
}
.fp-panel-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--hr-color);
  border-left: 3px solid;
}
.fp-panel-title { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 0; }
.fp-panel-types { display: flex; gap: 0.5rem; }
.fp-panel-name  { font-size: 1.05rem; font-weight: 700; letter-spacing: 0.02em; line-height: 1.2; }
.fp-panel-close {
  font-family: 'DM Mono', monospace; font-size: 0.55rem; letter-spacing: 0.1em;
  background: transparent; border: 1px solid var(--hr-color); color: var(--primary-lt);
  padding: 0.2rem 0.5rem; cursor: pointer; opacity: 0.4; flex-shrink: 0;
  align-self: flex-start; transition: opacity 0.15s;
}
.fp-panel-close:hover { opacity: 1; }
.fp-panel-body { padding: 1.1rem; display: flex; flex-direction: column; gap: 1rem; }
.fp-panel-desc {
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.92rem; line-height: 1.72; opacity: 0.85; margin: 0;
}
.fp-panel-specs { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.fp-panel-specs tr { border-bottom: 1px solid color-mix(in srgb, var(--hr-color) 55%, transparent); }
.fp-panel-specs tr:last-child { border-bottom: none; }
.fp-spec-key {
  padding: 0.35rem 0.75rem 0.35rem 0; letter-spacing: 0.05em;
  text-transform: uppercase; opacity: 0.38; white-space: nowrap; width: 40%; font-size: 0.68rem;
}
.fp-spec-val { padding: 0.35rem 0; font-weight: 600; letter-spacing: 0.03em; }
.fp-panel-links {
  display: flex; gap: 0.5rem; padding-top: 0.25rem;
  border-top: 1px solid color-mix(in srgb, var(--hr-color) 55%, transparent);
}
.fp-panel-btn {
  font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.1em;
  padding: 0.3rem 0.75rem; border: 1px solid var(--hr-color);
  color: var(--primary-lt); text-decoration: none; opacity: 0.55;
  transition: opacity 0.15s, border-color 0.15s;
}
.fp-panel-btn:hover { opacity: 1; border-color: var(--accent); text-decoration: none; }
.fp-panel-btn-primary { border-color: var(--accent); color: var(--accent); opacity: 0.85; }
.fp-panel-btn-primary:hover { opacity: 1; }

.fp-panel-enter-active { transition: opacity 0.2s ease; }
.fp-panel-leave-active { transition: opacity 0.15s ease; }
.fp-panel-enter-from, .fp-panel-leave-to { opacity: 0; }
</style>
