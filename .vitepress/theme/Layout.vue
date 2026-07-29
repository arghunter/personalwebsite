<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref, watch } from 'vue'
import MusicPlayer from './components/MusicPlayer.vue'
import WordCycle from './components/WordCycle.vue'
import VimIndicator from './components/VimIndicator.vue'
import { useVimKeys } from './useVimKeys'
import { useEasterEgg } from './useEasterEgg'

useVimKeys()
const { enableShake, needsShakePermission, shakeEnabled } = useEasterEgg()

const { frontmatter, page } = useData()

const is404 = computed(() => page.value.isNotFound)

const menuOpen = ref(false)

watch(() => page.value.relativePath, () => { menuOpen.value = false })

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
		</div>

		<div class="nav-links nav-links-desktop">
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

	<div v-if="frontmatter.home">
		<h1 class="headline" @click="playHeadline"><a href="/claim" style="text-decoration: none;">Claim the Stars</a></h1>
		<main>
			<Content />
		</main>
	</div>

	<div v-else-if="is404">
		<main style="padding-top: 4rem;">
			<p style="opacity: 0.35; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 1rem;">404 — not found</p>
			<a href="/">← home</a>
		</main>
	</div>

	<div v-else-if="frontmatter.fullWidth">
		<Content />
	</div>

	<div v-else>
		<h1 :class="frontmatter.date !== undefined ? 'blog-title' : 'title'">{{ frontmatter.title }}</h1>

		<h3 v-if="frontmatter.date !== undefined" style="text-align: center; margin: -4rem 0 4rem; font-weight: 400; opacity: 0.45;">
			{{ new Date(frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }}
		</h3>

		<a v-if="frontmatter.date !== undefined" href="/blog" style="display: block; max-width: 45rem; margin: 0 auto 1rem; padding: 0 2rem; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.35; color: inherit; text-decoration: none;">← Blog</a>

		<main>
			<Content />
		</main>
	</div>

	<MusicPlayer />

	<footer>
		© 2026 <a href="https://github.com/arghunter" target="_blank">Armaan Gomes</a>
		<button v-if="needsShakePermission && !shakeEnabled" @click="enableShake" style="background:none;border:none;color:inherit;font:inherit;cursor:pointer;padding:0 0.25rem;opacity:0.5;" aria-label="Enable shake">&#128247;</button>
		<span class="friends-sep">|</span>
		<span class="friends-label">Friendsites:</span>
		<span class="friends-marquee-wrap">
			<span class="friends-marquee">
				<a href="https://www.outercloud.dev/" target="_blank">Outer Cloud</a>
				<span class="friends-dot">·</span>
				<a href="https://www.changchang.me/" target="_blank">Kevin Chang</a>
				<span class="friends-dot">·</span>
				<a href="https://shannonwu.vercel.app/" target="_blank">Shannon Wu</a>
				<span class="friends-dot">·</span>
				<a href="https://www.outercloud.dev/" target="_blank">Outer Cloud</a>
				<span class="friends-dot">·</span>
				<a href="https://www.changchang.me/" target="_blank">Kevin Chang</a>
				<span class="friends-dot">·</span>
				<a href="https://shannonwu.vercel.app/" target="_blank">Shannon Wu</a>
				<span class="friends-dot">·</span>
			</span>
		</span>
	</footer>
</template>
