<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vitepress'
// @ts-ignore
import graphData from 'virtual:site-graph'

const router = useRouter()
const svgEl  = ref<SVGSVGElement | null>(null)

const IW = 148, IH = 44
const EW = 124, EH = 36

const IPOS: Record<string, [number, number]> = {
  '/':            [700,  430],
  '/blog':        [370,  210],
  '/projects':    [1030, 210],
  '/experience':  [1030, 650],
  '/contact':     [370,  650],
  '/now':         [700,  770],
  '/graph':       [700,  110],
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const isDark = ref(true)
let themeObserver: MutationObserver | null = null

const C = computed(() => isDark.value ? {
  bg: '#100c2a', gridMinor: 'rgba(140,100,255,0.10)', gridMajor: 'rgba(140,100,255,0.22)',
  nodeIntFill: '#1e1750', nodeIntStroke: '#a78bfa', nodeIntDim: '#3d2f8e',
  nodeIntText: '#ffffff', nodeIntStrip: '#a78bfa',
  nodeExtFill: '#0e1e38', nodeExtStroke: '#22d3ee', nodeExtDim: '#1a4060', nodeExtText: '#ffffff',
  edgeInt: '#a78bfa', edgeExt: '#22d3ee', via: '#fbbf24', pin: '#a78bfa',
  ui: 'rgba(20,16,56,0.97)', uiBorder: '#3d2f8e', uiText: '#ffffff', uiTextDim: '#a78bfa',
} : {
  bg: '#e9e4ff', gridMinor: 'rgba(100,70,220,0.08)', gridMajor: 'rgba(100,70,220,0.18)',
  nodeIntFill: '#f3f0ff', nodeIntStroke: '#7c3aed', nodeIntDim: '#c4b5fd',
  nodeIntText: '#5b21b6', nodeIntStrip: '#7c3aed',
  nodeExtFill: '#eef9ff', nodeExtStroke: '#0284c7', nodeExtDim: '#bae6fd', nodeExtText: '#075985',
  edgeInt: '#7c3aed', edgeExt: '#0284c7', via: '#d97706', pin: '#7c3aed',
  ui: 'rgba(243,240,255,0.95)', uiBorder: '#c4b5fd', uiText: '#5b21b6', uiTextDim: '#9d87d4',
})

// ── Pan / zoom ────────────────────────────────────────────────────────────────
const pan  = ref({ x: 0, y: 0 })
const zoom = ref(0.9)
let panning = false
let po = { x: 0, y: 0, ox: 0, oy: 0 }

const xform = computed(() => `translate(${pan.value.x} ${pan.value.y}) scale(${zoom.value})`)
const zoomPct = computed(() => `${Math.round(zoom.value * 100)}%`)

function fitView() {
  const ns = nodes.value
  if (!ns.length) return
  const pad = 80
  const minX = Math.min(...ns.map(n=>n.x)) - pad
  const maxX = Math.max(...ns.map(n=>n.x)) + pad
  const minY = Math.min(...ns.map(n=>n.y)) - pad
  const maxY = Math.max(...ns.map(n=>n.y)) + pad
  const w = window.innerWidth, h = window.innerHeight - 56
  const scaleX = w / (maxX - minX), scaleY = h / (maxY - minY)
  zoom.value = Math.min(scaleX, scaleY, 1.2)
  pan.value = {
    x: w/2 - ((minX+maxX)/2) * zoom.value,
    y: h/2 - ((minY+maxY)/2) * zoom.value,
  }
}

const gridStyle = computed(() => {
  const c = C.value, s20 = 20 * zoom.value, s100 = 100 * zoom.value
  const ox = pan.value.x, oy = pan.value.y
  return {
    backgroundColor: c.bg,
    backgroundImage: `linear-gradient(${c.gridMajor} 1px,transparent 1px),linear-gradient(90deg,${c.gridMajor} 1px,transparent 1px),linear-gradient(${c.gridMinor} 1px,transparent 1px),linear-gradient(90deg,${c.gridMinor} 1px,transparent 1px)`,
    backgroundSize: `${s100}px ${s100}px,${s100}px ${s100}px,${s20}px ${s20}px,${s20}px ${s20}px`,
    backgroundPosition: `${ox%s100}px ${oy%s100}px,${ox%s100}px ${oy%s100}px,${ox%s20}px ${oy%s20}px,${ox%s20}px ${oy%s20}px`,
    transition: 'background-color 250ms ease',
  }
})

// ── Layout ────────────────────────────────────────────────────────────────────
interface LNode { id: string; label: string; type: string; url: string; x: number; y: number }

const nodes = computed<LNode[]>(() => {
  const result: LNode[] = graphData.nodes.map((n: any) => ({ ...n, x: 0, y: 0 }))
  const byId = new Map<string, LNode>(result.map(n => [n.id, n]))

  // Place known internal nodes at fixed positions; spread unknown ones in a ring
  const unknownInternals: LNode[] = []
  for (const n of result) {
    if (n.type !== 'internal') continue
    const p = IPOS[n.id]
    if (p) { n.x = p[0]; n.y = p[1] }
    else unknownInternals.push(n)
  }
  unknownInternals.forEach((n, i) => {
    const angle = (i / Math.max(1, unknownInternals.length)) * 2 * Math.PI - Math.PI / 2
    n.x = 700 + Math.cos(angle) * 380
    n.y = 430 + Math.sin(angle) * 280
  })

  // Push direction away from center (700, 430), with fallback angle when at center
  function pushDir(sx: number, sy: number, fallbackAngle = -Math.PI/2): [number,number] {
    const dx = sx-700, dy = sy-430, d = Math.sqrt(dx*dx+dy*dy)
    if (d < 10) return [Math.cos(fallbackAngle), Math.sin(fallbackAngle)]
    return [dx/d, dy/d]
  }

  // Position each external node at the centroid of ALL its internal sources, pushed outward
  for (const n of result) {
    if (n.type !== 'external') continue
    const srcs = graphData.edges
      .filter((e: any) => e.to === n.id)
      .map((e: any) => byId.get(e.from))
      .filter((s: any) => s?.type === 'internal') as LNode[]
    if (!srcs.length) { n.x = 700; n.y = 60; continue }
    const cx = srcs.reduce((s, v) => s + v.x, 0) / srcs.length
    const cy = srcs.reduce((s, v) => s + v.y, 0) / srcs.length
    const [ndx, ndy] = pushDir(cx, cy)
    n.x = cx + ndx * 300
    n.y = cy + ndy * 300
  }

  // Repulsion pass — separate any remaining overlaps
  const MIN_DIST = 150
  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < result.length; i++) {
      for (let j = i+1; j < result.length; j++) {
        const a = result[i], b = result[j]
        let dx = b.x-a.x, dy = b.y-a.y
        const dist = Math.sqrt(dx*dx+dy*dy)
        // Give near-zero pairs a random-ish push direction based on index
        if (dist < 0.5) { dx = Math.cos(i*2.3+j); dy = Math.sin(i*2.3+j) }
        const d = Math.sqrt(dx*dx+dy*dy)
        if (dist < MIN_DIST) {
          const push = (MIN_DIST-dist)/2
          const nx = dx/d, ny = dy/d
          const aMovable = a.type === 'external' || (a.type === 'internal' && !IPOS[a.id])
          const bMovable = b.type === 'external' || (b.type === 'internal' && !IPOS[b.id])
          if (bMovable) { b.x += nx*push; b.y += ny*push }
          if (aMovable) { a.x -= nx*push; a.y -= ny*push }
        }
      }
    }
  }

  return result
})

