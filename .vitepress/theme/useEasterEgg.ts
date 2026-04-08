import { onMounted, onUnmounted } from 'vue'
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

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
