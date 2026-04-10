---
title: "Blog"
---

<script setup>
import { data as blogs } from './blogs/blogs.data.ts'
</script>

<div v-for="blog in blogs" class="blog-entry">
    <div class="blog-entry-date">{{ new Date(blog.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/New_York' }) }}</div>
    <h3 class="blog-entry-title"><a :href="blog.url">{{ blog.title }}</a></h3>
    <p class="blog-entry-desc">{{ blog.description }}</p>
</div>

<div style="height: 40px;"></div>

<span class="newsreader">""Perhaps the butterfly is proof that you can go through a great deal of darkness and still become something beautiful."<span style="white-space: nowrap"> - <a href="https://www.youtube.com/watch?v=Okp2H9w8dDI" onclick="if(window.__playMusic){window.__playMusic('Okp2H9w8dDI','The Truimph - RWBY','Jeff Williams feat. Casey Lee Williams');return false;}"> Beau Taplin</a></span></span>

<div style="height: 60px;"></div>