function shortLabel(label: string, max = 14): string {
  return label.length > max ? label.slice(0, max - 1).trimEnd() + '…' : label
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = computed(() => ({
  pages:    graphData.nodes.filter((n:any) => n.type === 'internal').length,
  external: graphData.nodes.filter((n:any) => n.type === 'external').length,
  edges:    graphData.edges.length,
}))

// ── Routing ───────────────────────────────────────────────────────────────────
function edgePath(fromId: string, toId: string): string {
  const m = new Map(nodes.value.map(n=>[n.id,n]))
  const a=m.get(fromId), b=m.get(toId); if(!a||!b) return ''
  const mx=(a.x+b.x)/2
  return `M${a.x},${a.y} L${mx},${a.y} L${mx},${b.y} L${b.x},${b.y}`
}
function vias(fromId: string, toId: string): [number,number][] {
  const m = new Map(nodes.value.map(n=>[n.id,n]))
  const a=m.get(fromId), b=m.get(toId); if(!a||!b) return []
  const mx=(a.x+b.x)/2; return [[mx,a.y],[mx,b.y]]
}
function edgeBaseColor(toId: string): string {
  const m = new Map(nodes.value.map(n=>[n.id,n]))
  return m.get(toId)?.type==='external' ? C.value.edgeExt : C.value.edgeInt
}

// ── Pulse animation ───────────────────────────────────────────────────────────
const litEdges   = ref(new Set<number>())
const pulseDone  = ref(false)

function startPulse() {
  const order: number[] = []
  const visited = new Set(['/'])
  const queue = ['/']
  while (queue.length) {
    const curr = queue.shift()!
    graphData.edges.forEach((e: any, i: number) => {
      if (e.from === curr && !order.includes(i)) {
        order.push(i); visited.add(e.to); queue.push(e.to)
      }
    })
  }
  graphData.edges.forEach((_: any, i: number) => { if (!order.includes(i)) order.push(i) })

  order.forEach((idx, i) => {
    setTimeout(() => {
      litEdges.value = new Set([...litEdges.value, idx])
      if (i === order.length - 1) setTimeout(() => { pulseDone.value = true }, 400)
    }, 400 + i * 120)
  })
}

function edgeVisible(i: number): boolean { return pulseDone.value || litEdges.value.has(i) }
function edgeOpacity(i: number, active: boolean, dimmed: boolean): number {
  if (!edgeVisible(i)) return 0
  if (dimmed) return 0.07
  if (active) return 1
  return 0.35
}

// ── Isolate on double-click ───────────────────────────────────────────────────
const isolated = ref<string | null>(null)

function getConnected(id: string): Set<string> {
  const s = new Set([id])
  for (const e of graphData.edges) {
    if (e.from === id) s.add(e.to)
    if (e.to === id) s.add(e.from)
  }
  return s
}
function isNodeDimmed(id: string): boolean {
  if (isolated.value) return !getConnected(isolated.value).has(id)
  if (searchQuery.value) return !nodeMatchesSearch(id)
  return false
}
function isEdgeDimmed(e: any): boolean {
  if (isolated.value) return e.from !== isolated.value && e.to !== isolated.value
  if (searchQuery.value) {
    return !nodeMatchesSearch(e.from) && !nodeMatchesSearch(e.to)
  }
  return false
}

// ── Search ────────────────────────────────────────────────────────────────────
const searchQuery  = ref('')
const searchEl     = ref<HTMLInputElement | null>(null)

function nodeMatchesSearch(id: string): boolean {
  if (!searchQuery.value) return true
  const n = nodes.value.find(n => n.id === id)
  return !!n && n.label.toLowerCase().includes(searchQuery.value.toLowerCase())
}

// ── Hover + tooltip ───────────────────────────────────────────────────────────
const hovered     = ref<string | null>(null)
const mousePos    = ref({ x: 0, y: 0 })
const hoveredNode = computed(() => nodes.value.find(n => n.id === hovered.value) ?? null)
function isActive(e: any): boolean { return !isolated.value && !searchQuery.value && (hovered.value===e.from||hovered.value===e.to) }

// ── Mini-map ──────────────────────────────────────────────────────────────────
const MM_W = 160, MM_H = 100
const MM_PAD = 60
const MM_BX = -200, MM_BY = -100, MM_BW = 1600, MM_BH = 1100

function toMM(wx: number, wy: number): [number, number] {
  return [(wx-MM_BX)/MM_BW*MM_W, (wy-MM_BY)/MM_BH*MM_H]
}

const mmViewport = computed(() => {
  const w = window.innerWidth, h = window.innerHeight - 56
  const wx1=(0-pan.value.x)/zoom.value, wy1=(0-pan.value.y)/zoom.value
  const wx2=(w-pan.value.x)/zoom.value, wy2=(h-pan.value.y)/zoom.value
  const [x1,y1]=toMM(wx1,wy1), [x2,y2]=toMM(wx2,wy2)
  return { x: Math.max(0,x1), y: Math.max(0,y1), w: Math.min(MM_W,x2)-Math.max(0,x1), h: Math.min(MM_H,y2)-Math.max(0,y1) }
})

function onMinimapClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mx = (e.clientX-rect.left)/MM_W, my = (e.clientY-rect.top)/MM_H
  const wx = mx*MM_BW+MM_BX, wy = my*MM_BH+MM_BY
  const w = window.innerWidth, h = window.innerHeight-56
  pan.value = { x: w/2-wx*zoom.value, y: h/2-wy*zoom.value }
}

