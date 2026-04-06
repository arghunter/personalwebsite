import { createContentLoader } from 'vitepress'
export default createContentLoader('blogs/*/index.md', {
	transform(rawData) {
		return rawData
			.sort((a, b) => {
				return +new Date(b.frontmatter.date) - +new Date(a.frontmatter.date)
			})
			.filter(page => !page.frontmatter.hidden)
			.map(page => {
				return {
					title: page.frontmatter.title,
					description: page.frontmatter.description,
					date: page.frontmatter.date,
					url: page.url,
				}
			})
	},
})
