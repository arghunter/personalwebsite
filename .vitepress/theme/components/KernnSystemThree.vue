<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

const BG     = '#100d20'
const CARD   = '#1c1830'
const BORDER = '#2d2847'
const ACCENT = '#a78bfa'
const CYAN   = '#38bdf8'
const GOLD   = '#fbbf24'
const TEAL   = '#34d399'
const FG     = '#dbd6f0'
const MUTED  = '#4a4270'
const ORANGE = '#fb923c'

const BH     = 0.18
const MINI_N = 3
const PE_S   = 0.58
const PE_G   = 0.80

// Phase durations: LOAD, FEED, DRAIN, ACTIVATE, LAYER_DONE
const PHASE_DURS = [2.0, 2.8, 1.6, 1.8, 0.6]
const NUM_LAYERS = 3
const LAYER_DUR  = PHASE_DURS.reduce((a, b) => a + b, 0)
const DONE_DUR   = 2.2
const PERIOD     = LAYER_DUR * NUM_LAYERS + DONE_DUR

interface BDef {
  x: number; z: number; w: number; d: number
  label: string; sub: string; lc: string; bg: string
}
const DEFS: BDef[] = [
  { x: -7.5, z:  0,   w: 1.9, d: 1.5, label: 'Host',           sub: 'UART / DMA',      lc: CYAN,   bg: '#1a1428' },
  { x: -3.8, z: -2.4, w: 2.1, d: 1.2, label: 'Weight Mem',     sub: '16 K × 8-bit',    lc: ACCENT, bg: '#14122a' },
  { x: -3.8, z:  0,   w: 2.1, d: 1.2, label: 'Act Mem',        sub: 'double-buffered',  lc: TEAL,   bg: '#0e1c12' },
  { x: -3.8, z:  2.4, w: 2.1, d: 1.2, label: 'Bias Mem',       sub: '256 × 32-bit',    lc: GOLD,   bg: '#1c180a' },
  { x:  0.2, z:  0,   w: 3.2, d: 3.2, label: 'Systolic Array', sub: `${MINI_N}×${MINI_N} PE grid`, lc: FG, bg: '#120f22' },
  { x:  4.4, z: -1.2, w: 2.1, d: 1.2, label: 'Output Mem',     sub: '4 K × 32-bit',    lc: ORANGE, bg: '#1c120a' },
  { x:  4.4, z:  1.2, w: 2.1, d: 1.2, label: 'Act Func Bank',  sub: 'ReLU / shift',     lc: ACCENT, bg: '#14122a' },
]
const I = { host: 0, wt: 1, act: 2, bias: 3, sys: 4, out: 5, func: 6 }