// ── Mouse ─────────────────────────────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
  if ((e.target as Element).closest('.gnode')) return
  panning=true; po={x:e.clientX,y:e.clientY,ox:pan.value.x,oy:pan.value.y}
}
function onMouseMove(e: MouseEvent) {
  mousePos.value={x:e.clientX,y:e.clientY}
  if(!panning) return
  pan.value={x:po.ox+e.clientX-po.x, y:po.oy+e.clientY-po.y}
}
function onMouseUp() { panning=false }
function onBgClick(e: MouseEvent) {
  if ((e.target as Element).closest('.gnode')) return
  isolated.value=null; searchQuery.value=''
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const rect=svgEl.value!.getBoundingClientRect()
  const mx=e.clientX-rect.left, my=e.clientY-rect.top
  const f=e.deltaY>0?0.92:1.08, nz=Math.max(0.2,Math.min(4,zoom.value*f))
  pan.value={x:mx-(mx-pan.value.x)*(nz/zoom.value), y:my-(my-pan.value.y)*(nz/zoom.value)}
  zoom.value=nz
}
function onNodeClick(node: LNode) {
  if (isolated.value === node.id) { isolated.value=null; return }
  if (node.type==='internal') router.go(node.url)
  else window.open(node.url,'_blank','noopener')
}
function onNodeDblClick(node: LNode) {
  isolated.value = isolated.value===node.id ? null : node.id
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key==='/' && document.activeElement !== searchEl.value) {
    e.preventDefault(); searchEl.value?.focus()
  }
  if (e.key==='Escape') { searchQuery.value=''; isolated.value=null; searchEl.value?.blur() }
}

