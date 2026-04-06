<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref, onMounted } from 'vue'
import Intro from './components/Intro.vue'
import MusicPlayer from './components/MusicPlayer.vue'
import WordCycle from './components/WordCycle.vue'
import VimIndicator from './components/VimIndicator.vue'
import { useIncWord, rerollIncWord } from './useIncWord'
import { useVimKeys } from './useVimKeys'

useVimKeys()

const incWord = useIncWord()

const { frontmatter, page } = useData()

const is404 = computed(() => page.value.isNotFound)

const isDark = ref(true)

onMounted(() => {
  isDark.value = !document.documentElement.classList.contains('light')
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
		<div class="nav-links">
			<a href="/">{{ frontmatter.title === 'Home' ? '>' : '' }}Home</a>
			<a href="/blog">{{ frontmatter.title === 'Blog' ? '>' : '' }}Blog</a>
			<a href="/projects">{{ frontmatter.title === 'Projects' ? '>' : '' }}Projects</a>
		</div>

		<div class="nav-links">
			<a href="/experience">{{ frontmatter.title === 'Experience' ? '>' : '' }}Experience</a>
			<a href="/contact">{{ frontmatter.title === 'Contact' ? '>' : '' }}Contact</a>
			<a href="/now">{{ frontmatter.title === 'Now' ? '>' : '' }}Now</a>
		</div>
	</nav>

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
		<h1 class="title page-title">How'd you get here?</h1>

		<main>
			<p>There's been a 404 error. Here let's go <a href="/">back home.</a></p>
		</main>
	</div>

	<div v-else>
		<h1 class="title page-title" style="max-width: 40rem; margin-left: auto; margin-right: auto">{{ frontmatter.title }}</h1>

		<h3 v-if="frontmatter.date !== undefined" class="page-date">
			{{ new Date(frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }}
		</h3>

		<main>
			<Content />
		</main>
	</div>

	<MusicPlayer />
	<VimIndicator />

	<footer>
		© 2026 <a href="https://github.com/arghunter" target="_blank">Armaan Gomes</a>
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
