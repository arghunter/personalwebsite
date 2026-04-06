---
title: "Blog"
---

<script setup>
import { data as blogs } from './blogs/blogs.data.ts'
</script>

<div v-for="blog, index in blogs">
    <div class="project-header"> <h3><a :href="blog.url">{{ blog.title }}</a></h3> <span> {{ new Date(blog.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' }) }} </span> </div>
    <p style="margin-top: 0">{{ blog.description }}</p>
    <hr>
</div>

<div style="height: 40px;"></div>

<span class="newsreader">""Perhaps the butterfly is proof that you can go through a great deal of darkness and still become something beautiful."<span style="white-space: nowrap"> - <a href="https://www.youtube.com/watch?v=Okp2H9w8dDI" onclick="if(window.__playMusic){window.__playMusic('Okp2H9w8dDI','The Truimph - RWBY','Jeff Williams feat. Casey Lee Williams');return false;}"> Beau Taplin</a></span></span>

<div style="height: 60px;"></div>