onMounted(async () => {
  isDark.value = !document.documentElement.classList.contains('light')
  themeObserver = new MutationObserver(() => { isDark.value = !document.documentElement.classList.contains('light') })
  themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:['class'] })
  window.addEventListener('keydown', onKeyDown)

  await nextTick()
  fitView()
  startPulse()
})
onUnmounted(() => {
  themeObserver?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <svg
    ref="svgEl" class="graph-svg" :style="gridStyle"
    @mousedown="onMouseDown" @mousemove="onMouseMove"
    @mouseup="onMouseUp" @mouseleave="onMouseUp"
    @wheel.prevent="onWheel" @click="onBgClick"
  >
    <defs>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-soft" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <g :transform="xform">
      <!-- Edges -->
      <g v-for="(edge,i) in graphData.edges" :key="`e${i}`">
        <path
          :d="edgePath(edge.from,edge.to)" fill="none"
          :stroke="edgeBaseColor(edge.to)"
          :stroke-width="isActive(edge) ? 2 : 1.5"
          :stroke-dasharray="isActive(edge) ? '10 7' : undefined"
          :class="isActive(edge) ? 'edge-flow' : ''"
          :opacity="edgeOpacity(i, isActive(edge), isEdgeDimmed(edge))"
          :filter="isActive(edge) ? 'url(#glow)' : undefined"
          style="transition: opacity 300ms ease"
        />
        <circle
          v-for="([vx,vy],vi) in vias(edge.from,edge.to)" :key="vi"
          :cx="vx" :cy="vy" r="3"
          :fill="isActive(edge) ? C.via : C.via+'55'"
          :opacity="edgeVisible(i) ? 1 : 0"
          :filter="isActive(edge) ? 'url(#glow-soft)' : undefined"
          style="transition: opacity 300ms ease"
        />
      </g>

      <!-- Nodes -->
      <g
        v-for="node in nodes" :key="node.id" class="gnode"
        :transform="`translate(${node.x},${node.y})`"
        style="cursor:pointer"
        :opacity="isNodeDimmed(node.id) ? 0.12 : 1"
        @mouseenter="hovered=node.id" @mouseleave="hovered=null"
        @click.stop="onNodeClick(node)" @dblclick.stop="onNodeDblClick(node)"
      >
        <template v-if="node.type==='internal'">
          <rect :x="-IW/2" :y="-IH/2" :width="IW" :height="IH" rx="3"
            :fill="C.nodeIntFill"
            :stroke="(hovered===node.id||isolated===node.id) ? C.nodeIntStroke : C.nodeIntDim"
            :stroke-width="(hovered===node.id||isolated===node.id) ? 2 : 1.5"
            :filter="(hovered===node.id||isolated===node.id) ? 'url(#glow)' : 'url(#glow-soft)'"
          />
          <rect :x="-IW/2+4" :y="-IH/2" :width="IW-8" height="3" rx="1.5"
            :fill="C.nodeIntStrip" :opacity="hovered===node.id ? 1 : 0.5"
          />
          <rect :x="-IW/2-5" y="-6" width="5" height="12" rx="1" :fill="C.pin" opacity="0.7"/>
          <rect :x="IW/2" y="-6" width="5" height="12" rx="1" :fill="C.pin" opacity="0.7"/>
          <text x="0" y="2" text-anchor="middle" dominant-baseline="central"
            :fill="C.nodeIntText" font-family="'DM Mono',monospace" font-size="13"
            :font-weight="hovered===node.id ? 600 : 400" letter-spacing="1.5"
          >{{ shortLabel(node.label) }}</text>
        </template>
        <template v-else>
          <rect :x="-EW/2" :y="-EH/2" :width="EW" :height="EH" rx="2"
            :fill="C.nodeExtFill"
            :stroke="hovered===node.id ? C.nodeExtStroke : C.nodeExtDim"
            stroke-width="1" stroke-dasharray="5 3"
            :filter="hovered===node.id ? 'url(#glow)' : undefined"
          />
          <path :d="`M${-EW/2},${-EH/2+7} L${-EW/2},${-EH/2} L${-EW/2+7},${-EH/2}`"
            fill="none" :stroke="C.nodeExtStroke" stroke-width="1.5" opacity="0.8"/>
          <path :d="`M${EW/2-7},${EH/2} L${EW/2},${EH/2} L${EW/2},${EH/2-7}`"
            fill="none" :stroke="C.nodeExtStroke" stroke-width="1.5" opacity="0.8"/>
          <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
            :fill="C.nodeExtText" font-family="'DM Mono',monospace" font-size="11"
            :opacity="hovered===node.id ? 1 : 0.8" letter-spacing="1"
          >{{ shortLabel(node.label) }}</text>
        </template>
      </g>
    </g>
  </svg>

  <!-- Search bar -->
  <div class="graph-search-wrap">
    <input
      ref="searchEl"
      v-model="searchQuery"
      class="graph-search"
      placeholder="search nodes  [/]"
      :style="{ background: C.ui, borderColor: searchQuery ? C.nodeIntStroke : C.uiBorder, color: C.uiText }"
      spellcheck="false"
    />
  </div>

  <!-- Mini-map -->
  <div class="graph-minimap" :style="{ background: C.ui, borderColor: C.uiBorder }" @click="onMinimapClick">
    <svg :width="MM_W" :height="MM_H">
      <!-- Edge lines -->
      <line
        v-for="(edge,i) in graphData.edges" :key="`me${i}`"
        v-bind="(() => {
          const m=new Map(nodes.map(n=>[n.id,n]))
          const a=m.get(edge.from),b=m.get(edge.to)
          if(!a||!b) return {}
          const [x1,y1]=toMM(a.x,a.y),[x2,y2]=toMM(b.x,b.y)
          return {x1,y1,x2,y2}
        })()"
        :stroke="edgeBaseColor(edge.to)" stroke-width="0.5" opacity="0.4"
      />
      <!-- Node dots -->
      <rect
        v-for="node in nodes" :key="`mn${node.id}`"
        v-bind="(() => { const [x,y]=toMM(node.x,node.y); return {x:x-3,y:y-2,width:6,height:4} })()"
        rx="1"
        :fill="node.type==='internal' ? C.nodeIntStroke : C.nodeExtStroke"
        opacity="0.9"
      />
      <!-- Viewport rect -->
      <rect
        :x="mmViewport.x" :y="mmViewport.y"
        :width="Math.max(4,mmViewport.w)" :height="Math.max(4,mmViewport.h)"
        fill="none" :stroke="C.nodeIntStroke" stroke-width="1" opacity="0.6"
      />
    </svg>
  </div>

  <!-- Bottom-left: legend + stats -->
  <div class="graph-legend" :style="{ background: C.ui, borderColor: C.uiBorder, color: C.uiText }">
    <div class="legend-row">
      <svg width="20" height="12"><rect x="0" y="0" width="20" height="12" rx="2" :fill="C.nodeIntFill" :stroke="C.nodeIntStroke" stroke-width="1.5"/></svg>
      <span>internal page</span>
    </div>
    <div class="legend-row">
      <svg width="20" height="12"><rect x="0" y="0" width="20" height="12" rx="2" :fill="C.nodeExtFill" :stroke="C.nodeExtStroke" stroke-width="1" stroke-dasharray="4 2"/></svg>
      <span>external link</span>
    </div>
    <div class="legend-stats" :style="{ color: C.uiTextDim }">
      {{ stats.pages }} pages · {{ stats.external }} external · {{ stats.edges }} edges
    </div>
  </div>

  <!-- Bottom-right controls -->
  <div class="graph-controls">
    <span class="graph-zoom-pct" :style="{ color: C.uiTextDim }">{{ zoomPct }}</span>
    <button class="graph-fit-btn"
      :style="{ background: C.ui, borderColor: C.uiBorder, color: C.uiText }"
      @click="fitView" title="Fit to screen">⊡</button>
  </div>

  <!-- Hint -->
  <div class="graph-hint" :style="{ color: C.uiTextDim }">
    drag · scroll · dbl-click to isolate · / to search
  </div>

  <!-- Tooltip -->
  <Transition name="tt">
    <div v-if="hoveredNode" class="graph-tooltip"
      :style="{ left: mousePos.x+18+'px', top: mousePos.y-36+'px', background: C.ui, borderColor: C.uiBorder, color: C.uiText }"
    >{{ hoveredNode.url }}</div>
  </Transition>

  <!-- Isolate indicator -->
  <Transition name="tt">
    <div v-if="isolated" class="graph-isolated-badge"
      :style="{ background: C.ui, borderColor: C.nodeIntStroke, color: C.nodeIntStroke }"
    >isolated: {{ nodes.find(n=>n.id===isolated)?.label }} <button @click="isolated=null" :style="{ color: C.uiTextDim }">✕</button></div>
  </Transition>
