import { createContentLoader, defineConfig, SiteConfig } from 'vitepress'
import { Feed } from 'feed'
import { writeFileSync } from "node:fs";
import path from "node:path/posix";

const hostname = 'https://arghunter.github.io'

export default defineConfig({
  title: "Armaan Gomes",
  description: 'Hi! I\'m Armaan Gomes. I like to build things.',
  srcDir: './src',
  head: [
    ['script', {}, `(function(){if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')})()`],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { 
      href: 'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Fira+Code:wght@300..700&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap',
      rel: 'stylesheet'
    }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
  ],
  cleanUrls: true,
  markdown: {
    config(md) {
        md.disable('emoji')
    },
    theme: {
      light: 'material-theme-darker',
      dark: 'material-theme-darker',
    }
  },
  buildEnd: async (config: SiteConfig) => {
    const feed = new Feed({
      title: 'Armaan Gomes',
      description: 'Welcome to my feed!',
      id: hostname,
      link: hostname,
      language: 'en',
      image: `${hostname}/favicon.png`,
      favicon: `${hostname}/favicon.png`,
    })

    const posts = await createContentLoader('blogs/*/index.md', {
      transform(rawData) {
        return rawData
          .sort((a, b) => {
            return +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date)
          })
          .filter(page => !page.frontmatter.hidden)
          .map(page => {
            return {
              title: page.frontmatter.title,
              description: page.frontmatter.longDescription ?? page.frontmatter.description,
              date: page.frontmatter.date,
              url: page.url,
            }
          })
      },
    }).load()
  
    for (const { url, description, title, date } of posts) {
      feed.addItem({
        title: title,
        id: `${hostname}${url}`,
        link: `${hostname}${url}`,
        description: description,
        date: new Date(date)
      })
    }
  
    writeFileSync(path.join(config.outDir, 'rss.xml'), feed.rss2())
  }
})
