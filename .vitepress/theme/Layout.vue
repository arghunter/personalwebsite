<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import Intro from './components/Intro.vue'
import MusicPlayer from './components/MusicPlayer.vue'
import NowPlaying from './components/NowPlaying.vue'
import WordCycle from './components/WordCycle.vue'
import VimIndicator from './components/VimIndicator.vue'
import { useIncWord, rerollIncWord } from './useIncWord'
import { useVimKeys } from './useVimKeys'
import { useEasterEgg } from './useEasterEgg'

useVimKeys()
const { enableShake, needsShakePermission, shakeEnabled } = useEasterEgg()

const incWord = useIncWord()

const { frontmatter, page } = useData()

const is404 = computed(() => page.value.isNotFound)

const isDark = ref(true)
const scrollPct = ref(0)
const menuOpen = ref(false)

watch(() => page.value.relativePath, () => { menuOpen.value = false })

onMounted(() => {
  isDark.value = !document.documentElement.classList.contains('light')
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    scrollPct.value = max > 0 ? Math.round((window.scrollY / max) * 100) : 0
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))
})

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.remove('light')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.add('light')
    localStorage.setItem('theme', 'light')
  }
}

function playHeadline() {
  if (window.__playMusic) window.__playMusic('3Hl99YpWR6k', 'Touch the Sky', 'Jeff Williams ft. Casey Lee Williams')
}
</script>

<template>
	<nav>
		<div class="nav-links nav-links-desktop">
			<a href="/">{{ frontmatter.title === 'Home' ? '>' : '' }}Home</a>
			<a href="/blog">{{ frontmatter.title === 'Blog' ? '>' : '' }}Blog</a>
			<a href="/projects">{{ frontmatter.title === 'Projects' ? '>' : '' }}Projects</a>
			<a href="/graph">{{ frontmatter.title === 'Graph' ? '>' : '' }}Graph</a>
		</div>

		<div class="nav-links nav-links-desktop">
			<a href="/now">{{ frontmatter.title === 'Now' ? '>' : '' }}Now</a>
			<a href="/experience">{{ frontmatter.title === 'Experience' ? '>' : '' }}Experience</a>
			<a href="/contact">{{ frontmatter.title === 'Contact' ? '>' : '' }}Contact</a>
		</div>

		<button class="nav-hamburger" @click="menuOpen = !menuOpen" :aria-label="menuOpen ? 'Close menu' : 'Open menu'">
			<span class="nav-hamburger-icon" :class="{ open: menuOpen }"></span>
		</button>
	</nav>

	<Transition name="mobile-menu">
		<div v-if="menuOpen" class="mobile-menu" @click.self="menuOpen = false">
			<nav class="mobile-menu-nav">
				<a href="/" @click="menuOpen = false">Home</a>
				<a href="/blog" @click="menuOpen = false">Blog</a>
				<a href="/projects" @click="menuOpen = false">Projects</a>
				<a href="/graph" @click="menuOpen = false">Graph</a>
				<a href="/now" @click="menuOpen = false">Now</a>
				<a href="/experience" @click="menuOpen = false">Experience</a>
				<a href="/contact" @click="menuOpen = false">Contact</a>
			</nav>
		</div>
	</Transition>

	<img class="hero-image" src="/agi-hero.svg" draggable="false" />
	<span class="hero-inc">Armaan Gomes, {{ incWord }} <button class="hero-inc-reroll" @click="rerollIncWord" aria-label="Reroll">↻</button></span>

	<button class="theme-toggle" @click="toggleTheme" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
		<span class="theme-toggle-thumb">{{ isDark ? '☀' : '☾' }}</span>
	</button>

	<Intro v-if="frontmatter.home" />

	<div v-if="frontmatter.home" class="home">
		<h1 class="headline headline-clickable" @click="playHeadline"><WordCycle /> the <span class="accent-headline">Stars</span></h1>

		<main>
			<Content />
		</main>
	</div>

	<div v-else-if="is404">
		<main>
			<div class="drc-report">
				<div class="drc-severity">[DRC] CRITICAL — Route not found</div>
				<div><span class="drc-field">rule       </span><span class="drc-value">NO_ROUTE_TO_HOST</span></div>
				<div><span class="drc-field">net        </span><span class="drc-value">{{ page.relativePath || '&lt;unknown&gt;' }}</span></div>
				<div><span class="drc-field">severity   </span><span class="drc-value">error</span></div>
				<div><span class="drc-field">violations </span><span class="drc-value">1</span></div>
				<br/>
				<div>Return to origin net: <a href="/">~root~</a></div>
			</div>
		</main>
	</div>

	<div v-else-if="frontmatter.fullWidth" class="full-width-page">
		<Content />
	</div>

	<div v-else>
		<div class="ds-header">
			<span>AGI-{{ page.relativePath.split('/').pop()?.replace('.md','').toUpperCase() ?? 'DOC' }}</span>
			<span>REV {{ frontmatter.rev ?? 'A' }}</span>
		</div>

		<h1 class="title page-title" style="max-width: 40rem; margin-left: auto; margin-right: auto">{{ frontmatter.title }}</h1>

		<h3 v-if="frontmatter.date !== undefined" class="page-date">
			{{ new Date(frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }}
		</h3>

		<main :class="{ 'blog-post': frontmatter.date !== undefined }">
			<Content />
		</main>
	</div>

	<div class="scroll-vu" aria-hidden="true">
		<div class="scroll-vu-fill" :style="{ height: scrollPct + '%' }"></div>
	</div>

	<MusicPlayer />
	<VimIndicator />

	<footer>
		© 2026 <a href="https://github.com/arghunter" target="_blank">Armaan Gomes</a>
		<button v-if="needsShakePermission && !shakeEnabled" @click="enableShake" class="shake-enable" aria-label="Enable shake">&#128247;</button>
		<span class="friends-sep">|</span>
		<span class="friends-label">Friendsites:</span>
		<span class="friends-marquee-wrap">
			<span class="friends-marquee">
				<a href="https://www.outercloud.dev/" target="_blank">Outer Cloud</a>
				<span class="friends-dot">·</span>
				<a href="https://www.changchang.me/" target="_blank">Kevin Chang</a>
				<span class="friends-dot">·</span>
				<a href="https://www.outercloud.dev/" target="_blank">Outer Cloud</a>
				<span class="friends-dot">·</span>
				<a href="https://www.changchang.me/" target="_blank">Kevin Chang</a>
				<span class="friends-dot">·</span>
			</span>
		</span>
	</footer>
</template>