</template>

<style scoped>
.graph-svg {
  display: block; position: fixed; top: 56px; left: 0; right: 0; bottom: 0;
  width: 100vw; height: calc(100vh - 56px); z-index: 1;
  user-select: none; cursor: grab;
}
.graph-svg:active { cursor: grabbing; }

@keyframes flow { to { stroke-dashoffset: -34; } }
.edge-flow { animation: flow 0.5s linear infinite; }

/* Search */
.graph-search-wrap {
  position: fixed; top: 72px; left: 50%; transform: translateX(-50%);
  z-index: 2;
}
.graph-search {
  font-family: 'DM Mono', monospace; font-size: 0.7rem;
  padding: 0.3rem 0.7rem; border: 1px solid; border-radius: 6px;
  outline: none; width: 200px; transition: border-color 150ms ease, width 150ms ease;
}
.graph-search:focus { width: 260px; }
.graph-search::placeholder { opacity: 0.4; }

/* Mini-map */
.graph-minimap {
  position: fixed; top: 72px; right: 1.2rem; z-index: 2;
  border: 1px solid; border-radius: 6px; overflow: hidden;
  cursor: crosshair; opacity: 0.85;
  transition: opacity 150ms ease;
}
.graph-minimap:hover { opacity: 1; }

/* Legend */
.graph-legend {
  position: fixed; bottom: 1.5rem; left: 1.2rem; z-index: 2;
  border: 1px solid; border-radius: 6px; padding: 0.5rem 0.7rem;
  font-family: 'DM Mono', monospace; font-size: 0.65rem;
  display: flex; flex-direction: column; gap: 0.3rem;
}
.legend-row { display: flex; align-items: center; gap: 0.5rem; }
.legend-stats { opacity: 0.7; margin-top: 0.1rem; letter-spacing: 0.02rem; }

