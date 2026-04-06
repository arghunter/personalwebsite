import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'

export const gPending = ref(false)

export function useVimKeys() {
  const router = useRouter()
  let gTimer: ReturnType<typeof setTimeout> | null = null

  const routes: Record<string, string> = {
    h: '/',
    b: '/blog',
    p: '/projects',
    e: '/experience',
    c: '/contact',
    n: '/now',
  }

  function isTyping() {
    const el = document.activeElement
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTyping()) return
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const key = e.key

    if (gPending.value) {
      gPending.value = false
      if (gTimer) clearTimeout(gTimer)

      if (key === 'g') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (routes[key]) {
        router.go(routes[key])
        return
      }
      return
    }

    if (key === 'j') {
      e.preventDefault()
      window.scrollBy({ top: 80, behavior: 'smooth' })
    } else if (key === 'k') {
      e.preventDefault()
      window.scrollBy({ top: -80, behavior: 'smooth' })
    } else if (key === 'G') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } else if (key === 'g') {
      gPending.value = true
      gTimer = setTimeout(() => { gPending.value = false }, 800)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
