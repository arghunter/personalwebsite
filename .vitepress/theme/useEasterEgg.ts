import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'

// SHA-256 of the trigger word — not stored in plaintext
const SECRET_HASH = 'b02e06485c54bb8d503d44ab75693665ccfb580a0d5cbd12c488d8c4aab51f37'
const SECRET_LEN = 4

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// iOS 13+ requires explicit permission for DeviceMotionEvent
const needsShakePermission =
  typeof DeviceMotionEvent !== 'undefined' &&
  typeof (DeviceMotionEvent as any).requestPermission === 'function'

export const shakeEnabled = ref(false)

export function useEasterEgg() {
  const router = useRouter()
  const buffer: string[] = []

  function isTyping() {
    const el = document.activeElement
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
  }

  async function onKeyDown(e: KeyboardEvent) {
    if (isTyping()) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key.length !== 1) return

    buffer.push(e.key)
    if (buffer.length > SECRET_LEN) buffer.shift()

    if (buffer.length === SECRET_LEN) {
      const hash = await sha256(buffer.join(''))
      if (hash === SECRET_HASH) {
        buffer.length = 0
        router.go('/secret')
      }
    }
  }

  // 5 clicks on avatar image
  let clickCount = 0
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  function onAvatarClick() {
    clickCount++
    if (clickTimer) clearTimeout(clickTimer)
    if (clickCount >= 5) {
      clickCount = 0
      router.go('/secret')
      return
    }
    clickTimer = setTimeout(() => { clickCount = 0 }, 1500)
  }

  // Shake detection
  let lastX = 0, lastY = 0, lastZ = 0, lastCheck = 0
  let shakeCooldown = false

  function onMotion(e: DeviceMotionEvent) {
    if (shakeCooldown) return
    const acc = e.accelerationIncludingGravity
    if (!acc) return
    const { x = 0, y = 0, z = 0 } = acc
    const now = Date.now()
    if (now - lastCheck < 100) return
    const delta = Math.abs((x ?? 0) - lastX) + Math.abs((y ?? 0) - lastY) + Math.abs((z ?? 0) - lastZ)
    lastX = x ?? 0; lastY = y ?? 0; lastZ = z ?? 0; lastCheck = now
    if (delta > 30) {
      shakeCooldown = true
      setTimeout(() => { shakeCooldown = false }, 2000)
      router.go('/secret')
    }
  }

  function setupShake() {
    window.addEventListener('devicemotion', onMotion)
    shakeEnabled.value = true
  }

  async function enableShake() {
    if (needsShakePermission) {
      const result = await (DeviceMotionEvent as any).requestPermission()
      if (result === 'granted') setupShake()
    } else {
      setupShake()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    document.querySelector('.no-border')?.addEventListener('click', onAvatarClick)
    if (!needsShakePermission) setupShake()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    document.querySelector('.no-border')?.removeEventListener('click', onAvatarClick)
    window.removeEventListener('devicemotion', onMotion)
  })

  return { enableShake, needsShakePermission, shakeEnabled }
}