/* Controls */
.graph-controls {
  position: fixed; bottom: 4rem; right: 1.2rem; z-index: 2;
  display: flex; align-items: center; gap: 0.5rem;
}
.graph-zoom-pct {
  font-family: 'DM Mono', monospace; font-size: 0.65rem;
  letter-spacing: 0.05rem; min-width: 3rem; text-align: right;
}
.graph-fit-btn {
  border: 1px solid; border-radius: 6px;
  width: 2rem; height: 2rem; font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0.7; transition: opacity 150ms ease;
  font-family: monospace;
}
.graph-fit-btn:hover { opacity: 1; }

/* Hint */
.graph-hint {
  position: fixed; bottom: 7rem; right: 1.2rem; z-index: 2;
  font-size: 0.6rem; opacity: 0.3; pointer-events: none;
  font-family: 'DM Mono', monospace; letter-spacing: 0.03rem;
}

/* Tooltip */
.graph-tooltip {
  position: fixed; z-index: 3; pointer-events: none;
  font-family: 'DM Mono', monospace; font-size: 0.65rem;
  padding: 0.2rem 0.55rem; border: 1px solid; border-radius: 4px;
  white-space: nowrap; letter-spacing: 0.03rem;
}

/* Isolate badge */
.graph-isolated-badge {
  position: fixed; top: 72px; left: 50%; transform: translateX(-50%);
  z-index: 3; font-family: 'DM Mono', monospace; font-size: 0.65rem;
  padding: 0.2rem 0.6rem; border: 1px solid; border-radius: 4px;
  display: flex; align-items: center; gap: 0.5rem; letter-spacing: 0.05rem;
}
.graph-isolated-badge button {
  background: none; border: none; cursor: pointer; font-size: 0.7rem; padding: 0;
}

.tt-enter-active, .tt-leave-active { transition: opacity 100ms ease; }
.tt-enter-from, .tt-leave-to { opacity: 0; }
</style>
