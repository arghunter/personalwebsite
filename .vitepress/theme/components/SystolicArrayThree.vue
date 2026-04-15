<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let cleanup: (() => void) | null = null

const GRID   = 3
const PE_W   = 0.86
const PE_H   = 0.14
const STEP   = 1.40
const OFFSET = (GRID - 1) * STEP / 2

const EX = -OFFSET - STEP * 1.25
const XX =  OFFSET + STEP * 1.25
const EZ = -OFFSET - STEP * 1.25
const XZ =  OFFSET + STEP * 1.25
const DY = PE_H / 2 + 0.09

const TICK     = 0.82
const INTER    = 0.65
const WAVE_DUR = (2 * GRID - 1) * TICK + INTER
const PAUSE    = 1.8
const PERIOD   = GRID * WAVE_DUR + PAUSE

const BG     = '#100d20'
const CARD   = '#1c1830'
const BORDER = '#2d2847'
const ACCENT = '#a78bfa'
const CYAN   = '#38bdf8'
const GOLD   = '#fbbf24'
const TEAL   = '#34d399'
const FG     = '#dbd6f0'
const MUTED  = '#4a4270'

onMounted(async () => {
  if (!canvas.value) return
  const el = canvas.value
  const W  = el.clientWidth
  const H  = el.clientHeight

  const THREE = await import('three')

  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(new THREE.Color(BG))

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100)
  camera.position.set(0, 9.2, 8.2)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.95))
  const sun = new THREE.DirectionalLight(0xffffff, 0.45)
  sun.position.set(4, 8, 3)
  scene.add(sun)

  // ── Sprite helper (camera-facing, always readable) ────────────────────────
  function makeSpriteTex(
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    w: number, h: number,
  ): THREE.CanvasTexture {
    const cvs = document.createElement('canvas')
    cvs.width = w; cvs.height = h
    draw(cvs.getContext('2d')!, w, h)
    return new THREE.CanvasTexture(cvs)
  }

  function makeStaticSprite(
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    sw: number, sh: number, tw = 256, th = 128,
  ): THREE.Sprite {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSpriteTex(draw, tw, th),
      transparent: true, depthTest: false,
    }))
    sp.scale.set(sw, sh, 1)
    return sp
  }

  // ── PE boxes — plain color, EdgesGeometry for border ─────────────────────
  const peGeo   = new THREE.BoxGeometry(PE_W, PE_H, PE_W)
  const edgesGeo = new THREE.EdgesGeometry(peGeo)
  const botMat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x0a0818) })

  const peMeshes:   THREE.Mesh[][]       = []
  const peEdges:    THREE.LineSegments[][] = []
  const peAccum:    number[][]           = []
  const peFlash:    boolean[][]          = []

  for (let r = 0; r < GRID; r++) {
    peMeshes.push([]); peEdges.push([])
    peAccum.push([]); peFlash.push([])
    for (let c = 0; c < GRID; c++) {
      peAccum[r].push(0); peFlash[r].push(false)

      const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(CARD) })
      const mesh = new THREE.Mesh(peGeo, [
        mat, mat, mat, botMat, mat, mat,
      ])
      mesh.position.set(c * STEP - OFFSET, 0, r * STEP - OFFSET)
      scene.add(mesh)

      const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(BORDER) })
      const edges   = new THREE.LineSegments(edgesGeo, edgeMat)
      edges.position.copy(mesh.position)
      scene.add(edges)

      peMeshes[r].push(mesh); peEdges[r].push(edges)
    }
  }

  function updatePEVisual(r: number, c: number) {
    const flash = peFlash[r][c]
    const mat = (peMeshes[r][c].material as THREE.MeshLambertMaterial[])[0]
    mat.color.set(flash ? '#1e1535' : CARD)
    mat.emissive.set(flash ? '#1a0e00' : '#000000')
    ;(peEdges[r][c].material as THREE.LineBasicMaterial).color.set(flash ? GOLD : BORDER)
  }

  // ── PE info sprites (camera-facing, above each PE) ────────────────────────
  const peSpriteCvs: HTMLCanvasElement[][] = []
  const peSpriteTex: THREE.CanvasTexture[][] = []
  const peSpriteObj: THREE.Sprite[][] = []

  const SPR_W = 256, SPR_H = 256
  const SP_SCALE = 1.05   // world-space width

  function drawPESprite(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    r: number, c: number, accum: number, flash: boolean,
  ) {
    ctx.clearRect(0, 0, w, h)

    // card bg
    ctx.fillStyle = flash ? 'rgba(30,18,56,0.96)' : 'rgba(22,18,40,0.94)'
    ctx.beginPath()
    // @ts-ignore
    ctx.roundRect(6, 6, w - 12, h - 12, 14)
    ctx.fill()

    // border
    ctx.strokeStyle = flash ? GOLD : BORDER
    ctx.lineWidth   = flash ? 5 : 2.5
    ctx.beginPath()
    // @ts-ignore
    ctx.roundRect(6, 6, w - 12, h - 12, 14)
    ctx.stroke()

    // PE[r,c] index — top-left
    ctx.fillStyle = MUTED
    ctx.font = '26px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`PE[${r},${c}]`, 18, 14)

    // C[r,c] output label — top-right
    const done = accum >= GRID
    ctx.fillStyle = done ? TEAL : MUTED
    ctx.font = '24px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`C[${r},${c}]`, w - 16, 14)

    // Accumulator digit — large centre
    const numColor = flash ? GOLD : (done ? TEAL : (accum > 0 ? ACCENT : MUTED))
    ctx.fillStyle = numColor
    ctx.font = `bold 96px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(accum), w / 2, Math.round(h * 0.72))

    // "MAC ops" micro-label
    ctx.fillStyle = MUTED
    ctx.font = '20px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('MAC ops', w / 2, Math.round(h * 0.78))

    // Progress dots
    const dotR   = 11
    const dotY   = h - 24
    const spacing = 32
    for (let i = 0; i < GRID; i++) {
      const filled = i < accum
      ctx.fillStyle = filled ? (done ? TEAL : (flash ? GOLD : ACCENT)) : BORDER
      ctx.beginPath()
      ctx.arc(w / 2 + (i - 1) * spacing, dotY, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  for (let r = 0; r < GRID; r++) {
    peSpriteCvs.push([]); peSpriteTex.push([]); peSpriteObj.push([])
    for (let c = 0; c < GRID; c++) {
      const cvs = document.createElement('canvas'); cvs.width = cvs.height = SPR_W
      drawPESprite(cvs.getContext('2d')!, SPR_W, SPR_H, r, c, 0, false)
      const tex = new THREE.CanvasTexture(cvs)
      const sp  = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false,
      }))
      sp.scale.set(SP_SCALE, SP_SCALE, 1)
      sp.position.set(c * STEP - OFFSET, PE_H / 2 + SP_SCALE * 0.52, r * STEP - OFFSET)
      scene.add(sp)
      peSpriteCvs[r].push(cvs); peSpriteTex[r].push(tex); peSpriteObj[r].push(sp)
    }
  }

  function updatePESprite(r: number, c: number) {
    drawPESprite(peSpriteCvs[r][c].getContext('2d')!, SPR_W, SPR_H, r, c, peAccum[r][c], peFlash[r][c])
    peSpriteTex[r][c].needsUpdate = true
  }

  // ── Trace lines ───────────────────────────────────────────────────────────
  for (let r = 0; r < GRID; r++) {
    const z = r * STEP - OFFSET
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(EX, DY, z), new THREE.Vector3(XX, DY, z),
      ]),
      new THREE.LineBasicMaterial({ color: new THREE.Color(ACCENT), transparent: true, opacity: 0.18 }),
    ))
  }
  for (let c = 0; c < GRID; c++) {
    const x = c * STEP - OFFSET
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, DY, EZ), new THREE.Vector3(x, DY, XZ),
      ]),
      new THREE.LineBasicMaterial({ color: new THREE.Color(CYAN), transparent: true, opacity: 0.18 }),
    ))
  }

  // ── Data dots ─────────────────────────────────────────────────────────────
  // head + halo per dot for additive glow
  function makeDot(col: string): { head: THREE.Mesh; halo: THREE.Mesh } {
    const mk = (r: number, op: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 14, 10),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(col), transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      )
      m.visible = false; scene.add(m); return m
    }
    return { head: mk(0.135, 0.95), halo: mk(0.22, 0.22) }
  }

  const aDots = Array.from({ length: GRID }, () => makeDot(ACCENT))
  const bDots = Array.from({ length: GRID }, () => makeDot(CYAN))

  // pulse ring sprite for PE fire events
  const RING_DUR  = 0.28
  interface PulseRing { sp: THREE.Sprite; born: number; r: number; c: number }
  const pulseRings: PulseRing[] = []
  const ringPool: THREE.Sprite[] = []

  function makePulseSprite(): THREE.Sprite {
    const cvs = document.createElement('canvas'); cvs.width = 64; cvs.height = 64
    const tex = new THREE.CanvasTexture(cvs)
    const sp  = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false,
      blending: THREE.AdditiveBlending,
    }))
    sp.visible = false; scene.add(sp)
    return sp
  }

  function drawRing(sp: THREE.Sprite, progress: number, color: string) {
    const mat = sp.material as THREE.SpriteMaterial
    const cvs = (mat.map as THREE.CanvasTexture).image as HTMLCanvasElement
    const ctx = cvs.getContext('2d')!; const s = 64
    ctx.clearRect(0, 0, s, s)
    const alpha = Math.max(0, 1 - progress)
    ctx.strokeStyle = color
    ctx.lineWidth   = 3
    ctx.globalAlpha = alpha * 0.85
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, 8 + progress * 22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ;(mat.map as THREE.CanvasTexture).needsUpdate = true
  }

  for (let i = 0; i < GRID * GRID * 3; i++) ringPool.push(makePulseSprite())

  function spawnPulse(r: number, c: number, time: number) {
    const sp = ringPool.find(s => !s.visible)
    if (!sp) return
    sp.scale.set(0.9, 0.9, 1)
    sp.position.set(c * STEP - OFFSET, DY + 0.05, r * STEP - OFFSET)
    sp.visible = true
    pulseRings.push({ sp, born: time, r, c })
  }

  // ── Entry labels ──────────────────────────────────────────────────────────
  for (let r = 0; r < GRID; r++) {
    const sp = makeStaticSprite((ctx, w, h) => {
      ctx.font = `bold ${Math.round(h * 0.52)}px monospace`
      ctx.fillStyle = ACCENT
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`A[${r}] →`, w - 6, h / 2)
    }, 1.35, 0.42)
    sp.position.set(EX - 0.65, 0.28, r * STEP - OFFSET)
    scene.add(sp)
  }
  for (let c = 0; c < GRID; c++) {
    const sp = makeStaticSprite((ctx, w, h) => {
      ctx.font = `bold ${Math.round(h * 0.75)}px monospace`
      ctx.fillStyle = CYAN
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`B[${c}]↓`, w / 2, h / 2)
    }, 0.7, 0.42)
    sp.position.set(c * STEP - OFFSET, 0.28, EZ - 0.6)
    scene.add(sp)
  }

  // ── Output C display ──────────────────────────────────────────────────────
  const CX      = OFFSET + STEP * 1.85
  const C_SIDE  = PE_W * 0.68
  const cGeo    = new THREE.BoxGeometry(C_SIDE, PE_H, C_SIDE)
  const cSprCvs: HTMLCanvasElement[][] = []
  const cSprTex: THREE.CanvasTexture[][] = []
  const cAccum: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0))

  const cTitle = makeStaticSprite((ctx, w, h) => {
    ctx.fillStyle = TEAL
    ctx.font = `bold ${Math.round(h * 0.58)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Output C', w / 2, h / 2)
  }, 1.5, 0.38)
  cTitle.position.set(CX, 0.3, -OFFSET - 0.62)
  scene.add(cTitle)

  const C_SP = 0.72

  function drawCSprite(ctx: CanvasRenderingContext2D, w: number, h: number, accum: number) {
    ctx.clearRect(0, 0, w, h)
    const done = accum >= GRID
    ctx.fillStyle = done ? 'rgba(14,40,32,0.95)' : (accum > 0 ? 'rgba(20,28,40,0.95)' : 'rgba(22,18,40,0.92)')
    ctx.beginPath()
    // @ts-ignore
    ctx.roundRect(6, 6, w - 12, h - 12, 10)
    ctx.fill()
    ctx.strokeStyle = done ? TEAL : (accum > 0 ? '#2d4048' : BORDER)
    ctx.lineWidth = done ? 5 : 2
    ctx.beginPath()
    // @ts-ignore
    ctx.roundRect(6, 6, w - 12, h - 12, 10)
    ctx.stroke()
    ctx.fillStyle = done ? TEAL : (accum > 0 ? '#4a9090' : MUTED)
    ctx.font = `bold ${done ? 80 : 68}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(done ? '✓' : String(accum), w / 2, h / 2)
  }

  for (let r = 0; r < GRID; r++) {
    cSprCvs.push([]); cSprTex.push([])
    for (let c = 0; c < GRID; c++) {
      // small box under the sprite
      const cSideMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x1a2825) })
      const box = new THREE.Mesh(cGeo, [cSideMat, cSideMat, cSideMat, botMat, cSideMat, cSideMat])
      box.position.set(CX + (c - 1) * C_SIDE * 1.08, 0, r * STEP - OFFSET)
      scene.add(box)

      const cvs = document.createElement('canvas'); cvs.width = cvs.height = 128
      drawCSprite(cvs.getContext('2d')!, 128, 128, 0)
      const tex = new THREE.CanvasTexture(cvs)
      const sp  = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false,
      }))
      sp.scale.set(C_SP, C_SP, 1)
      sp.position.set(CX + (c - 1) * C_SIDE * 1.08, PE_H / 2 + C_SP * 0.52, r * STEP - OFFSET)
      scene.add(sp)
      cSprCvs[r].push(cvs); cSprTex[r].push(tex)
    }
  }

  function updateC(r: number, c: number) {
    drawCSprite(cSprCvs[r][c].getContext('2d')!, 128, 128, cAccum[r][c])
    cSprTex[r][c].needsUpdate = true
  }

  // ── Wave label sprite ─────────────────────────────────────────────────────
  const wCvs = document.createElement('canvas'); wCvs.width = 512; wCvs.height = 96
  const wTex = new THREE.CanvasTexture(wCvs)
  const wSp  = new THREE.Sprite(new THREE.SpriteMaterial({ map: wTex, transparent: true, depthTest: false }))
  wSp.scale.set(3.6, 0.68, 1)
  wSp.position.set(0, 0.3, EZ - 1.15)
  scene.add(wSp)

  let lastWLabel = ''
  function setWaveLabel(text: string) {
    if (text === lastWLabel) return
    lastWLabel = text
    const ctx = wCvs.getContext('2d')!
    ctx.clearRect(0, 0, 512, 96)
    ctx.fillStyle = FG
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 48)
    wTex.needsUpdate = true
  }

  // ── Smooth step ───────────────────────────────────────────────────────────
  function ss(t: number) { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x) }

  function aDotPos(r: number, tl: number): THREE.Vector3 | null {
    for (let k = 0; k < GRID; k++) {
      const ws = k * WAVE_DUR
      const ts = ws + r * TICK
      const te = ts + (GRID + 1) * TICK
      if (tl < ts || tl >= te) continue
      const lt  = tl - ts
      const seg = Math.min(Math.floor(lt / TICK), GRID)
      const p   = ss((lt % TICK) / TICK)
      let x: number
      if (seg === 0)       x = EX + (-OFFSET - EX) * p
      else if (seg < GRID) x = (seg - 1) * STEP - OFFSET + STEP * p
      else                 x = (GRID - 1) * STEP - OFFSET + (XX - ((GRID - 1) * STEP - OFFSET)) * p
      return new THREE.Vector3(x, DY, r * STEP - OFFSET)
    }
    return null
  }

  function bDotPos(c: number, tl: number): THREE.Vector3 | null {
    for (let k = 0; k < GRID; k++) {
      const ws = k * WAVE_DUR
      const ts = ws + c * TICK
      const te = ts + (GRID + 1) * TICK
      if (tl < ts || tl >= te) continue
      const lt  = tl - ts
      const seg = Math.min(Math.floor(lt / TICK), GRID)
      const p   = ss((lt % TICK) / TICK)
      let z: number
      if (seg === 0)       z = EZ + (-OFFSET - EZ) * p
      else if (seg < GRID) z = (seg - 1) * STEP - OFFSET + STEP * p
      else                 z = (GRID - 1) * STEP - OFFSET + (XZ - ((GRID - 1) * STEP - OFFSET)) * p
      return new THREE.Vector3(c * STEP - OFFSET, DY, z)
    }
    return null
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  const clock  = new THREE.Clock()
  let waveTime = 0
  let animId: number
  const fired: boolean[][][] = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => Array(GRID).fill(false) as boolean[]),
  )

  function resetAll() {
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
      peAccum[r][c] = 0; peFlash[r][c] = false
      cAccum[r][c]  = 0
      updatePEVisual(r, c); updatePESprite(r, c); updateC(r, c)
    }
    for (let k = 0; k < GRID; k++)
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
          fired[k][r][c] = false
    for (const pr of pulseRings) pr.sp.visible = false
    pulseRings.length = 0
  }

  function animate() {
    animId = requestAnimationFrame(animate)
    const dt   = Math.min(clock.getDelta(), 0.05)
    const prev = waveTime
    waveTime   = (waveTime + dt) % PERIOD
    const tl   = waveTime

    if (prev > waveTime) resetAll()

    const currentWave = Math.min(Math.floor(tl / WAVE_DUR), GRID - 1)
    setWaveLabel(tl >= GRID * WAVE_DUR
      ? 'Done — 3 MACs / PE  ✓'
      : `Wave ${currentWave + 1} / ${GRID}   (k = ${currentWave})`)

    for (let r = 0; r < GRID; r++) {
      const pos = aDotPos(r, tl)
      aDots[r].head.visible = aDots[r].halo.visible = !!pos
      if (pos) { aDots[r].head.position.copy(pos); aDots[r].halo.position.copy(pos) }
    }
    for (let c = 0; c < GRID; c++) {
      const pos = bDotPos(c, tl)
      bDots[c].head.visible = bDots[c].halo.visible = !!pos
      if (pos) { bDots[c].head.position.copy(pos); bDots[c].halo.position.copy(pos) }
    }

    for (let k = 0; k < GRID; k++) {
      const ws       = k * WAVE_DUR
      const activeDur = (2 * GRID - 1) * TICK
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const tPeak = ws + (r + c) * TICK + 0.5 * TICK

          if (!fired[k][r][c] && tl >= tPeak && tl < ws + activeDur) {
            fired[k][r][c] = true
            peAccum[r][c]++
            cAccum[r][c]   = peAccum[r][c]
            updateC(r, c)
            spawnPulse(r, c, tl)
          }

          const flash = k === currentWave
            && Math.abs(tl - tPeak) < TICK * 0.38
            && tl < ws + activeDur
          if (flash !== peFlash[r][c]) {
            peFlash[r][c] = flash
            updatePEVisual(r, c)
          }
          updatePESprite(r, c)
        }
      }
    }

    // update pulse rings
    for (let i = pulseRings.length - 1; i >= 0; i--) {
      const pr  = pulseRings[i]
      const age = tl - pr.born
      if (age > RING_DUR) {
        pr.sp.visible = false
        pulseRings.splice(i, 1)
        continue
      }
      const progress = age / RING_DUR
      drawRing(pr.sp, progress, GOLD)
      const s = 0.9 + progress * 0.6
      pr.sp.scale.set(s, s, 1)
    }

    renderer.render(scene, camera)
  }

  animate()

  const onResize = () => {
    const w = el.clientWidth, h = el.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)
  cleanup = () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', onResize)
    renderer.dispose()
  }
})

onUnmounted(() => cleanup?.())
</script>

<template>
  <figure class="sa-three">
    <canvas ref="canvas" />
    <figcaption>
      Each PE accumulates 3 multiply-accumulate (MAC) operations — one per wave of data.
      A[r] flows right (violet), B[c] flows down (cyan). They meet at PE[r,c] along the diagonal
      each wave, incrementing its count. When all 3 MACs complete, C[r,c] turns teal (✓).
    </figcaption>
  </figure>
</template>

<style scoped>
.sa-three {
  margin: 2rem auto;
  text-align: center;
}
.sa-three canvas {
  width: 100%;
  height: 480px;
  display: block;
  border-radius: 4px;
}
.sa-three figcaption {
  margin-top: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.6;
  opacity: 0.65;
  color: var(--vp-c-text-2);
}
</style>