onMounted(async () => {
  if (!canvas.value) return
  const el = canvas.value
  const W = el.clientWidth, H = el.clientHeight

  const THREE = await import('three')

  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(new THREE.Color(BG))

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200)
  camera.position.set(0, 14, 10)
  camera.lookAt(new THREE.Vector3(0, 0, -0.5))

  scene.add(new THREE.AmbientLight(0xffffff, 0.85))
  const sun = new THREE.DirectionalLight(0xffffff, 0.5)
  sun.position.set(5, 10, 5)
  scene.add(sun)

  // ── Floor grid ────────────────────────────────────────────────────────
  const grid = new THREE.GridHelper(22, 22, new THREE.Color(BORDER), new THREE.Color(BORDER))
  grid.position.y = -BH / 2 - 0.01
  const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material]
  for (const m of gridMats) {
    ;(m as THREE.LineBasicMaterial).transparent = true
    ;(m as THREE.LineBasicMaterial).opacity = 0.14
  }
  scene.add(grid)

  // ── Block top canvas texture ──────────────────────────────────────────
  function drawBlockTop(
    ctx: CanvasRenderingContext2D, tw: number, th: number,
    def: BDef, isActive: boolean, stateText: string,
  ) {
    ctx.clearRect(0, 0, tw, th)
    ctx.fillStyle = isActive ? 'rgba(36,28,68,0.97)' : 'rgba(22,18,40,0.92)'
    // @ts-ignore
    ctx.roundRect(5, 5, tw - 10, th - 10, 10)
    ctx.fill()
    ctx.strokeStyle = isActive ? def.lc : BORDER
    ctx.lineWidth   = isActive ? 4 : 2
    // @ts-ignore
    ctx.roundRect(5, 5, tw - 10, th - 10, 10)
    ctx.stroke()
    // label
    ctx.fillStyle    = def.lc
    ctx.font         = `bold ${Math.round(th * 0.24)}px monospace`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(def.label, tw / 2, th * 0.08)
    // sublabel
    ctx.fillStyle = MUTED
    ctx.font      = `${Math.round(th * 0.155)}px monospace`
    ctx.fillText(def.sub, tw / 2, th * 0.42)
    // state
    if (stateText) {
      ctx.fillStyle    = '#ffffff'
      ctx.font         = `bold ${Math.round(th * 0.185)}px monospace`
      ctx.textBaseline = 'bottom'
      ctx.fillText(stateText, tw / 2, th * 0.93)
    }
  }

  interface BObj {
    hlLines: THREE.LineSegments
    topCvs: HTMLCanvasElement
    topTex: THREE.CanvasTexture
    def: BDef
    wasActive: boolean
    lastState: string
  }
  const bObjs: BObj[] = []

  for (const def of DEFS) {
    const geo  = new THREE.BoxGeometry(def.w, BH, def.d)
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(def.bg) }))
    mesh.position.set(def.x, 0, def.z)
    scene.add(mesh)

    // dark bottom edge
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: new THREE.Color(BORDER) }),
    )
    edges.position.copy(mesh.position)
    scene.add(edges)

    // glow ring shown when active
    const hlLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(def.w + 0.12, BH + 0.16, def.d + 0.12)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(def.lc), transparent: true, opacity: 0.85 }),
    )
    hlLines.position.set(def.x, 0, def.z)
    hlLines.visible = false
    scene.add(hlLines)

    // top-face canvas texture
    const TW  = 256
    const TH  = Math.max(64, Math.round(256 * def.d / def.w))
    const cvs = document.createElement('canvas')
    cvs.width = TW; cvs.height = TH
    const tex = new THREE.CanvasTexture(cvs)
    drawBlockTop(cvs.getContext('2d')!, TW, TH, def, false, '')
    tex.needsUpdate = true

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(def.w - 0.06, def.d - 0.06),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(def.x, BH / 2 + 0.002, def.z)
    scene.add(plane)

    bObjs.push({ hlLines, topCvs: cvs, topTex: tex, def, wasActive: false, lastState: '' })
  }

  function activate(idx: number, stateText: string) {
    const bo = bObjs[idx]
    bo.hlLines.visible = true
    if (!bo.wasActive || bo.lastState !== stateText) {
      bo.wasActive = true; bo.lastState = stateText
      const TW = bo.topCvs.width, TH = bo.topCvs.height
      drawBlockTop(bo.topCvs.getContext('2d')!, TW, TH, bo.def, true, stateText)
      bo.topTex.needsUpdate = true
    }
  }

  function deactivate(idx: number) {
    const bo = bObjs[idx]
    bo.hlLines.visible = false
    if (bo.wasActive) {
      bo.wasActive = false; bo.lastState = ''
      const TW = bo.topCvs.width, TH = bo.topCvs.height
      drawBlockTop(bo.topCvs.getContext('2d')!, TW, TH, bo.def, false, '')
      bo.topTex.needsUpdate = true
    }
  }

  function deactivateAll() {
    for (let i = 0; i < bObjs.length; i++) deactivate(i)
  }

  // ── Mini PE grid ──────────────────────────────────────────────────────
  const miniMats: THREE.MeshLambertMaterial[][] = []
  for (let r = 0; r < MINI_N; r++) {
    miniMats.push([])
    for (let c = 0; c < MINI_N; c++) {
      const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(CARD) })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(PE_S, BH + 0.08, PE_S), mat)
      mesh.position.set(0.2 + (c - 1) * PE_G, 0.01, (r - 1) * PE_G)
      scene.add(mesh)
      miniMats[r].push(mat)
    }
  }

  // ── Static connection lines ───────────────────────────────────────────
  const LY = BH / 2 + 0.04
  const V  = (x: number, z: number) => new THREE.Vector3(x, LY, z)

  function addLine(pts: THREE.Vector3[], color: string, opacity = 0.20) {
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity }),
    ))
  }

  addLine([V(-7.5,  0), V(-4.9, -2.4)], ACCENT)
  addLine([V(-7.5,  0), V(-4.9,  0  )], TEAL)
  addLine([V(-7.5,  0), V(-4.9,  2.4)], GOLD)
  addLine([V(-2.8, -2.4), V(-1.4, -0.9)], ACCENT)
  addLine([V(-2.8,  0  ), V(-1.4,  0  )], TEAL)
  addLine([V(-2.8,  2.4), V(-1.4,  0.9)], GOLD)
  addLine([V( 1.8, -0.6), V( 3.4, -1.2)], ORANGE)
  addLine([V( 4.4, -0.6), V( 5.6, -1.2), V( 5.6, 1.2), V( 4.4, 0.6)], ACCENT, 0.25)
  addLine([V( 4.4,  1.8), V( 0.2,  5.0), V(-3.8, 0.6)], TEAL, 0.22)

  // ── Arrowhead cones ───────────────────────────────────────────────────
  const coneGeo = new THREE.ConeGeometry(0.09, 0.22, 8)

  function addArrow(to: THREE.Vector3, dir: THREE.Vector3, color: string) {
    const mat  = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.60 })
    const mesh = new THREE.Mesh(coneGeo, mat)
    mesh.position.copy(to)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    scene.add(mesh)
  }

  const LA = LY
  addArrow(V(-4.9, -2.4), new THREE.Vector3(-4.9 - -7.5, 0, -2.4 - 0).normalize(),   ACCENT)
  addArrow(V(-4.9,  0  ), new THREE.Vector3(-4.9 - -7.5, 0,  0   - 0).normalize(),   TEAL)
  addArrow(V(-4.9,  2.4), new THREE.Vector3(-4.9 - -7.5, 0,  2.4 - 0).normalize(),   GOLD)
  addArrow(V(-1.4, -0.9), new THREE.Vector3(-1.4 - -2.8, 0, -0.9 - -2.4).normalize(), ACCENT)
  addArrow(V(-1.4,  0  ), new THREE.Vector3(-1.4 - -2.8, 0,  0   -  0  ).normalize(), TEAL)
  addArrow(V(-1.4,  0.9), new THREE.Vector3(-1.4 - -2.8, 0,  0.9 -  2.4).normalize(), GOLD)
  addArrow(V( 3.4, -1.2), new THREE.Vector3( 3.4 -  1.8, 0, -1.2 - -0.6).normalize(), ORANGE)
  addArrow(new THREE.Vector3(-3.8, LA, 0.6), new THREE.Vector3(-3.8 - 0.2, 0, 0.6 - 5.0).normalize(), TEAL)

  // ── Particles with additive blending + trail ──────────────────────────
  const PY = LY + 0.18

  type PKey = 'h2w' | 'h2a' | 'h2b' | 'w2s' | 'a2s' | 'b2s' | 's2o' | 'o2f' | 'f2a'

  const PPATHS: Record<PKey, THREE.Vector3[]> = {
    h2w: [new THREE.Vector3(-7.5, PY,  0  ), new THREE.Vector3(-4.9, PY, -2.4)],
    h2a: [new THREE.Vector3(-7.5, PY,  0  ), new THREE.Vector3(-4.9, PY,  0  )],
    h2b: [new THREE.Vector3(-7.5, PY,  0  ), new THREE.Vector3(-4.9, PY,  2.4)],
    w2s: [new THREE.Vector3(-2.8, PY, -2.4), new THREE.Vector3(-1.4, PY, -0.9)],
    a2s: [new THREE.Vector3(-2.8, PY,  0  ), new THREE.Vector3(-1.4, PY,  0  )],
    b2s: [new THREE.Vector3(-2.8, PY,  2.4), new THREE.Vector3(-1.4, PY,  0.9)],
    s2o: [new THREE.Vector3( 1.8, PY, -0.6), new THREE.Vector3( 3.4, PY, -1.2)],
    o2f: [new THREE.Vector3( 5.6, PY, -1.2), new THREE.Vector3( 5.6, PY,  1.2)],
    f2a: [new THREE.Vector3( 4.4, PY,  1.8), new THREE.Vector3( 0.2, PY,  5.0), new THREE.Vector3(-3.8, PY, 0.6)],
  }

  const PCOLS: Record<PKey, string> = {
    h2w: ACCENT, h2a: TEAL, h2b: GOLD,
    w2s: ACCENT, a2s: TEAL, b2s: GOLD,
    s2o: ORANGE, o2f: ORANGE, f2a: TEAL,
  }

  function lerpPath(pts: THREE.Vector3[], t: number): THREE.Vector3 {
    const segs = pts.length - 1
    const raw  = Math.max(0, Math.min(1, t)) * segs
    const seg  = Math.min(Math.floor(raw), segs - 1)
    return new THREE.Vector3().lerpVectors(pts[seg], pts[seg + 1], raw - seg)
  }

  const NPART = 8
  interface Particle { head: THREE.Mesh; tail: THREE.Mesh }
  const partMeshes: Record<PKey, Particle[]> = {} as any

  for (const key of Object.keys(PPATHS) as PKey[]) {
    const col = PCOLS[key]
    partMeshes[key] = Array.from({ length: NPART }, () => {
      const mk = (r: number, op: number) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 7),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(col),
            transparent: true, opacity: op,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        m.visible = false
        scene.add(m)
        return m
      }
      return { head: mk(0.125, 0.90), tail: mk(0.085, 0.30) }
    })
  }

  function flow(key: PKey, progress: number) {
    const path  = PPATHS[key]
    const parts = partMeshes[key]
    for (let i = 0; i < NPART; i++) {
      const t = (progress + i / NPART) % 1
      parts[i].head.visible = true
      parts[i].tail.visible = true
      parts[i].head.position.copy(lerpPath(path, t))
      parts[i].tail.position.copy(lerpPath(path, Math.max(0, t - 0.045)))
    }
  }

  function hideAll() {
    for (const g of Object.values(partMeshes)) for (const p of g) {
      p.head.visible = false; p.tail.visible = false
    }
  }

  function clearMiniPEs() {
    for (let r = 0; r < MINI_N; r++) for (let c = 0; c < MINI_N; c++) {
      miniMats[r][c].color.set(CARD)
      miniMats[r][c].emissive.set('#000000')
      miniMats[r][c].emissiveIntensity = 0
    }
  }

  // ── Status panel ──────────────────────────────────────────────────────
  {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 0.85),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#0e0b1e'), transparent: true, opacity: 0.82, depthTest: false }),
    )
    bg.rotation.x = -Math.PI / 2
    bg.position.set(-1.5, BH / 2 + 0.005, -5.5)
    scene.add(bg)
  }

  function makeDynLabel(tw: number, th: number) {
    const cvs = document.createElement('canvas'); cvs.width = tw; cvs.height = th
    const tex = new THREE.CanvasTexture(cvs)
    const sp  = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    const set = (text: string, color = FG) => {
      const ctx = cvs.getContext('2d')!
      ctx.clearRect(0, 0, tw, th)
      ctx.fillStyle = color
      ctx.font = `bold ${Math.round(th * 0.58)}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, tw / 2, th / 2)
      tex.needsUpdate = true
    }
    return { sp, set }
  }

  const statusLbl = makeDynLabel(720, 76)
  statusLbl.sp.scale.set(6.0, 0.64, 1)
  statusLbl.sp.position.set(-1.5, BH / 2 + 0.05, -5.5)
  scene.add(statusLbl.sp)

  const layerLbl = makeDynLabel(360, 62)
  layerLbl.sp.scale.set(2.9, 0.50, 1)
  layerLbl.sp.position.set(0.2, BH / 2 + 0.05, 2.6)
  scene.add(layerLbl.sp)

  // ── Phase progress bar ────────────────────────────────────────────────
  const progCvs = document.createElement('canvas'); progCvs.width = 256; progCvs.height = 28
  const progTex = new THREE.CanvasTexture(progCvs)
  const progSp  = new THREE.Sprite(new THREE.SpriteMaterial({ map: progTex, transparent: true, depthTest: false }))
  progSp.scale.set(2.8, 0.30, 1)
  progSp.position.set(0.2, BH / 2 + 0.08, 1.95)
  scene.add(progSp)

  function setProgressBar(prog: number, color: string, label: string) {
    const ctx = progCvs.getContext('2d')!; const tw = 256, th = 28
    ctx.clearRect(0, 0, tw, th)
    ctx.fillStyle = '#1c1830'
    ctx.fillRect(2, 14, tw - 4, 10)
    ctx.fillStyle = color
    ctx.fillRect(2, 14, Math.round((tw - 4) * Math.min(1, prog)), 10)
    ctx.fillStyle = color
    ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(label, 2, 1)
    progTex.needsUpdate = true
  }

  // ── Animation loop ────────────────────────────────────────────────────
  const clock = new THREE.Clock()
  let t = 0, animId = 0

  function animate() {
    animId = requestAnimationFrame(animate)
    t = (t + Math.min(clock.getDelta(), 0.05)) % PERIOD

    hideAll(); deactivateAll(); clearMiniPEs()

    if (t >= LAYER_DUR * NUM_LAYERS) {
      const p = Math.sin((t - LAYER_DUR * NUM_LAYERS) * 3.0) * 0.5 + 0.5
      statusLbl.set('Inference Complete  ✓', TEAL)
      layerLbl.set(`${NUM_LAYERS} layers  ✓`, TEAL)
      activate(I.out,  'done ✓')
      activate(I.func, 'done ✓')
      setProgressBar(1.0, TEAL, 'complete')
      renderer.render(scene, camera); return
    }

    const layerIdx = Math.floor(t / LAYER_DUR)
    let   rem      = t % LAYER_DUR
    let   phaseIdx = 0
    for (let i = 0; i < PHASE_DURS.length; i++) {
      if (rem < PHASE_DURS[i]) { phaseIdx = i; break }
      rem -= PHASE_DURS[i]
    }
    const prog = rem / PHASE_DURS[phaseIdx]

    layerLbl.set(`Layer ${layerIdx + 1} / ${NUM_LAYERS}`, MUTED)

    if (phaseIdx === 0) {
      // ── LOAD ──────────────────────────────────────────────────────────
      statusLbl.set(`Layer ${layerIdx + 1}: Loading weights & activations`, ACCENT)
      activate(I.host, 'sending')
      activate(I.wt,   'loading')
      activate(I.act,  'loading')
      flow('h2w', prog); flow('h2a', prog)
      if (layerIdx === 0) { activate(I.bias, 'loading'); flow('h2b', prog) }
      setProgressBar(prog, ACCENT, 'load')

    } else if (phaseIdx === 1) {
      // ── FEED / COMPUTE ────────────────────────────────────────────────
      statusLbl.set(`Layer ${layerIdx + 1}: Tiled matmul — wavefront across PEs`, FG)
      activate(I.sys,  'computing')
      activate(I.wt,   'reading')
      activate(I.act,  'reading')
      activate(I.bias, 'reading')
      flow('w2s', prog); flow('a2s', prog); flow('b2s', prog)

      const totalDiags = 2 * MINI_N - 1
      const curDiag    = Math.floor(prog * (totalDiags + 2))
      for (let r = 0; r < MINI_N; r++) for (let c = 0; c < MINI_N; c++) {
        const d = r + c
        if (d === curDiag) {
          miniMats[r][c].color.set(ACCENT)
          miniMats[r][c].emissive.set(ACCENT)
          miniMats[r][c].emissiveIntensity = 0.7
        } else if (d < curDiag) {
          miniMats[r][c].color.set('#2a1a50')
        }
      }
      const tile = Math.min(NUM_LAYERS, Math.ceil(prog * (NUM_LAYERS + 1)))
      setProgressBar(prog, ACCENT, `tile ${tile}/${NUM_LAYERS}`)

    } else if (phaseIdx === 2) {
      // ── DRAIN ─────────────────────────────────────────────────────────
      statusLbl.set(`Layer ${layerIdx + 1}: Draining results to output memory`, ORANGE)
      activate(I.sys, 'draining')
      activate(I.out, 'writing')
      flow('s2o', prog)
      setProgressBar(prog, ORANGE, 'drain')

    } else if (phaseIdx === 3) {
      // ── ACTIVATE ──────────────────────────────────────────────────────
      const isLast = layerIdx === NUM_LAYERS - 1
      statusLbl.set(
        isLast ? `Layer ${layerIdx + 1}: Final activation function`
               : `Layer ${layerIdx + 1}: Activation + buffer swap`,
        TEAL,
      )
      activate(I.out,  'activating')
      activate(I.func, 'running')
      flow('o2f', prog)
      if (!isLast && prog > 0.42) {
        activate(I.act, 'swapping buf')
        flow('f2a', (prog - 0.42) / 0.58)
      }
      setProgressBar(prog, TEAL, isLast ? 'final act' : 'activate + swap')

    } else {
      // ── LAYER DONE ────────────────────────────────────────────────────
      const pulse = Math.sin(prog * Math.PI) * 0.5
      statusLbl.set(`Layer ${layerIdx + 1} complete`, GOLD)
      activate(I.sys, `layer ${layerIdx + 1} done`)
      setProgressBar(1.0, GOLD, `layer ${layerIdx + 1} done`)
      // Flash all mini PEs gold
      for (let r = 0; r < MINI_N; r++) for (let c = 0; c < MINI_N; c++) {
        miniMats[r][c].color.set('#2a1a50')
        miniMats[r][c].emissive.set(GOLD)
        miniMats[r][c].emissiveIntensity = pulse
      }
    }

    renderer.render(scene, camera)
  }

  animate()

  const onResize = () => {
    const w = el.clientWidth, h = el.clientHeight
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)
  cleanup = () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer.dispose() }
})

onUnmounted(() => cleanup?.())
</script>

<template>
  <figure class="ks-three">
    <canvas ref="canvas" />
    <figcaption>
      Full KERNN pipeline: the host loads weights, biases, and input activations over UART into
      on-chip SRAM. The LayerSequencer tiles the multiply-accumulate work across the Systolic
      Array wave by wave. Results drain into Output Memory, pass through the Activation Function
      Bank (ReLU / Leaky-ReLU / ReLU6 + int8 clamp), then feed back as the next layer's
      activations — repeating for each layer until inference is complete.
    </figcaption>
  </figure>
</template>

<style scoped>
.ks-three {
  margin: 2rem auto;
  text-align: center;
}
.ks-three canvas {
  width: 100%;
  height: 520px;
  display: block;
  border-radius: 4px;
}
.ks-three figcaption {
  margin-top: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.6;
  opacity: 0.65;
  color: var(--vp-c-text-2);
}
</style>
